export type BoostPlan = '7d' | '1m' | '1y';

// Base semanal: 9€ por 7 días
const WEEKLY_PRICE_EUR = 9;

export function calculateDiscountPercent(plan: BoostPlan): number {
  if (plan === '7d') return 0;
  const weeks = plan === '1m' ? 4 : 52;
  const base = weeks * WEEKLY_PRICE_EUR;
  const current = plan === '1m' ? 24 : 89;
  const discount = 1 - current / base;
  return Math.round(discount * 100); // ~33, ~81
}

export function calculateDiscountBadge(plan: '1m' | '1y'): string {
  const pct = calculateDiscountPercent(plan);
  return `Ahorra ~${pct}%`;
}


