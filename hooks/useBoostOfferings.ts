import { useState, useEffect, useCallback } from 'react';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';

export interface BoostPackageInfo {
  pkg: PurchasesPackage;
  plan: '7d' | '1m' | '1y';
  title: string;
  price: string;
  isPopular: boolean;
  duration: string;
  amortization: string;
  pricePerMonth?: string;
  savingsBadge?: string;
  icon: 'flash' | 'trending-up' | 'sparkles';
}

interface UseBoostOfferingsResult {
  packages: BoostPackageInfo[];
  isLoading: boolean;
  error: Error | null;
  purchaseBoost: (pkg: PurchasesPackage, barId: string, userId: string) => Promise<boolean>;
  isPurchasing: boolean;
  purchasingId: string | null;
}

// Beneficio medio estimado por cliente nuevo (ver nota ROI del paywall).
export const AVG_PROFIT_PER_CUSTOMER_EUR = 13;

// Atributo de RevenueCat que el webhook usa para saber a qué bar va el boost.
// Debe coincidir con BOOST_BAR_ATTRIBUTE en supabase/functions/revenuecat-webhook/logic.ts.
export const BOOST_BAR_ATTRIBUTE = 'boost_bar_id';

function getPlanFromProductId(productId: string): '7d' | '1m' | '1y' | null {
  if (productId.includes('boost_7d')) return '7d';
  if (productId.includes('boost_1m')) return '1m';
  if (productId.includes('boost_1y')) return '1y';
  return null;
}

function getEndAt(plan: '7d' | '1m' | '1y'): Date {
  const end = new Date();
  if (plan === '7d') {
    end.setDate(end.getDate() + 7);
  } else if (plan === '1m') {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

export function formatPrice(amount: number, currencyCode: string | null | undefined): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currencyCode || 'EUR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode || 'EUR'}`;
  }
}

export function getCustomersToBreakEven(price: number): number {
  return Math.max(1, Math.ceil(price / AVG_PROFIT_PER_CUSTOMER_EUR));
}

// Ahorro del plan anual frente a pagar 12 meses sueltos. null si no aplica.
export function getYearlySavingsPercent(yearlyPrice: number, monthlyPrice: number): number | null {
  if (!(yearlyPrice > 0) || !(monthlyPrice > 0)) return null;
  const pct = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  return pct > 0 ? pct : null;
}

const PLAN_META: Record<'7d' | '1m' | '1y', {
  title: string;
  duration: string;
  icon: 'flash' | 'trending-up' | 'sparkles';
}> = {
  '7d': { title: 'Boost Semanal', duration: '7 días', icon: 'flash' },
  '1m': { title: 'Boost Mensual', duration: '1 mes', icon: 'trending-up' },
  '1y': { title: 'Boost de Temporada', duration: '1 año', icon: 'sparkles' },
};

const PLAN_ORDER: Record<'7d' | '1m' | '1y', number> = { '7d': 0, '1m': 1, '1y': 2 };

export function useBoostOfferings(): UseBoostOfferingsResult {
  const [packages, setPackages] = useState<BoostPackageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchOfferings() {
      try {
        setIsLoading(true);
        setError(null);

        const offerings = await Purchases.getOfferings();
        const current = offerings.current;

        if (!current) {
          if (isMounted) setError(new Error('No hay ofertas disponibles'));
          return;
        }

        const mapped = current.availablePackages
          .reduce<BoostPackageInfo[]>((acc, pkg) => {
            const plan = getPlanFromProductId(pkg.product.identifier);
            if (!plan) return acc;
            const meta = PLAN_META[plan];
            const customers = getCustomersToBreakEven(pkg.product.price);
            acc.push({
              pkg,
              plan,
              title: meta.title,
              price: pkg.product.priceString,
              isPopular: plan === '1m',
              duration: meta.duration,
              amortization: `Se amortiza con ${customers} ${customers === 1 ? 'cliente nuevo' : 'clientes nuevos'}`,
              pricePerMonth: plan === '1y'
                ? `${formatPrice(pkg.product.price / 12, pkg.product.currencyCode)}/mes`
                : undefined,
              icon: meta.icon,
            });
            return acc;
          }, [])
          .sort((a, b) => PLAN_ORDER[a.plan] - PLAN_ORDER[b.plan]);

        const monthly = mapped.find((p) => p.plan === '1m');
        const yearly = mapped.find((p) => p.plan === '1y');
        if (monthly && yearly) {
          const pct = getYearlySavingsPercent(yearly.pkg.product.price, monthly.pkg.product.price);
          if (pct) yearly.savingsBadge = `Ahorra ${pct}%`;
        }

        if (isMounted) setPackages(mapped);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Error al cargar los productos'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchOfferings();
    return () => { isMounted = false; };
  }, []);

  const purchaseBoost = useCallback(async (
    pkg: PurchasesPackage,
    barId: string,
    userId: string,
  ): Promise<boolean> => {
    const plan = getPlanFromProductId(pkg.product.identifier);
    if (!plan) return false;

    try {
      setIsPurchasing(true);
      setPurchasingId(pkg.identifier);

      // Para que el webhook sepa a qué bar va el boost aunque el insert del
      // cliente falle o llegue tarde. No bloquea la compra si falla.
      try {
        await Purchases.setAttributes({ [BOOST_BAR_ATTRIBUTE]: barId });
      } catch (attrErr) {
        console.warn('[useBoostOfferings] No se pudo fijar boost_bar_id:', attrErr);
      }

      const { transaction } = await Purchases.purchasePackage(pkg);

      const startAt = new Date();
      const endAt = getEndAt(plan);
      const amountCents = Math.round(pkg.product.price * 100);
      const currency = (pkg.product.currencyCode ?? 'eur').toLowerCase();

      // status='pending': la activación real (status='active') la hace
      // el webhook de RevenueCat (service_role) tras confirmar el pago,
      // no el cliente. Ver supabase/functions/revenuecat-webhook y la
      // migración 20260806161426_fix_bar_boosts_payment_integrity.
      // ignoreDuplicates: si el webhook llegó antes y ya activó la fila,
      // no la pisamos (ON CONFLICT DO NOTHING).
      const { error: insertError } = await supabase
        .from('bar_boosts')
        .upsert({
          bar_id: barId,
          user_id: userId,
          plan,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: 'pending',
          amount_cents: amountCents,
          currency,
          revenuecat_transaction_id: transaction?.transactionIdentifier ?? null,
        }, { onConflict: 'revenuecat_transaction_id', ignoreDuplicates: true });

      if (insertError) {
        console.error('[useBoostOfferings] Error inserting boost:', insertError);
        // El webhook activa el boost igualmente con el atributo boost_bar_id.
        toast.success('¡Compra exitosa!', 'Tu boost se activará en unos segundos');
        return true;
      }

      toast.success('¡Compra exitosa!', 'Tu boost se activará en unos segundos');
      return true;
    } catch (err: any) {
      if (err.userCancelled) {
        return false;
      }
      console.error('[useBoostOfferings] Purchase failed:', err);
      toast.error('Error en la compra', 'Vuelve a intentarlo');
      return false;
    } finally {
      setIsPurchasing(false);
      setPurchasingId(null);
    }
  }, []);

  return { packages, isLoading, error, purchaseBoost, isPurchasing, purchasingId };
}
