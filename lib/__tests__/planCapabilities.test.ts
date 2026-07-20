import { CAP_BY_TIER, labelForTier, tierFromPlanType } from '~/lib/planCapabilities';
import type { PlanType, Tier } from '~/lib/planCapabilities';

describe('tierFromPlanType', () => {
  it('mapea "free" a tier "free"', () => {
    expect(tierFromPlanType('free')).toBe('free');
  });

  it.each<PlanType>(['elite_monthly', 'elite_yearly'])('mapea "%s" a tier "elite"', (planType) => {
    expect(tierFromPlanType(planType)).toBe('elite');
  });

  it.each<PlanType>(['pro_monthly', 'pro_yearly'])('mapea "%s" a tier "pro"', (planType) => {
    expect(tierFromPlanType(planType)).toBe('pro');
  });
});

describe('CAP_BY_TIER', () => {
  const tiers: Tier[] = ['free', 'pro', 'elite'];

  it('define capacidades para los 3 tiers', () => {
    tiers.forEach((tier) => {
      expect(CAP_BY_TIER[tier]).toBeDefined();
    });
  });

  it('free tiene límites más restrictivos que pro, y pro que elite', () => {
    expect(CAP_BY_TIER.free.events_limit).toBe(3);
    expect(CAP_BY_TIER.pro.events_limit).toBe('unlimited');
    expect(CAP_BY_TIER.elite.events_limit).toBe('unlimited');

    expect(CAP_BY_TIER.free.posts_limit).toBe(1);
    expect(CAP_BY_TIER.pro.posts_limit).toBe(3);
    expect(CAP_BY_TIER.elite.posts_limit).toBe('unlimited');

    expect(CAP_BY_TIER.free.bar_images_limit).toBeLessThan(CAP_BY_TIER.pro.bar_images_limit);
    expect(CAP_BY_TIER.pro.bar_images_limit).toBeLessThan(CAP_BY_TIER.elite.bar_images_limit);
  });

  it('solo elite tiene home_promotion y soporte prioritario', () => {
    expect(CAP_BY_TIER.free.home_promotion).toBe(false);
    expect(CAP_BY_TIER.pro.home_promotion).toBe(false);
    expect(CAP_BY_TIER.elite.home_promotion).toBe(true);

    expect(CAP_BY_TIER.free.support).toBe('standard');
    expect(CAP_BY_TIER.pro.support).toBe('standard');
    expect(CAP_BY_TIER.elite.support).toBe('priority');
  });
});

describe('labelForTier', () => {
  it('tiene una etiqueta en español para cada tier', () => {
    expect(labelForTier.free).toBe('Gratis');
    expect(labelForTier.pro).toBe('Pro');
    expect(labelForTier.elite).toBe('Elite');
  });
});
