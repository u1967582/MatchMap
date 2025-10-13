import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
let AppOpenAd: any;
let AdEventType: any;
let TestIds: any;

if (Constants.appOwnership !== 'expo') {
  try {
    ({ AppOpenAd, AdEventType, TestIds } = require('react-native-google-mobile-ads'));
  } catch {
    // no-op
  }
}

const getIosAppOpenUnitId = (): string | undefined => {
  if (Constants.appOwnership === 'expo') return undefined;
  if (TestIds && __DEV__) return TestIds.APP_OPEN;
  return 'ca-app-pub-5753100822208837/3481325526';
};

export default function AppOpenAdHandler() {
  const appStateRef = useRef(AppState.currentState);
  const appOpenAd = useRef<any>(null);
  const lastShownAtRef = useRef<number>(0);
  const minShowIntervalMs = 15_000; // avoid spamming on quick background/foreground

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (Constants.appOwnership === 'expo') return;
    if (!AppOpenAd || !AdEventType) return;

    const unitId = getIosAppOpenUnitId();
    if (!unitId) return;

    appOpenAd.current = AppOpenAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
      keywords: ['sports', 'football', 'bar', 'live sports'],
    });

    const ad = appOpenAd.current;
    ad.load();

    const showIfLoaded = () => {
      const now = Date.now();
      if (now - lastShownAtRef.current < minShowIntervalMs) return;
      if (ad.loaded) {
        ad
          .show()
          .then(() => {
            lastShownAtRef.current = Date.now();
          })
          .catch(() => {});
      } else {
        ad.load();
      }
    };

    const subLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {});
    const subError = ad.addAdEventListener(AdEventType.ERROR, () => {});
    const subClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      ad.load();
    });

    const appStateListener = AppState.addEventListener('change', nextState => {
      const isComingToForeground = appStateRef.current.match(/inactive|background/) && nextState === 'active';
      appStateRef.current = nextState;
      if (isComingToForeground) showIfLoaded();
    });

    // Attempt to show shortly after launch if loaded fast enough
    setTimeout(showIfLoaded, 400);

    return () => {
      subLoaded();
      subError();
      subClosed();
      appStateListener.remove();
    };
  }, []);

  return null;
}


