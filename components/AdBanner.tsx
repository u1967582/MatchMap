import React, { useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
let BannerAd: any;
let BannerAdSize: any;
let TestIds: any;
let useForeground: any;

if (Constants.appOwnership !== 'expo') {
  try {
    // Dynamically require to avoid TurboModule errors in Expo Go
    ({ BannerAd, BannerAdSize, TestIds, useForeground } = require('react-native-google-mobile-ads'));
  } catch {
    // no-op in Expo Go or if native module missing
  }
}

export interface AdBannerProps {
  unitId?: string;
  size?: any;
}

const DEFAULT_AD_UNIT_ID: string | undefined = (() => {
  if (Constants.appOwnership === 'expo') return undefined;
  if (TestIds && __DEV__) return TestIds.BANNER;
  return Platform.select({
    ios: 'ca-app-pub-5753100822208837/1107918408',
    android: 'ca-app-pub-5753100822208837/0000000000',
    default: 'ca-app-pub-5753100822208837/1107918408',
  });
})();

const AdBanner: React.FC<AdBannerProps> = ({ unitId, size }) => {
  const bannerRef = useRef<any>(null);

  if (useForeground) {
    useForeground(() => {
      try {
        if (Platform.OS === 'ios') {
          bannerRef.current?.load?.();
        }
      } catch {}
    });
  }

  const selectedUnitId = useMemo(() => unitId || DEFAULT_AD_UNIT_ID, [unitId]);

  const resolvedSize = useMemo(() => {
    if (size) return size;
    if (BannerAdSize) {
      return BannerAdSize.ANCHORED_ADAPTIVE_BANNER ?? BannerAdSize.BANNER ?? 'BANNER';
    }
    return 'BANNER';
  }, [size]);

  if (!BannerAd || !resolvedSize || !selectedUnitId) {
    return null;
  }

  return (
    <BannerAd
      ref={bannerRef}
      unitId={selectedUnitId}
      size={resolvedSize}
      onAdFailedToLoad={() => {}}
    />
  );
};

export default AdBanner;


