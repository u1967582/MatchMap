jest.mock('react-native-google-mobile-ads', () => {
  const AdEventType = { LOADED: 'loaded', ERROR: 'error', PAID: 'paid' };
  const RevenuePrecisions = { UNKNOWN: 0, ESTIMATED: 1, PUBLISHER_PROVIDED: 2, PRECISE: 3 };
  const TestIds = { ADAPTIVE_BANNER: 'test-banner', APP_OPEN: 'test-app-open' };
  const mockInitialize = jest.fn(() => Promise.resolve());
  const mobileAds = jest.fn(() => ({ initialize: mockInitialize }));
  const createForAdRequest = jest.fn();
  const gatherConsent = jest.fn(() => Promise.resolve());
  const getConsentInfo = jest.fn(() =>
    Promise.resolve({ canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' })
  );
  const showPrivacyOptionsForm = jest.fn(() => Promise.resolve({ canRequestAds: true }));
  const AdsConsentPrivacyOptionsRequirementStatus = {
    UNKNOWN: 'UNKNOWN',
    REQUIRED: 'REQUIRED',
    NOT_REQUIRED: 'NOT_REQUIRED',
  };

  return {
    __esModule: true,
    default: mobileAds,
    AppOpenAd: { createForAdRequest },
    AdEventType,
    RevenuePrecisions,
    TestIds,
    AdsConsent: { gatherConsent, getConsentInfo, showPrivacyOptionsForm },
    AdsConsentPrivacyOptionsRequirementStatus,
  };
});

jest.mock('~/utils/revenuecat', () => ({
  generateAdImpressionId: jest.fn(() => 'test-impression-id'),
  trackAdRevenue: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}));

import { AppState, Platform } from 'react-native';
import mobileAds, { AppOpenAd, AdsConsent } from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import {
  hasShownAppOpenAdThisSession,
  markAppOpenAdShown,
  initializeAdsSDK,
  isAdsPrivacyOptionsRequired,
  loadAndShowAppOpenAdOnce,
  showAdsPrivacyOptions,
  waitForAppActive,
} from '~/utils/ads';

type AppStateListener = (state: string) => void;

/** Simula AppState: estado actual configurable y emisión manual de eventos. */
function mockAppState(initial: string) {
  const listeners: AppStateListener[] = [];
  const remove = jest.fn();
  Object.defineProperty(AppState, 'currentState', { value: initial, configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _: string,
    cb: AppStateListener
  ) => {
    listeners.push(cb);
    return { remove };
  }) as any);
  return {
    remove,
    emit(state: string) {
      Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });
      listeners.forEach((cb) => cb(state));
    },
  };
}

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
  mockAppState('active');
});

afterEach(() => {
  jest.restoreAllMocks();
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
  it('pide consentimiento GDPR/UMP antes de inicializar el SDK', async () => {
    await initializeAdsSDK();

    expect(AdsConsent.gatherConsent).toHaveBeenCalled();
    expect(AdsConsent.getConsentInfo).toHaveBeenCalled();
    expect(mobileAds).toHaveBeenCalled();
    expect(mobileAds().initialize).toHaveBeenCalled();
  });

  it('devuelve true cuando el SDK se inicializa', async () => {
    await expect(initializeAdsSDK()).resolves.toBe(true);
  });

  it('no inicializa el SDK si canRequestAds es false', async () => {
    (AdsConsent.getConsentInfo as jest.Mock).mockResolvedValueOnce({ canRequestAds: false });

    await expect(initializeAdsSDK()).resolves.toBe(false);

    expect(mobileAds().initialize).not.toHaveBeenCalled();
  });

  it('sigue comprobando canRequestAds aunque gatherConsent falle', async () => {
    (AdsConsent.gatherConsent as jest.Mock).mockRejectedValueOnce(new Error('network error'));

    await expect(initializeAdsSDK()).resolves.toBe(true);
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

    await expect(initializeAdsSDK()).resolves.toBe(true);
  });
});

describe('waitForAppActive', () => {
  it('resuelve inmediatamente si la app ya está activa', async () => {
    mockAppState('active');
    await expect(waitForAppActive()).resolves.toBeUndefined();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('espera al evento active si la app está inactiva', async () => {
    const appState = mockAppState('inactive');
    let resolved = false;
    const promise = waitForAppActive().then(() => {
      resolved = true;
    });

    appState.emit('background');
    await Promise.resolve();
    expect(resolved).toBe(false);

    appState.emit('active');
    await promise;
    expect(resolved).toBe(true);
    expect(appState.remove).toHaveBeenCalled();
  });
});

describe('ATT en iOS', () => {
  it('no pide ATT hasta que la app está activa (si no, iOS no muestra el diálogo)', async () => {
    Platform.OS = 'ios';
    const appState = mockAppState('inactive');

    const promise = initializeAdsSDK();
    await new Promise((r) => setImmediate(r));
    expect(requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(mobileAds().initialize).not.toHaveBeenCalled();

    appState.emit('active');
    await expect(promise).resolves.toBe(true);
    expect(requestTrackingPermissionsAsync).toHaveBeenCalled();
  });

  it('pide ATT después del consentimiento UMP y antes de inicializar el SDK', async () => {
    Platform.OS = 'ios';
    const order: string[] = [];
    (AdsConsent.gatherConsent as jest.Mock).mockImplementationOnce(async () => {
      order.push('ump');
    });
    (requestTrackingPermissionsAsync as jest.Mock).mockImplementationOnce(async () => {
      order.push('att');
      return { status: 'denied' };
    });
    (mobileAds().initialize as jest.Mock).mockImplementationOnce(async () => {
      order.push('init');
    });

    await initializeAdsSDK();

    expect(order).toEqual(['ump', 'att', 'init']);
  });
});

describe('isAdsPrivacyOptionsRequired', () => {
  it('true si UMP marca las opciones de privacidad como obligatorias (EEE/UK)', async () => {
    (AdsConsent.getConsentInfo as jest.Mock).mockResolvedValueOnce({
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });
    await expect(isAdsPrivacyOptionsRequired()).resolves.toBe(true);
  });

  it('false fuera del EEE', async () => {
    await expect(isAdsPrivacyOptionsRequired()).resolves.toBe(false);
  });

  it('false si la consulta falla', async () => {
    (AdsConsent.getConsentInfo as jest.Mock).mockRejectedValueOnce(new Error('native'));
    await expect(isAdsPrivacyOptionsRequired()).resolves.toBe(false);
  });
});

describe('showAdsPrivacyOptions', () => {
  it('abre el formulario de UMP y devuelve canRequestAds', async () => {
    (AdsConsent.showPrivacyOptionsForm as jest.Mock).mockResolvedValueOnce({
      canRequestAds: false,
    });
    await expect(showAdsPrivacyOptions()).resolves.toBe(false);
    expect(AdsConsent.showPrivacyOptionsForm).toHaveBeenCalled();
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
