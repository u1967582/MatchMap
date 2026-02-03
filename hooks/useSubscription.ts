import { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';

interface Subscription {
  id: string;
  bar_id: string;
  user_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing';
  plan_type: 'pro_monthly' | 'pro_yearly' | 'elite_monthly' | 'elite_yearly';
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  isLoading: boolean;
  error: string | null;
  isPro: boolean;
  isElite: boolean;
  hasActiveSubscription: boolean;
  canUploadMorePhotos: (currentCount: number) => boolean;
  canUseAutomation: boolean;
  canUseAdvancedStats: boolean;
  canUsePrioritySupport: boolean;
  maxPhotosAllowed: number;
  refreshSubscription: () => Promise<void>;
}

export const useSubscription = (barId?: string): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    if (!barId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('bar_id', barId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is expected when no subscription exists
        console.error('Error fetching subscription:', fetchError);
        setError(fetchError.message);
      } else {
        setSubscription(data);
      }
    } catch (err) {
      console.error('Error in fetchSubscription:', err);
      setError('Error fetching subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [barId]);

  const refreshSubscription = async () => {
    await fetchSubscription();
  };

  // Helper functions to check subscription features
  const isPro = subscription?.plan_type?.includes('pro') || false;
  const isElite = subscription?.plan_type?.includes('elite') || false;
  const hasActiveSubscription = subscription?.status === 'active' || false;

  const maxPhotosAllowed = (() => {
    if (!hasActiveSubscription) return 3; // Free tier
    if (isElite) return 50;
    if (isPro) return 10;
    return 3;
  })();

  const canUploadMorePhotos = (currentCount: number): boolean => {
    return currentCount < maxPhotosAllowed;
  };

  const canUseAutomation = isElite && hasActiveSubscription;
  const canUseAdvancedStats = isElite && hasActiveSubscription;
  const canUsePrioritySupport = (isPro || isElite) && hasActiveSubscription;

  return {
    subscription,
    isLoading,
    error,
    isPro,
    isElite,
    hasActiveSubscription,
    canUploadMorePhotos,
    canUseAutomation,
    canUseAdvancedStats,
    canUsePrioritySupport,
    maxPhotosAllowed,
    refreshSubscription,
  };
}; 