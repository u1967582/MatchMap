// src/lib/planCapabilities.ts
export type Tier = 'free' | 'pro' | 'elite';
export type PlanType =
  | 'free'
  | 'pro_monthly' | 'pro_yearly'
  | 'elite_monthly' | 'elite_yearly';

export const tierFromPlanType = (p: PlanType): Tier => {
  if (p === 'free') return 'free';
  if (p.startsWith('elite')) return 'elite';
  return 'pro'; // pro_monthly / pro_yearly
};

export type Capabilities = {
  search_priority: 'normal' | 'highlighted' | 'top';
  profile_visibility: boolean;
  events_limit: number | 'unlimited';
  posts_limit: number | 'unlimited';
  bar_images_limit: number;
  allow_reviews: boolean;
  images_allowed: boolean;
  favorite_competitions: boolean;
  analytics: false | 'basic' | 'advanced';
  home_promotion: boolean;
  support: 'standard' | 'priority';
};

export const CAP_BY_TIER: Record<Tier, Capabilities> = {
  free: {
    search_priority: 'normal',
    profile_visibility: true,
    events_limit: 3,
    posts_limit: 1,
    bar_images_limit: 2,
    allow_reviews: true,
    images_allowed: true,
    favorite_competitions: false,
    analytics: false,
    home_promotion: false,
    support: 'standard',
  },
  pro: {
    search_priority: 'highlighted',
    profile_visibility: true,
    events_limit: 'unlimited',
    posts_limit: 3,
    bar_images_limit: 10,
    allow_reviews: true,
    images_allowed: true,
    favorite_competitions: true,
    analytics: 'basic',
    home_promotion: false,
    support: 'standard',
  },
  elite: {
    search_priority: 'top',
    profile_visibility: true,
    events_limit: 'unlimited',
    posts_limit: 'unlimited',
    bar_images_limit: 25,
    allow_reviews: true,
    images_allowed: true,
    favorite_competitions: true,
    analytics: 'advanced',
    home_promotion: true,
    support: 'priority',
  },
};

export const labelForTier: Record<Tier, string> = {
  free: 'Gratis',
  pro: 'Pro',
  elite: 'Elite',
}; 