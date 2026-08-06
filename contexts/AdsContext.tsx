import React, { useEffect } from 'react';
import { APP_OPEN_AD_CONFIG } from '~/constants/ads';
import { supabase } from '~/utils/supabase';
import {
  hasShownAppOpenAdThisSession,
  initializeAdsSDK,
  loadAndShowAppOpenAdOnce,
} from '~/utils/ads';

export function AdsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const triggerAppOpenAd = async () => {
      if (cancelled || hasShownAppOpenAdThisSession()) return;
      try {
        await loadAndShowAppOpenAdOnce({ timeoutMs: APP_OPEN_AD_CONFIG.loadTimeoutMs });
      } catch (error) {
        if (__DEV__) console.log('[ads] App Open Ad skipped', error);
      }
    };

    const run = async () => {
      try {
        await initializeAdsSDK();
      } catch (error) {
        if (__DEV__) console.log('[ads] SDK init failed, continuing without ads', error);
        return;
      }

      if (cancelled) return;

      // No mostrar el App Open Ad en la pantalla de bienvenida/login: esperamos
      // a que exista una sesión (login real o "Explorar sin cuenta") antes de
      // dispararlo, para no interrumpir el flujo de autenticación.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        triggerAppOpenAd();
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (newSession) {
          subscription.unsubscribe();
          triggerAppOpenAd();
        }
      });

      return () => subscription.unsubscribe();
    };

    let authUnsubscribe: (() => void) | undefined;
    run().then((unsub) => {
      if (cancelled) {
        unsub?.();
      } else {
        authUnsubscribe = unsub;
      }
    });

    return () => {
      cancelled = true;
      authUnsubscribe?.();
    };
    // Solo en el montaje del provider = cold start. Deliberadamente sin
    // listener de AppState: eso es lo que garantiza que nunca se dispare
    // en un resume desde background.
  }, []);

  return <>{children}</>;
}
