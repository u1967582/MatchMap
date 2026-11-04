import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_OPEN_AD_CONFIG } from '~/constants/ads';
import { supabase } from '~/utils/supabase';
import {
  hasShownAppOpenAdThisSession,
  initializeAdsSDK,
  isAdsPrivacyOptionsRequired,
  loadAndShowAppOpenAdOnce,
  showAdsPrivacyOptions,
} from '~/utils/ads';

interface AdsContextValue {
  /**
   * `true` solo cuando el consentimiento UMP está resuelto, `canRequestAds`
   * es true y el SDK está inicializado. Ningún anuncio (banner incluido)
   * debe pedirse antes: hacerlo enviaría solicitudes de anuncios sin
   * consentimiento en el EEE.
   */
  adsReady: boolean;
  /** UMP exige mostrar un acceso para revisar el consentimiento (EEE/UK). */
  privacyOptionsRequired: boolean;
  /** Abre el formulario de opciones de privacidad de UMP. */
  openAdsPrivacyOptions: () => Promise<void>;
}

const AdsContext = createContext<AdsContextValue>({
  adsReady: false,
  privacyOptionsRequired: false,
  openAdsPrivacyOptions: async () => {},
});

export function useAds() {
  return useContext(AdsContext);
}

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [adsReady, setAdsReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

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
      let adsEnabled = false;
      try {
        adsEnabled = await initializeAdsSDK();
      } catch (error) {
        if (__DEV__) console.log('[ads] SDK init failed, continuing without ads', error);
      }

      // Se consulta aunque no haya anuncios: si el usuario rechazó en el EEE
      // tiene que poder volver a abrir el formulario y cambiar de opinión.
      const optionsRequired = await isAdsPrivacyOptionsRequired();
      if (cancelled) return;
      setPrivacyOptionsRequired(optionsRequired);
      setAdsReady(adsEnabled);

      if (!adsEnabled) return;

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

  const openAdsPrivacyOptions = useCallback(async () => {
    try {
      const canRequestAds = await showAdsPrivacyOptions();
      if (!canRequestAds) {
        setAdsReady(false);
        return;
      }
      // Si antes no había consentimiento, el SDK puede no estar inicializado:
      // initializeAdsSDK no vuelve a mostrar el formulario (ya está resuelto)
      // y mobileAds().initialize() es idempotente.
      setAdsReady(await initializeAdsSDK());
    } catch (error) {
      if (__DEV__) console.log('[ads] privacy options form failed', error);
    }
  }, []);

  const value = useMemo(
    () => ({ adsReady, privacyOptionsRequired, openAdsPrivacyOptions }),
    [adsReady, privacyOptionsRequired, openAdsPrivacyOptions]
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}
