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
    mockedPurchasePackage.mockResolvedValueOnce({ customerInfo, transaction: { transactionIdentifier: 'tx_1' } });

    const result = await purchasePackage({ identifier: 'pkg_1' } as any);

    expect(result).toEqual({
      customerInfo,
      transaction: { transactionIdentifier: 'tx_1' },
      success: true,
    });
  });

  it('relanza el error cuando la compra falla, para que el llamante pueda reaccionar', async () => {
    mockedPurchasePackage.mockRejectedValueOnce(new Error('payment declined'));

    await expect(purchasePackage({ identifier: 'pkg_1' } as any)).rejects.toThrow('payment declined');
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
