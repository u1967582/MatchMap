import { Platform } from 'react-native';
import mobileAds, {
  AppOpenAd,
  AdEventType,
  AdsConsent,
  type PaidEvent,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { AdFormat } from 'react-native-purchases';
import { AD_UNIT_IDS } from '~/constants/ads';
import { generateAdImpressionId, trackAdRevenue } from '~/utils/revenuecat';

// Guarda de módulo (no useState): debe sobrevivir a remounts / fast refresh,
// a diferencia de un estado de React que se resetea en cada montaje.
let appOpenAdShownThisSession = false;

export function hasShownAppOpenAdThisSession() {
  return appOpenAdShownThisSession;
}

export function markAppOpenAdShown() {
  appOpenAdShownThisSession = true;
}

/**
 * Inicializa el SDK de AdMob tras resolver el consentimiento GDPR/UMP.
 * Devuelve `false` (sin inicializar el SDK) si el usuario está en una
 * región donde aplica el consentimiento y no lo ha concedido — en ese
 * caso el resto del flujo de ads (App Open Ad, banners) no debe intentar
 * cargar anuncios.
 */
export async function initializeAdsSDK(): Promise<boolean> {
  // GDPR/UMP: pide y, si aplica (usuarios en EEA/UK), muestra el formulario
  // de consentimiento configurado en AdMob → Privacy & messaging antes de
  // inicializar el SDK. Si falla (p.ej. sin red), seguimos con el estado de
  // consentimiento de la sesión anterior vía getConsentInfo(), tal como
  // recomienda la documentación de react-native-google-mobile-ads.
  try {
    await AdsConsent.gatherConsent();
  } catch (error) {
    if (__DEV__) console.log('[ads] GDPR consent gathering failed', error);
  }

  const { canRequestAds } = await AdsConsent.getConsentInfo();
  if (!canRequestAds) {
    if (__DEV__) console.log('[ads] canRequestAds=false, SDK de anuncios no inicializado');
    return false;
  }

  if (Platform.OS === 'ios') {
    try {
      await requestTrackingPermissionsAsync();
    } catch (error) {
      if (__DEV__) console.log('[ads] ATT request failed', error);
    }
  }

  await mobileAds().initialize();
  return true;
}

export async function loadAndShowAppOpenAdOnce({
  timeoutMs,
}: {
  timeoutMs: number;
}): Promise<void> {
  const ad = AppOpenAd.createForAdRequest(AD_UNIT_IDS.appOpen);
  const impressionId = generateAdImpressionId();

  // Los tipos de la librería no cubren el payload de PAID para anuncios
  // full-screen (solo lo tipan para BannerAd vía `onPaid`), pero el evento
  // nativo sí lo envía con la misma forma { currency, precision, value }
  // (ver BaseAd.js / MobileAd.js del paquete) — de ahí el cast explícito.
  ad.addAdEventListener(AdEventType.PAID, (event) => {
    trackAdRevenue({
      event: event as unknown as PaidEvent,
      adUnitId: AD_UNIT_IDS.appOpen,
      adFormat: AdFormat.appOpen,
      placement: 'app_open',
      impressionId,
    });
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('App Open Ad load timeout'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      unsubscribeLoaded();
      unsubscribeError();
    };

    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      cleanup();
      resolve();
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      cleanup();
      reject(error);
    });

    ad.load();
  });

  // Marcar antes de mostrar para blindar contra una segunda invocación
  // concurrente dentro del mismo cold start.
  markAppOpenAdShown();
  ad.show();
}
