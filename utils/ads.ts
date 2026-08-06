import { Platform } from 'react-native';
import mobileAds, { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { AD_UNIT_IDS } from '~/constants/ads';

// Guarda de módulo (no useState): debe sobrevivir a remounts / fast refresh,
// a diferencia de un estado de React que se resetea en cada montaje.
let appOpenAdShownThisSession = false;

export function hasShownAppOpenAdThisSession() {
  return appOpenAdShownThisSession;
}

export function markAppOpenAdShown() {
  appOpenAdShownThisSession = true;
}

export async function initializeAdsSDK(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await requestTrackingPermissionsAsync();
    } catch (error) {
      if (__DEV__) console.log('[ads] ATT request failed', error);
    }
  }

  await mobileAds().initialize();
}

export async function loadAndShowAppOpenAdOnce({
  timeoutMs,
}: {
  timeoutMs: number;
}): Promise<void> {
  const ad = AppOpenAd.createForAdRequest(AD_UNIT_IDS.appOpen);

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
