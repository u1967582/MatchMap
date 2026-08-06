import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { spacing } from '~/components/ds';
import { AD_UNIT_IDS } from '~/constants/ads';

type Status = 'loading' | 'loaded' | 'failed';

interface AdBannerProps {
  placement: string;
}

export default function AdBanner({ placement }: AdBannerProps) {
  const [status, setStatus] = useState<Status>('loading');

  const handleLoaded = useCallback(() => setStatus('loaded'), []);

  const handleFailed = useCallback(
    (error: Error) => {
      if (__DEV__) console.log(`[AdBanner:${placement}] failed to load`, error);
      setStatus('failed');
    },
    [placement]
  );

  if (status === 'failed') return null;

  return (
    <View
      style={
        status === 'loaded'
          ? { alignItems: 'center', marginVertical: spacing.sm }
          : { height: 0, overflow: 'hidden' }
      }
    >
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={handleLoaded}
        onAdFailedToLoad={handleFailed}
      />
    </View>
  );
}
