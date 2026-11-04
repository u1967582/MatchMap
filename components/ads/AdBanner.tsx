import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize, type PaidEvent } from 'react-native-google-mobile-ads';
import { AdFormat } from 'react-native-purchases';
import { spacing } from '~/components/ds';
import { AD_UNIT_IDS } from '~/constants/ads';
import { useAds } from '~/contexts/AdsContext';
import { generateAdImpressionId, trackAdRevenue } from '~/utils/revenuecat';

type Status = 'loading' | 'loaded' | 'failed';

interface AdBannerProps {
  placement: string;
}

export default function AdBanner({ placement }: AdBannerProps) {
  const { adsReady } = useAds();
  const [status, setStatus] = useState<Status>('loading');
  const impressionIdRef = useRef(generateAdImpressionId());

  const handleLoaded = useCallback(() => setStatus('loaded'), []);

  const handleFailed = useCallback(
    (error: Error) => {
      if (__DEV__) console.log(`[AdBanner:${placement}] failed to load`, error);
      setStatus('failed');
    },
    [placement]
  );

  const handlePaid = useCallback(
    (event: PaidEvent) => {
      trackAdRevenue({
        event,
        adUnitId: AD_UNIT_IDS.banner,
        adFormat: AdFormat.banner,
        placement,
        impressionId: impressionIdRef.current,
      });
    },
    [placement]
  );

  // Sin consentimiento UMP resuelto / SDK sin inicializar no se monta el
  // BannerAd: montarlo ya dispara la solicitud del anuncio.
  if (!adsReady || status === 'failed') return null;

  return (
    <View
      style={
        status === 'loaded'
          ? { alignItems: 'center', marginVertical: spacing.sm }
          : { height: 0, overflow: 'hidden' }
      }>
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={handleLoaded}
        onAdFailedToLoad={handleFailed}
        onPaid={handlePaid}
      />
    </View>
  );
}
