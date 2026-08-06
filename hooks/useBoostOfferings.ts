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
  savingsBadge?: string;
  icon: 'flash' | 'trending-up' | 'sparkles';
  buttonColors: [string, string];
}

interface UseBoostOfferingsResult {
  packages: BoostPackageInfo[];
  isLoading: boolean;
  error: Error | null;
  purchaseBoost: (pkg: PurchasesPackage, barId: string, userId: string) => Promise<boolean>;
  isPurchasing: boolean;
  purchasingId: string | null;
}

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

const PLAN_META: Record<'7d' | '1m' | '1y', {
  title: string;
  duration: string;
  amortization: string;
  savingsBadge?: string;
  icon: 'flash' | 'trending-up' | 'sparkles';
  buttonColors: [string, string];
}> = {
  '7d': {
    title: 'Boost Semanal',
    duration: '7 días',
    amortization: 'Se amortiza con solo 2 clientes nuevos',
    icon: 'flash',
    buttonColors: ['#3B82F6', '#1976D2'],
  },
  '1m': {
    title: 'Boost Mensual',
    duration: '1 mes',
    amortization: 'Se amortiza con solo 5 clientes nuevos',
    icon: 'trending-up',
    buttonColors: ['#D4AF37', '#B8956A'],
  },
  '1y': {
    title: 'Boost de Temporada',
    duration: '1 año',
    amortization: 'La opción de más valor (~44€/mes)',
    savingsBadge: 'Ahorra ~81%',
    icon: 'sparkles',
    buttonColors: ['#10B981', '#059669'],
  },
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
            acc.push({
              pkg,
              plan,
              title: meta.title,
              price: pkg.product.priceString,
              isPopular: plan === '1m',
              duration: meta.duration,
              amortization: meta.amortization,
              savingsBadge: meta.savingsBadge,
              icon: meta.icon,
              buttonColors: meta.buttonColors,
            });
            return acc;
          }, [])
          .sort((a, b) => PLAN_ORDER[a.plan] - PLAN_ORDER[b.plan]);

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

      const { transaction } = await Purchases.purchasePackage(pkg);

      const startAt = new Date();
      const endAt = getEndAt(plan);
      const amountCents = Math.round(pkg.product.price * 100);
      const currency = (pkg.product.currencyCode ?? 'eur').toLowerCase();

      // status='pending': la activación real (status='active') la hace
      // el webhook de RevenueCat (service_role) tras confirmar el pago,
      // no el cliente. Ver supabase/functions/revenuecat-webhook y la
      // migración 20260806050000_fix_bar_boosts_payment_integrity.
      const { error: insertError } = await supabase
        .from('bar_boosts')
        .insert({
          bar_id: barId,
          user_id: userId,
          plan,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: 'pending',
          amount_cents: amountCents,
          currency,
          revenuecat_transaction_id: transaction?.transactionIdentifier ?? null,
        });

      if (insertError) {
        console.error('[useBoostOfferings] Error inserting boost:', insertError);
        toast.warning('Boost comprado, pero no se pudo registrar. Contacta con soporte.');
        return true;
      }

      toast.success('¡Compra exitosa!', 'Tu boost se activará en unos instantes');
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
