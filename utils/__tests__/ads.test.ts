jest.mock('react-native-google-mobile-ads', () => {
  const AdEventType = { LOADED: 'loaded', ERROR: 'error' };
  const TestIds = { ADAPTIVE_BANNER: 'test-banner', APP_OPEN: 'test-app-open' };
  const mockInitialize = jest.fn(() => Promise.resolve());
  const mobileAds = jest.fn(() => ({ initialize: mockInitialize }));
  const createForAdRequest = jest.fn();

  return {
    __esModule: true,
    default: mobileAds,
    AppOpenAd: { createForAdRequest },
    AdEventType,
    TestIds,
  };
});

jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}));

import { Platform } from 'react-native';
import mobileAds, { AppOpenAd } from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import {
  hasShownAppOpenAdThisSession,
  markAppOpenAdShown,
  initializeAdsSDK,
  loadAndShowAppOpenAdOnce,
} from '~/utils/ads';

function createMockAd() {
  const listeners: Record<string, Array<(payload?: any) => void>> = {};
  return {
    addAdEventListener: jest.fn((event: string, cb: (payload?: any) => void) => {
      (listeners[event] ??= []).push(cb);
      return jest.fn();
    }),
    load: jest.fn(),
    show: jest.fn(),
    __trigger(event: string, payload?: any) {
      (listeners[event] ?? []).forEach((cb) => cb(payload));
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Se ejecuta primero a propósito: appOpenAdShownThisSession es un flag de
// módulo (no un estado de React) que persiste entre tests de este archivo.
describe('hasShownAppOpenAdThisSession / markAppOpenAdShown', () => {
  it('empieza en false y pasa a true tras markAppOpenAdShown', () => {
    expect(hasShownAppOpenAdThisSession()).toBe(false);

    markAppOpenAdShown();

    expect(hasShownAppOpenAdThisSession()).toBe(true);
  });
});

describe('initializeAdsSDK', () => {
  it('inicializa el SDK de anuncios', async () => {
    await initializeAdsSDK();

    expect(mobileAds).toHaveBeenCalled();
    expect(mobileAds().initialize).toHaveBeenCalled();
  });

  it('pide permiso de tracking (ATT) en iOS antes de inicializar', async () => {
    Platform.OS = 'ios';

    await initializeAdsSDK();

    expect(requestTrackingPermissionsAsync).toHaveBeenCalled();
  });

  it('no pide permiso de tracking en Android', async () => {
    Platform.OS = 'android';

    await initializeAdsSDK();

    expect(requestTrackingPermissionsAsync).not.toHaveBeenCalled();

    Platform.OS = 'ios';
  });

  it('no falla si el permiso de tracking lanza un error', async () => {
    Platform.OS = 'ios';
    (requestTrackingPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('denied'));

    await expect(initializeAdsSDK()).resolves.toBeUndefined();
  });
});

describe('loadAndShowAppOpenAdOnce', () => {
  it('carga y muestra el anuncio cuando se recibe el evento LOADED', async () => {
    const mockAd = createMockAd();
    mockAd.load.mockImplementation(() => mockAd.__trigger('loaded'));
    (AppOpenAd.createForAdRequest as jest.Mock).mockReturnValue(mockAd);

    await loadAndShowAppOpenAdOnce({ timeoutMs: 1000 });

    expect(mockAd.load).toHaveBeenCalled();
    expect(mockAd.show).toHaveBeenCalled();
  });

  it('rechaza con el error recibido en el evento ERROR, sin mostrar el anuncio', async () => {
    const mockAd = createMockAd();
    const adError = new Error('failed to load ad');
    mockAd.load.mockImplementation(() => mockAd.__trigger('error', adError));
    (AppOpenAd.createForAdRequest as jest.Mock).mockReturnValue(mockAd);

    await expect(loadAndShowAppOpenAdOnce({ timeoutMs: 1000 })).rejects.toBe(adError);
    expect(mockAd.show).not.toHaveBeenCalled();
  });

  it('rechaza por timeout si no llega ningún evento a tiempo', async () => {
    jest.useFakeTimers();
    const mockAd = createMockAd();
    (AppOpenAd.createForAdRequest as jest.Mock).mockReturnValue(mockAd);

    const promise = loadAndShowAppOpenAdOnce({ timeoutMs: 1000 });
    const expectation = expect(promise).rejects.toThrow('App Open Ad load timeout');

    await jest.advanceTimersByTimeAsync(1000);
    await expectation;
    expect(mockAd.show).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
