// Subscription utility functions for MatchMap

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: {
    maxPhotos: number;
    watermark: boolean;
    analytics: 'basic' | 'advanced';
    support: 'email' | 'priority' | 'vip';
  };
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
    id: 'price_1RvGlr7hGI6XwPtaE9d03BfI', // ✅ ACTUALIZADO
    name: 'Pro Bar - Mensual',
    price: 9.99,
    currency: 'EUR',
    interval: 'month',
    features: {
      maxPhotos: 10,
      watermark: false,
      analytics: 'basic',
      support: 'priority'
    }
  },
  pro_yearly: {
    id: 'price_1RvGlr7hGI6XwPta032XCAwP', // ✅ ACTUALIZADO
    name: 'Pro Bar - Anual',
    price: 79.99,
    currency: 'EUR',
    interval: 'year',
    features: {
      maxPhotos: 10,
      watermark: false,
      analytics: 'basic',
      support: 'priority'
    }
  },
  elite_monthly: {
    id: 'price_1RvGmN7hGI6XwPtaye2UkCso', // ✅ ACTUALIZADO
    name: 'Elite Bar - Mensual',
    price: 19.99,
    currency: 'EUR',
    interval: 'month',
    features: {
      maxPhotos: 50,
      watermark: false,
      analytics: 'advanced',
      support: 'vip'
    }
  },
  elite_yearly: {
    id: 'price_1RvGmN7hGI6XwPta96F6JX70', // ✅ ACTUALIZADO
    name: 'Elite Bar - Anual',
    price: 149.99,
    currency: 'EUR',
    interval: 'year',
    features: {
      maxPhotos: 50,
      watermark: false,
      analytics: 'advanced',
      support: 'vip'
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
    // Free tier: 3 photos maximum
    return currentPhotoCount < 3;
  }

  const plan = getPlanByType(subscription.plan_type);
  if (!plan) return false;

  return currentPhotoCount < plan.features.maxPhotos;
}

/**
 * Get maximum photos allowed for user's subscription
 */
export function getMaxPhotosAllowed(subscription?: UserSubscription | null): number {
  if (!subscription || subscription.status !== 'active') {
    return 3; // Free tier
  }

  const plan = getPlanByType(subscription.plan_type);
  return plan?.features.maxPhotos || 3;
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
 * Check if user has watermark on photos
 */
export function hasWatermark(subscription?: UserSubscription | null): boolean {
  if (!hasActiveSubscription(subscription)) return false;
  
  const plan = getPlanByType(subscription?.plan_type || '');
  return plan?.features.watermark || false;
}

/**
 * Get support level for user's subscription
 */
export function getSupportLevel(subscription?: UserSubscription | null): 'email' | 'priority' | 'vip' {
  if (!hasActiveSubscription(subscription)) return 'email';
  
  const plan = getPlanByType(subscription?.plan_type || '');
  return plan?.features.support || 'email';
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
  if (photoCount <= 3) {
    return SUBSCRIPTION_PLANS.pro_monthly;
  } else if (photoCount <= 10) {
    return SUBSCRIPTION_PLANS.pro_monthly;
  } else {
    return SUBSCRIPTION_PLANS.elite_monthly;
  }
} 