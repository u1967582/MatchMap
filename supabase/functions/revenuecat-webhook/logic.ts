// Lógica pura del webhook de RevenueCat (sin dependencias de Deno) para
// poder testearla con Jest desde supabase/functions/revenuecat-webhook/__tests__.

export type BoostPlan = '7d' | '1m' | '1y';

export type WebhookAction = 'activate' | 'expire' | 'cancel' | 'ignore';

export interface RevenueCatEvent {
  type: string;
  app_user_id?: string;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  product_id?: string | null;
  price?: number | null;
  currency?: string | null;
  subscriber_attributes?: Record<string, { value?: string | null } | undefined> | null;
}

// Atributo que el cliente fija con Purchases.setAttributes() justo antes de
// comprar, para que el webhook sepa a qué bar va el boost.
export const BOOST_BAR_ATTRIBUTE = 'boost_bar_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSupabaseUserId(appUserId: string | null | undefined): appUserId is string {
  return !!appUserId && UUID_RE.test(appUserId);
}

export function getActionForEvent(type: string): WebhookAction {
  switch (type) {
    // Los boosts son compras sin renovación: RevenueCat envía
    // NON_RENEWING_PURCHASE. INITIAL_PURCHASE/RENEWAL se mantienen por si
    // algún producto se configura como suscripción.
    case 'NON_RENEWING_PURCHASE':
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
      return 'activate';
    case 'EXPIRATION':
      return 'expire';
    case 'CANCELLATION':
    case 'REFUND':
      return 'cancel';
    default:
      return 'ignore';
  }
}

export function getPlanFromProductId(productId: string | null | undefined): BoostPlan | null {
  if (!productId) return null;
  if (productId.includes('boost_7d')) return '7d';
  if (productId.includes('boost_1m')) return '1m';
  if (productId.includes('boost_1y')) return '1y';
  return null;
}

// El cliente guarda transaction.transactionIdentifier, que corresponde a
// event.transaction_id. original_transaction_id solo como fallback.
export function getTransactionId(event: RevenueCatEvent): string | null {
  return event.transaction_id || event.original_transaction_id || null;
}

export function getBoostBarIdAttribute(event: RevenueCatEvent): string | null {
  const value = event.subscriber_attributes?.[BOOST_BAR_ATTRIBUTE]?.value;
  return value && UUID_RE.test(value) ? value : null;
}

export function computeEndAt(plan: BoostPlan, from: Date): Date {
  const end = new Date(from.getTime());
  if (plan === '7d') {
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (plan === '1m') {
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }
  return end;
}

// Si el bar ya tiene un boost activo, el nuevo se encadena a continuación
// en lugar de solaparse (y desperdiciar días pagados).
export function computeBoostWindow(
  plan: BoostPlan,
  now: Date,
  currentActiveEndAt: string | null | undefined,
): { startAt: Date; endAt: Date } {
  const currentEnd = currentActiveEndAt ? new Date(currentActiveEndAt) : null;
  const startAt = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return { startAt, endAt: computeEndAt(plan, startAt) };
}
