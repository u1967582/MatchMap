jest.mock('react-native-google-mobile-ads', () => {
  const { Text } = require('react-native');
  return {
    BannerAd: jest.fn(() => <Text>banner</Text>),
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
    TestIds: { ADAPTIVE_BANNER: 'test-banner', APP_OPEN: 'test-app-open' },
  };
});
jest.mock('react-native-purchases', () => ({ AdFormat: { banner: 'banner' } }));
jest.mock('~/utils/revenuecat', () => ({
  generateAdImpressionId: jest.fn(() => 'test-impression-id'),
  trackAdRevenue: jest.fn(),
}));
jest.mock('~/contexts/AdsContext', () => ({ useAds: jest.fn() }));

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BannerAd } from 'react-native-google-mobile-ads';
import { useAds } from '~/contexts/AdsContext';
import AdBanner from '~/components/ads/AdBanner';

const mockedUseAds = useAds as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('AdBanner', () => {
  it('no monta el BannerAd (ni pide anuncio) hasta que hay consentimiento y SDK listo', async () => {
    mockedUseAds.mockReturnValue({ adsReady: false });
    await render(<AdBanner placement="map" />);
    expect(BannerAd).not.toHaveBeenCalled();
    expect(screen.queryByText('banner')).toBeNull();
  });

  it('monta el BannerAd cuando los anuncios están listos', async () => {
    mockedUseAds.mockReturnValue({ adsReady: true });
    await render(<AdBanner placement="map" />);
    expect(BannerAd).toHaveBeenCalled();
    expect(screen.getByText('banner')).toBeTruthy();
  });
});
