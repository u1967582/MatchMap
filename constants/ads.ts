import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// En dev/debug (__DEV__ true, incluye dev-client) siempre se sirven anuncios
// de test, aunque los IDs de producción ya estén configurados. Esto evita
// clics accidentales sobre anuncios reales durante desarrollo, algo que
// AdMob penaliza (puede llegar a suspender la cuenta). Los builds de
// producción/preview (__DEV__ false) sirven los anuncios reales.
const USE_TEST_ADS = __DEV__;

const PRODUCTION_AD_UNITS = {
  banner: {
    android: 'ca-app-pub-5753100822208837/5618640219',
    ios: 'ca-app-pub-5753100822208837/8940650588',
  },
  appOpen: {
    android: 'ca-app-pub-5753100822208837/5522633416',
    ios: 'ca-app-pub-5753100822208837/3976364447',
  },
};

export const AD_UNIT_IDS = {
  banner: USE_TEST_ADS ? TestIds.ADAPTIVE_BANNER : Platform.select(PRODUCTION_AD_UNITS.banner)!,
  appOpen: USE_TEST_ADS ? TestIds.APP_OPEN : Platform.select(PRODUCTION_AD_UNITS.appOpen)!,
} as const;

export const APP_OPEN_AD_CONFIG = {
  loadTimeoutMs: 8000,
  maxAdAgeMs: 4 * 60 * 60 * 1000,
} as const;
