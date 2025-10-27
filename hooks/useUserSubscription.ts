import { useEffect, useState } from 'react';
// Subscriptions disabled; provide static "pro"-like values
import { supabase } from '~/utils/supabase';

export function useUserSubscription(userId?: string) {
  const [state, setState] = useState({
    isLoading: true,
    hasActiveSubscription: true,
    planType: 'pro_monthly' as any,
    maxPhotosAllowed: 10,
  });

  useEffect(() => {
    if (!userId) {
      setState({ isLoading: false, hasActiveSubscription: true, planType: 'pro_monthly' as any, maxPhotosAllowed: 10 });
      return;
    }

    let isMounted = true;
    
    (async () => {
      try {
        const hasActive = true;
        const maxPhotos = 10;
        const plan = 'pro_monthly';
        
        if (isMounted) {
          setState({
            isLoading: false,
            hasActiveSubscription: hasActive,
            planType: plan as any,
            maxPhotosAllowed: maxPhotos,
          });
        }
      } catch (error) {
        console.error('❌ Error en useUserSubscription:', error);
        if (isMounted) {
          setState({ isLoading: false, hasActiveSubscription: true, planType: 'pro_monthly' as any, maxPhotosAllowed: 10 });
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return state;
} 