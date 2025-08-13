import { useEffect, useState } from 'react';
import { supabase } from '~/utils/supabase';
import { SUBSCRIPTION_PLANS } from '~/utils/subscription';
import { waitForStripeRecords, getUserActivePlan, maxPhotosForPlan, validatePhotoLimit } from '~/utils/stripeHelpers';

export function useUserSubscription(userId?: string) {
  const [state, setState] = useState({
    isLoading: true,
    hasActiveSubscription: false,
    planType: null as null | keyof typeof SUBSCRIPTION_PLANS,
    maxPhotosAllowed: 2, // Default para plan gratuito
  });

  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true;
    
    (async () => {
      try {
        // Usar la nueva función helper
        const plan = await getUserActivePlan();
        const hasActive = !!plan;
        const maxPhotos = maxPhotosForPlan(plan);
        
        if (isMounted) {
          setState({
            isLoading: false,
            hasActiveSubscription: hasActive,
            planType: plan,
            maxPhotosAllowed: maxPhotos,
          });
        }
      } catch (error) {
        console.error('❌ Error en useUserSubscription:', error);
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