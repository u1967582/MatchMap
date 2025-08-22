// Subscription utility functions for MatchMap

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
  free: {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    currency: 'EUR',
    interval: 'none',
    features: {
      search_priority: 'normal',
      profile_visibility: true,
      events_limit: 3,
      posts_limit: 1,
      bar_images_limit: 2,
      allow_reviews: true,
      images_allowed: false,
      favorite_competitions: false,
      analytics: false,
      home_promotion: false,
      support: 'standard'
    }
  },
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
  elite_monthly: {
    id: 'price_1RvGmN7hGI6XwPtaye2UkCso',
    name: 'Elite Bar - Mensual',
    price: 19.99,
    currency: 'EUR',
    interval: 'month',
    features: {
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
      support: 'priority'
    }
  },
  elite_yearly: {
    id: 'price_1RvGmN7hGI6XwPta96F6JX70',
    name: 'Elite Bar - Anual',
    price: 149.99,
    currency: 'EUR',
    interval: 'year',
    features: {
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
      support: 'priority'
    }
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
  if (!subscription || subscription.status !== 'active') {
    // Free tier: limited to 2 images
    return currentPhotoCount < 2;
  }

  const plan = getPlanByType(subscription.plan_type);
  if (!plan) return false;

  // Check if plan allows images
  if (!plan.features.images_allowed) {
    return false;
  }

  // Use the specific bar_images_limit from the plan
  return currentPhotoCount < plan.features.bar_images_limit;
}

/**
 * Get maximum photos allowed for user's subscription
 */
export function getMaxPhotosAllowed(subscription?: UserSubscription | null): number {
  if (!subscription || subscription.status !== 'active') {
    return 2; // Free tier: 2 images
  }

  const plan = getPlanByType(subscription.plan_type);
  if (!plan) return 2;

  // Check if plan allows images
  if (!plan.features.images_allowed) {
    return 0;
  }

  // Return the specific bar_images_limit from the plan
  return plan.features.bar_images_limit;
}

/**
 * Check if user has active subscription
 */
export function hasActiveSubscription(subscription?: UserSubscription | null): boolean {
  return !!(subscription && subscription.status === 'active');
}

/**
 * Check if user has Pro plan
 */
export function isProUser(subscription?: UserSubscription | null): boolean {
  if (!hasActiveSubscription(subscription)) return false;
  
  const planType = subscription?.plan_type;
  return planType === 'pro_monthly' || planType === 'pro_yearly';
}

/**
 * Check if user has Elite plan
 */
export function isEliteUser(subscription?: UserSubscription | null): boolean {
  if (!hasActiveSubscription(subscription)) return false;
  
  const planType = subscription?.plan_type;
  return planType === 'elite_monthly' || planType === 'elite_yearly';
}

/**
 * Check if user can access advanced analytics
 */
export function canAccessAdvancedAnalytics(subscription?: UserSubscription | null): boolean {
  if (!hasActiveSubscription(subscription)) return false;
  
  const plan = getPlanByType(subscription?.plan_type || '');
  return plan?.features.analytics === 'advanced';
}

/**
 * Check if user has watermark on photos (now based on images_allowed)
 */
export function hasWatermark(subscription?: UserSubscription | null): boolean {
  if (!hasActiveSubscription(subscription)) return true; // Free tier has watermark
  
  const plan = getPlanByType(subscription?.plan_type || '');
  return !plan?.features.images_allowed; // Watermark if images not allowed
}

/**
 * Get support level for user's subscription
 */
export function getSupportLevel(subscription?: UserSubscription | null): 'standard' | 'priority' | 'vip' {
  if (!hasActiveSubscription(subscription)) return 'standard';
  
  const plan = getPlanByType(subscription?.plan_type || '');
  return plan?.features.support || 'standard';
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
  const monthlyCost = monthlyPlan.price * 12;
  const yearlyCost = yearlyPlan.price;
  
  return monthlyCost - yearlyCost;
}

/**
 * Get recommended plan based on photo count needs
 */
export function getRecommendedPlan(photoCount: number): SubscriptionPlan {
  if (photoCount <= 2) {
    return SUBSCRIPTION_PLANS.free;
  } else if (photoCount <= 10) {
    return SUBSCRIPTION_PLANS.pro_monthly;
  } else {
    return SUBSCRIPTION_PLANS.elite_monthly;
  }
} 