jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    isConfigured: jest.fn(),
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    adTracker: { trackAdRevenue: jest.fn() },
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
  AdMediatorName: { adMob: 'admob' },
  AdRevenuePrecision: {
    exact: 'exact',
    publisherDefined: 'publisherDefined',
    estimated: 'estimated',
    unknown: 'unknown',
  },
}));

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  RevenuePrecisions: { UNKNOWN: 0, ESTIMATED: 1, PUBLISHER_PROVIDED: 2, PRECISE: 3 },
}));

import Purchases from 'react-native-purchases';
import {
  initializeRevenueCat,
  hasActiveBoost,
  getOfferings,
  purchasePackage,
  restorePurchases,
  ENTITLEMENTS,
  getCustomerInfo,
  identifyUser,
  logoutUser,
  getActiveSubscriptionInfo,
  hasAnyActiveEntitlement,
  getAllEntitlements,
  generateAdImpressionId,
  trackAdRevenue,
} from '~/utils/revenuecat';

const mockedIsConfigured = Purchases.isConfigured as jest.Mock;
const mockedConfigure = Purchases.configure as jest.Mock;
const mockedGetCustomerInfo = Purchases.getCustomerInfo as jest.Mock;
const mockedGetOfferings = Purchases.getOfferings as jest.Mock;
const mockedPurchasePackage = Purchases.purchasePackage as jest.Mock;
const mockedRestorePurchases = Purchases.restorePurchases as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initializeRevenueCat', () => {
  it('configura el SDK con una API key y el appUserID cuando no está ya configurado', async () => {
    mockedIsConfigured.mockResolvedValueOnce(false);

    await initializeRevenueCat('user-1');

    expect(mockedConfigure).toHaveBeenCalledTimes(1);
    const configArg = mockedConfigure.mock.calls[0][0];
    expect(configArg.appUserID).toBe('user-1');
    expect(typeof configArg.apiKey).toBe('string');
    expect(configArg.apiKey.length).toBeGreaterThan(0);
  });

  it('no vuelve a configurar el SDK si ya estaba configurado (evita romper la sesión activa)', async () => {
    mockedIsConfigured.mockResolvedValueOnce(true);

    await initializeRevenueCat('user-1');

    expect(mockedConfigure).not.toHaveBeenCalled();
  });

  it('propaga el error si Purchases.configure falla', async () => {
    mockedIsConfigured.mockResolvedValueOnce(false);
    mockedConfigure.mockImplementationOnce(() => {
      throw new Error('native module unavailable');
    });

    await expect(initializeRevenueCat('user-1')).rejects.toThrow('native module unavailable');
  });
});

describe('hasActiveBoost', () => {
  it('devuelve true cuando el entitlement boost_active está activo', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({
      entitlements: { active: { [ENTITLEMENTS.BOOST_ACTIVE]: {} } },
    });

    await expect(hasActiveBoost()).resolves.toBe(true);
  });

  it('devuelve false cuando no hay ningún entitlement activo', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({ entitlements: { active: {} } });

    await expect(hasActiveBoost()).resolves.toBe(false);
  });

  it('devuelve false (no lanza) si falla la consulta a RevenueCat', async () => {
    mockedGetCustomerInfo.mockRejectedValueOnce(new Error('network error'));

    await expect(hasActiveBoost()).resolves.toBe(false);
  });
});

describe('getOfferings', () => {
  it('devuelve la oferta actual cuando existe', async () => {
    const currentOffering = { identifier: 'default', availablePackages: [] };
    mockedGetOfferings.mockResolvedValueOnce({ all: {}, current: currentOffering });

    await expect(getOfferings()).resolves.toBe(currentOffering);
  });

  it('devuelve null cuando no hay oferta actual', async () => {
    mockedGetOfferings.mockResolvedValueOnce({ all: {}, current: null });

    await expect(getOfferings()).resolves.toBeNull();
  });

  it('devuelve null (no lanza) si Purchases.getOfferings falla', async () => {
    mockedGetOfferings.mockRejectedValueOnce(new Error('billing unavailable'));

    await expect(getOfferings()).resolves.toBeNull();
  });
});

describe('purchasePackage', () => {
  it('devuelve success=true y la info del cliente tras una compra correcta', async () => {
    const customerInfo = { entitlements: { active: {} } };
    mockedPurchasePackage.mockResolvedValueOnce({
      customerInfo,
      transaction: { transactionIdentifier: 'tx_1' },
    });

    const result = await purchasePackage({ identifier: 'pkg_1' } as any);

    expect(result).toEqual({
      customerInfo,
      transaction: { transactionIdentifier: 'tx_1' },
      success: true,
    });
  });

  it('relanza el error cuando la compra falla, para que el llamante pueda reaccionar', async () => {
    mockedPurchasePackage.mockRejectedValueOnce(new Error('payment declined'));

    await expect(purchasePackage({ identifier: 'pkg_1' } as any)).rejects.toThrow(
      'payment declined'
    );
  });

  it('relanza también cuando el usuario cancela, preservando el flag userCancelled', async () => {
    const cancelError = Object.assign(new Error('cancelled'), { userCancelled: true });
    mockedPurchasePackage.mockRejectedValueOnce(cancelError);

    await expect(purchasePackage({ identifier: 'pkg_1' } as any)).rejects.toMatchObject({
      userCancelled: true,
    });
  });
});

describe('restorePurchases', () => {
  it('devuelve la info del cliente restaurada', async () => {
    const customerInfo = { entitlements: { active: {} } };
    mockedRestorePurchases.mockResolvedValueOnce(customerInfo);

    await expect(restorePurchases()).resolves.toBe(customerInfo);
  });

  it('relanza el error si falla la restauración', async () => {
    mockedRestorePurchases.mockRejectedValueOnce(new Error('restore failed'));

    await expect(restorePurchases()).rejects.toThrow('restore failed');
  });
});

const mockedLogIn = Purchases.logIn as jest.Mock;
const mockedLogOut = Purchases.logOut as jest.Mock;
const mockedTrackAdRevenue = (Purchases as any).adTracker.trackAdRevenue as jest.Mock;

describe('getCustomerInfo', () => {
  it('devuelve la info del cliente', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({ originalAppUserId: 'u1' });
    await expect(getCustomerInfo()).resolves.toEqual({ originalAppUserId: 'u1' });
  });

  it('devuelve null (no lanza) si falla', async () => {
    mockedGetCustomerInfo.mockRejectedValueOnce(new Error('offline'));
    await expect(getCustomerInfo()).resolves.toBeNull();
  });
});

describe('identifyUser / logoutUser', () => {
  it('identifica al usuario con su id de Supabase', async () => {
    mockedLogIn.mockResolvedValueOnce({});
    await identifyUser('user-1');
    expect(mockedLogIn).toHaveBeenCalledWith('user-1');
  });

  it('relanza si logIn falla', async () => {
    mockedLogIn.mockRejectedValueOnce(new Error('x'));
    await expect(identifyUser('user-1')).rejects.toThrow('x');
  });

  it('hace logout en RevenueCat', async () => {
    mockedLogOut.mockResolvedValueOnce({});
    await logoutUser();
    expect(mockedLogOut).toHaveBeenCalled();
  });

  it('relanza si logOut falla (p.ej. usuario anónimo)', async () => {
    mockedLogOut.mockRejectedValueOnce(new Error('anonymous'));
    await expect(logoutUser()).rejects.toThrow('anonymous');
  });
});

describe('getActiveSubscriptionInfo', () => {
  it('isActive=false si no hay entitlements activos', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({ entitlements: { active: {}, all: {} } });
    await expect(getActiveSubscriptionInfo()).resolves.toEqual({ isActive: false });
  });

  it('devuelve los datos del primer entitlement activo', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({
      entitlements: {
        active: {
          boost_active: {
            productIdentifier: 'boost_1m_v2',
            expirationDate: '2026-11-06T00:00:00Z',
            willRenew: true,
          },
        },
      },
    });
    await expect(getActiveSubscriptionInfo()).resolves.toEqual({
      isActive: true,
      productIdentifier: 'boost_1m_v2',
      expirationDate: '2026-11-06T00:00:00Z',
      willRenew: true,
    });
  });

  it('expirationDate null (lifetime) se devuelve como undefined', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({
      entitlements: {
        active: {
          lifetime: { productIdentifier: 'lifetime', expirationDate: null, willRenew: false },
        },
      },
    });
    const info = await getActiveSubscriptionInfo();
    expect(info?.expirationDate).toBeUndefined();
  });

  it('devuelve null si falla', async () => {
    mockedGetCustomerInfo.mockRejectedValueOnce(new Error('x'));
    await expect(getActiveSubscriptionInfo()).resolves.toBeNull();
  });
});

describe('hasAnyActiveEntitlement / getAllEntitlements', () => {
  it('true si hay algún entitlement activo', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({ entitlements: { active: { a: {} } } });
    await expect(hasAnyActiveEntitlement()).resolves.toBe(true);
  });

  it('false si no hay o si falla', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({ entitlements: { active: {} } });
    await expect(hasAnyActiveEntitlement()).resolves.toBe(false);
    mockedGetCustomerInfo.mockRejectedValueOnce(new Error('x'));
    await expect(hasAnyActiveEntitlement()).resolves.toBe(false);
  });

  it('getAllEntitlements devuelve todos o {} si falla', async () => {
    mockedGetCustomerInfo.mockResolvedValueOnce({ entitlements: { all: { a: 1, b: 2 } } });
    await expect(getAllEntitlements()).resolves.toEqual({ a: 1, b: 2 });
    mockedGetCustomerInfo.mockRejectedValueOnce(new Error('x'));
    await expect(getAllEntitlements()).resolves.toEqual({});
  });
});

describe('generateAdImpressionId', () => {
  it('genera ids distintos con formato timestamp-random', () => {
    const ids = new Set(Array.from({ length: 50 }, generateAdImpressionId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });
});

describe('trackAdRevenue', () => {
  const base = { adUnitId: 'unit-1', adFormat: 'banner', placement: 'map', impressionId: 'imp-1' };

  it('convierte el valor a micros y mapea la precisión de AdMob a RevenueCat', async () => {
    await trackAdRevenue({
      ...base,
      event: { value: 0.0123, currency: 'EUR', precision: 3 } as any,
    });
    expect(mockedTrackAdRevenue).toHaveBeenCalledWith(
      expect.objectContaining({
        revenueMicros: 12300,
        currency: 'EUR',
        precision: 'exact',
        adUnitId: 'unit-1',
        impressionId: 'imp-1',
        placement: 'map',
      })
    );
  });

  it('usa precisión unknown si AdMob manda un valor desconocido', async () => {
    await trackAdRevenue({ ...base, event: { value: 1, currency: 'USD', precision: 99 } as any });
    expect(mockedTrackAdRevenue.mock.calls[0][0].precision).toBe('unknown');
  });

  it('no lanza si RevenueCat falla (no debe romper el anuncio)', async () => {
    mockedTrackAdRevenue.mockRejectedValueOnce(new Error('x'));
    await expect(
      trackAdRevenue({ ...base, event: { value: 1, currency: 'USD', precision: 1 } as any })
    ).resolves.toBeUndefined();
  });
});
