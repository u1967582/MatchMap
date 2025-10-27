// Subscription utility functions for MatchMap

// Simplified subscription features; all users behave as PRO now
export interface SubscriptionFeatures {
  search_priority: 'normal' | 'highlighted' | 'top';
  profile_visibility: boolean;
  events_limit: number | 'unlimited';
  posts_limit: number | 'unlimited';
  bar_images_limit: number;
  allow_reviews: boolean;
  images_allowed: boolean;
  favorite_competitions: boolean;
  analytics: boolean | 'basic' | 'advanced';
  home_promotion: boolean;
  support: 'standard' | 'priority' | 'vip';
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'none'; // 'none' para el plan gratuito
  features: SubscriptionFeatures;
}

export interface UserSubscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  plan_type: 'pro_monthly' | 'pro_yearly' | 'elite_monthly' | 'elite_yearly';
  start_date: string;
  end_date: string;
  bar_id?: string;
}

// Available subscription plans (debe coincidir con los IDs de Stripe)
export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  pro_monthly: {
    id: 'price_1RvGlr7hGI6XwPtaE9d03BfI',
    name: 'Pro Bar - Mensual',
    price: 9.99,
    currency: 'EUR',
    interval: 'month',
    features: {
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
      support: 'standard'
    }
  },
  pro_yearly: {
    id: 'price_1RvGlr7hGI6XwPta032XCAwP',
    name: 'Pro Bar - Anual',
    price: 79.99,
    currency: 'EUR',
    interval: 'year',
    features: {
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
      support: 'standard'
    }
  },
  }
};

/**
 * Get plan details by Stripe price ID
 */
export function getPlanByPriceId(priceId: string): SubscriptionPlan | null {
  const plan = Object.values(SUBSCRIPTION_PLANS).find(plan => plan.id === priceId);
  return plan || null;
}

/**
 * Get plan details by plan type
 */
export function getPlanByType(planType: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS[planType] || null;
}

/**
 * Check if user can upload more photos based on their subscription
 */
export function canUploadMorePhotos(
  currentPhotoCount: number,
  subscription?: UserSubscription | null
): boolean {
  // Everyone is PRO: use generous limits
  return currentPhotoCount < 10;
}

/**
 * Get maximum photos allowed for user's subscription
 */
export function getMaxPhotosAllowed(subscription?: UserSubscription | null): number {
  return 10; // PRO default
}

/**
 * Check if user has active subscription
 */
export function hasActiveSubscription(subscription?: UserSubscription | null): boolean {
  return true; // Treat as active for feature gating
}

/**
 * Check if user has Pro plan
 */
export function isProUser(subscription?: UserSubscription | null): boolean {
  return true;
}

/**
 * Check if user has Elite plan
 */
export function isEliteUser(subscription?: UserSubscription | null): boolean {
  return true; // Elite features also available
}

/**
 * Check if user can access advanced analytics
 */
export function canAccessAdvancedAnalytics(subscription?: UserSubscription | null): boolean {
  return true;
}

/**
 * Check if user has watermark on photos (now based on images_allowed)
 */
export function hasWatermark(subscription?: UserSubscription | null): boolean {
  return false; // Never add watermark
}

/**
 * Get support level for user's subscription
 */
export function getSupportLevel(subscription?: UserSubscription | null): 'standard' | 'priority' | 'vip' {
  return 'priority';
}

/**
 * Format subscription price for display
 */
export function formatPrice(plan: SubscriptionPlan): string {
  const { price, currency, interval } = plan;
  const currencySymbol = currency === 'EUR' ? '€' : currency;
  
  if (interval === 'year') {
    return `${price}${currencySymbol}/año`;
  }
  
  return `${price}${currencySymbol}/mes`;
}

/**
 * Calculate yearly savings for annual plans
 */
export function getYearlySavings(monthlyPlan: SubscriptionPlan, yearlyPlan: SubscriptionPlan): number {
  return 0;
}

/**
 * Get recommended plan based on photo count needs
 */
export function getRecommendedPlan(photoCount: number): SubscriptionPlan {
  return SUBSCRIPTION_PLANS.pro_monthly;
} 