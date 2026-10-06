import { useState, useEffect, useCallback, useRef } from 'react';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { supabase } from '~/utils/supabase';
import { useRevenueCat } from '~/contexts/RevenueCatContext';
import { BOOST_BAR_ATTRIBUTE, syncRevenueCatUser } from '~/utils/revenuecat';
import {
  BOOST_PLAN_ORDER,
  BoostPlan,
  PurchaseErrorKind,
  classifyPurchaseError,
  formatPrice,
  getBoostEndAt,
  getPlanFromProductId,
  getSavingsVsWeekly,
  getWeeklyPrice,
} from '~/utils/boostPlans';

export interface BoostPackageInfo {
  pkg: PurchasesPackage;
  plan: BoostPlan;
  priceString: string;
  /** Precio por semana formateado; null en el plan semanal. */
  weeklyPriceString: string | null;
  /** % de ahorro frente a comprar semanas sueltas, calculado con precios reales. */
  savingsPct: number | null;
}

export type BoostPurchaseResult =
  /** El webhook ya ha confirmado el pago: el boost está activo. */
  | { outcome: 'active'; endAt: string | null }
  /** Pago hecho, el servidor aún no lo ha confirmado (suele tardar segundos). */
  | { outcome: 'processing' }
  /** La tienda deja el pago pendiente (Ask to Buy, pago en efectivo en Android…). */
  | { outcome: 'pending_payment' }
  | { outcome: 'cancelled' }
  | { outcome: 'failed'; errorKind: PurchaseErrorKind };

interface UseBoostOfferingsResult {
  packages: BoostPackageInfo[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  purchaseBoost: (pkg: PurchasesPackage, barId: string, userId: string) => Promise<BoostPurchaseResult>;
  isPurchasing: boolean;
}

const CONFIRM_POLL_ATTEMPTS = 8;
const CONFIRM_POLL_INTERVAL_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function mapBoostPackages(available: PurchasesPackage[]): BoostPackageInfo[] {
  const withPlan = available
    .map((pkg) => ({ pkg, plan: getPlanFromProductId(pkg.product.identifier) }))
    .filter((p): p is { pkg: PurchasesPackage; plan: BoostPlan } => p.plan !== null)
    .sort((a, b) => BOOST_PLAN_ORDER[a.plan] - BOOST_PLAN_ORDER[b.plan]);

  const weeklyPrice = withPlan.find((p) => p.plan === '7d')?.pkg.product.price ?? null;

  return withPlan.map(({ pkg, plan }) => ({
    pkg,
    plan,
    priceString: pkg.product.priceString,
    weeklyPriceString:
      plan === '7d' ? null : formatPrice(getWeeklyPrice(plan, pkg.product.price), pkg.product.currencyCode),
    savingsPct: getSavingsVsWeekly(plan, pkg.product.price, weeklyPrice),
  }));
}

/**
 * Espera a que el webhook de RevenueCat marque el boost como activo.
 * Es el único que puede hacerlo (RLS): el cliente solo crea filas 'pending'.
 */
async function waitForActivation(transactionId: string): Promise<string | null | undefined> {
  for (let i = 0; i < CONFIRM_POLL_ATTEMPTS; i++) {
    const { data } = await supabase
      .from('bar_boosts')
      .select('status, end_at')
      .eq('revenuecat_transaction_id', transactionId)
      .maybeSingle();
    if (data?.status === 'active') return data.end_at ?? null;
    await sleep(CONFIRM_POLL_INTERVAL_MS);
  }
  return undefined;
}

export function useBoostOfferings(): UseBoostOfferingsResult {
  const { isReady } = useRevenueCat();
  const [packages, setPackages] = useState<BoostPackageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const purchasingRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    let isMounted = true;

    async function fetchOfferings() {
      try {
        setIsLoading(true);
        setError(null);

        const offerings = await Purchases.getOfferings();
        const mapped = mapBoostPackages(offerings.current?.availablePackages ?? []);

        if (!isMounted) return;
        if (mapped.length === 0) {
          setError(new Error('No hay planes disponibles'));
        }
        setPackages(mapped);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Error al cargar los productos'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchOfferings();
    return () => {
      isMounted = false;
    };
  }, [isReady, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const purchaseBoost = useCallback(
    async (pkg: PurchasesPackage, barId: string, userId: string): Promise<BoostPurchaseResult> => {
      const plan = getPlanFromProductId(pkg.product.identifier);
      if (!plan) return { outcome: 'failed', errorKind: 'store' };
      if (purchasingRef.current) return { outcome: 'cancelled' };

      purchasingRef.current = true;
      setIsPurchasing(true);
      try {
        // 1. La compra tiene que quedar a nombre del dueño del bar, no de un
        //    $RCAnonymousID, y llevar el bar para que el webhook la asigne.
        await syncRevenueCatUser(userId);
        await Purchases.setAttributes({ [BOOST_BAR_ATTRIBUTE]: barId });

        // 2. Compra en App Store / Google Play.
        const { transaction } = await Purchases.purchasePackage(pkg);
        const transactionId = transaction?.transactionIdentifier || null;

        // 3. Fila 'pending' para enlazar transacción ↔ bar. El webhook la pasa a
        //    'active' (o la crea él si llega antes: entonces este insert choca
        //    con el UNIQUE de revenuecat_transaction_id y no pasa nada).
        if (transactionId) {
          const startAt = new Date();
          const { error: insertError } = await supabase.from('bar_boosts').insert({
            bar_id: barId,
            user_id: userId,
            plan,
            start_at: startAt.toISOString(),
            end_at: getBoostEndAt(plan, startAt).toISOString(),
            status: 'pending',
            amount_cents: Math.round(pkg.product.price * 100),
            currency: (pkg.product.currencyCode ?? 'eur').toLowerCase(),
            revenuecat_transaction_id: transactionId,
          });
          if (insertError && insertError.code !== '23505') {
            // No es grave: el webhook crea la fila a partir del atributo boost_bar_id.
            console.warn('[useBoostOfferings] Pending insert failed:', insertError.message);
          }

          const endAt = await waitForActivation(transactionId);
          if (endAt !== undefined) return { outcome: 'active', endAt };
        }

        return { outcome: 'processing' };
      } catch (err: any) {
        const errorKind = classifyPurchaseError(err);
        if (errorKind === 'cancelled') return { outcome: 'cancelled' };
        if (errorKind === 'pending') return { outcome: 'pending_payment' };
        console.error('[useBoostOfferings] Purchase failed:', err);
        return { outcome: 'failed', errorKind };
      } finally {
        purchasingRef.current = false;
        setIsPurchasing(false);
      }
    },
    [],
  );

  return { packages, isLoading, error, reload, purchaseBoost, isPurchasing };
}
