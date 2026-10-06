/**
 * Lógica pura de los planes de Boost (pagos únicos, sin renovación).
 * Compartida por el paywall y por los tests. El webhook de RevenueCat
 * (supabase/functions/revenuecat-webhook) replica getPlanFromProductId
 * y getBoostEndAt: si cambias algo aquí, cámbialo también allí.
 */

export type BoostPlan = '7d' | '1m' | '1y';

export const BOOST_PLAN_ORDER: Record<BoostPlan, number> = { '7d': 0, '1m': 1, '1y': 2 };

/** Días aproximados por plan, solo para comparar precios entre planes. */
const PLAN_DAYS: Record<BoostPlan, number> = { '7d': 7, '1m': 30, '1y': 365 };

/**
 * Deduce el plan a partir del identificador de producto de la tienda.
 * En Android el identificador puede llevar sufijo (p. ej. `boost_7d_v2:base`),
 * por eso se usa `includes`.
 */
export function getPlanFromProductId(productId: string | null | undefined): BoostPlan | null {
  if (!productId) return null;
  if (productId.includes('boost_7d')) return '7d';
  if (productId.includes('boost_1m')) return '1m';
  if (productId.includes('boost_1y')) return '1y';
  return null;
}

/** Fecha de fin de un boost que empieza en `start`. */
export function getBoostEndAt(plan: BoostPlan, start: Date = new Date()): Date {
  const end = new Date(start.getTime());
  if (plan === '7d') end.setDate(end.getDate() + 7);
  else if (plan === '1m') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

/** Precio por semana de un plan, en la moneda del producto. */
export function getWeeklyPrice(plan: BoostPlan, price: number): number {
  return (price / PLAN_DAYS[plan]) * 7;
}

/**
 * Porcentaje de ahorro de un plan frente al semanal, calculado con los
 * precios reales de la tienda (cambian por país). Devuelve null si no hay
 * ahorro apreciable (< 5 %) o no se puede calcular.
 */
export function getSavingsVsWeekly(
  plan: BoostPlan,
  price: number,
  weeklyPlanPrice: number | null | undefined,
): number | null {
  if (plan === '7d' || !weeklyPlanPrice || weeklyPlanPrice <= 0 || price <= 0) return null;
  const savings = 1 - getWeeklyPrice(plan, price) / weeklyPlanPrice;
  const pct = Math.round(savings * 100);
  return pct >= 5 ? pct : null;
}

/** Formatea un importe con la moneda del producto (es-ES). */
export function formatPrice(amount: number, currencyCode: string | null | undefined): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currencyCode || 'EUR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode ?? ''}`.trim();
  }
}

export type PurchaseErrorKind = 'cancelled' | 'pending' | 'network' | 'store' | 'not_allowed' | 'unknown';

/**
 * Clasifica un error del SDK de RevenueCat. Se compara por `code` (string
 * numérico del enum PURCHASES_ERROR_CODE) para no depender del módulo
 * nativo en los tests.
 */
export function classifyPurchaseError(error: any): PurchaseErrorKind {
  if (!error) return 'unknown';
  if (error.userCancelled) return 'cancelled';
  switch (String(error.code)) {
    case '1': // PURCHASE_CANCELLED_ERROR
      return 'cancelled';
    case '20': // PAYMENT_PENDING_ERROR (Ask to Buy en iOS, pago pendiente en Android)
      return 'pending';
    case '10': // NETWORK_ERROR
    case '35': // OFFLINE_CONNECTION_ERROR
      return 'network';
    case '3': // PURCHASE_NOT_ALLOWED_ERROR
      return 'not_allowed';
    case '2': // STORE_PROBLEM_ERROR
    case '5': // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
    case '6': // PRODUCT_ALREADY_PURCHASED_ERROR
      return 'store';
    default:
      return 'unknown';
  }
}
