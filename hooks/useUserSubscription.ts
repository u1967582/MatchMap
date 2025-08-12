import { useEffect, useState } from 'react';
import { supabase } from '~/utils/supabase';
import { SUBSCRIPTION_PLANS } from '~/utils/subscription';

export function useUserSubscription(userId?: string) {
  const [state, setState] = useState({
    isLoading: true,
    hasActiveSubscription: false,
    planType: null as null | keyof typeof SUBSCRIPTION_PLANS,
    maxPhotosAllowed: 3,
    subscription: null as any,
  });

  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true;
    
    (async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('plan_type, status, end_date, bar_id')
          .eq('user_id', userId)
          .in('status', ['active', 'trialing'])
          .order('end_date', { ascending: false })
          .limit(1); // más reciente

        if (error) throw error;
        
        const sub = data?.[0];
        const hasActive = !!sub;
        const plan = hasActive ? (sub.plan_type as keyof typeof SUBSCRIPTION_PLANS) : null;
        const max = plan ? SUBSCRIPTION_PLANS[plan].features.maxPhotos : 3;

        if (isMounted) {
          setState({
            isLoading: false,
            hasActiveSubscription: hasActive,
            planType: plan,
            maxPhotosAllowed: max,
            subscription: sub,
          });
        }
      } catch (error) {
        console.error('Error fetching user subscription:', error);
        if (isMounted) {
          setState(s => ({ ...s, isLoading: false }));
        }
      }
    })();
    
    return () => { 
      isMounted = false; 
    };
  }, [userId]);

  return state;
} 