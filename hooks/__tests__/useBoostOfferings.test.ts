import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    setAttributes: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('~/components/ds', () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

import Purchases from 'react-native-purchases';
import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';
import {
  useBoostOfferings,
  getCustomersToBreakEven,
  getYearlySavingsPercent,
} from '~/hooks/useBoostOfferings';

const mockedGetOfferings = Purchases.getOfferings as jest.Mock;
const mockedPurchasePackage = Purchases.purchasePackage as jest.Mock;
const mockedSetAttributes = Purchases.setAttributes as jest.Mock;
const mockedFrom = supabase.from as jest.Mock;

function makePackage(productId: string, overrides: Partial<any> = {}) {
  return {
    identifier: `${productId}_pkg`,
    packageType: 'CUSTOM',
    product: {
      identifier: productId,
      priceString: '4,99 €',
      price: 4.99,
      currencyCode: 'EUR',
      title: 'Boost',
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBoostOfferings - carga de ofertas', () => {
  it('mapea y ordena los paquetes 7d, 1m, 1y aunque lleguen desordenados', async () => {
    mockedGetOfferings.mockResolvedValueOnce({
      current: {
        availablePackages: [
          makePackage('boost_1y_v2'),
          makePackage('boost_7d_v2'),
          makePackage('boost_1m_v2'),
        ],
      },
    });

    const { result } = await renderHook(() => useBoostOfferings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.packages.map((p) => p.plan)).toEqual(['7d', '1m', '1y']);
    expect(result.current.packages.find((p) => p.plan === '1m')?.isPopular).toBe(true);
    expect(result.current.packages.find((p) => p.plan === '7d')?.isPopular).toBe(false);
  });

  it('calcula el ahorro anual y el precio mensual equivalente a partir de los precios reales', async () => {
    mockedGetOfferings.mockResolvedValueOnce({
      current: {
        availablePackages: [
          makePackage('boost_1m_v2', { price: 20, priceString: '20,00 €' }),
          makePackage('boost_1y_v2', { price: 120, priceString: '120,00 €' }),
        ],
      },
    });

    const { result } = await renderHook(() => useBoostOfferings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const yearly = result.current.packages.find((p) => p.plan === '1y');
    expect(yearly?.savingsBadge).toBe('Ahorra 50%');
    expect(yearly?.pricePerMonth).toMatch(/^10,00\s?€\/mes$/);
    expect(result.current.packages.find((p) => p.plan === '1m')?.savingsBadge).toBeUndefined();
  });

  it('ignora paquetes cuyo product id no corresponde a ningún plan de boost', async () => {
    mockedGetOfferings.mockResolvedValueOnce({
      current: {
        availablePackages: [makePackage('lifetime'), makePackage('boost_1m_v2')],
      },
    });

    const { result } = await renderHook(() => useBoostOfferings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.packages).toHaveLength(1);
    expect(result.current.packages[0].plan).toBe('1m');
  });

  it('asigna error cuando no hay ninguna oferta actual configurada', async () => {
    mockedGetOfferings.mockResolvedValueOnce({ current: null });

    const { result } = await renderHook(() => useBoostOfferings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.packages).toEqual([]);
  });

  it('asigna error cuando Purchases.getOfferings lanza una excepción', async () => {
    mockedGetOfferings.mockRejectedValueOnce(new Error('Billing unavailable'));

    const { result } = await renderHook(() => useBoostOfferings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.packages).toEqual([]);
  });
});

describe('useBoostOfferings - purchaseBoost', () => {
  beforeEach(() => {
    mockedGetOfferings.mockResolvedValue({ current: { availablePackages: [] } });
  });

  it('compra correctamente, fija el bar en RevenueCat y registra el boost como pending', async () => {
    mockedPurchasePackage.mockResolvedValueOnce({
      transaction: { transactionIdentifier: 'tx_123' },
    });
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() => useBoostOfferings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const pkg = makePackage('boost_1m_v2', { price: 19.99, currencyCode: 'EUR' });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.purchaseBoost(pkg as any, 'bar-1', 'user-1');
    });

    expect(success).toBe(true);
    expect(mockedPurchasePackage).toHaveBeenCalledWith(pkg);
    expect(mockedSetAttributes).toHaveBeenCalledWith({ boost_bar_id: 'bar-1' });
    expect(mockedSetAttributes.mock.invocationCallOrder[0]).toBeLessThan(
      mockedPurchasePackage.mock.invocationCallOrder[0]
    );
    expect(mockedFrom).toHaveBeenCalledWith('bar_boosts');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        bar_id: 'bar-1',
        user_id: 'user-1',
        plan: '1m',
        status: 'pending',
        amount_cents: 1999,
        currency: 'eur',
        revenuecat_transaction_id: 'tx_123',
      }),
      // Si el webhook ya activó la fila, no se pisa con 'pending'
      { onConflict: 'revenuecat_transaction_id', ignoreDuplicates: true }
    );
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('si falla el registro tras un pago correcto, no alarma al usuario (lo activa el webhook)', async () => {
    mockedPurchasePackage.mockResolvedValueOnce({ transaction: null });
    const builder = createQueryBuilderMock({ data: null, error: { message: 'insert failed' } });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() => useBoostOfferings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean = false;
    await act(async () => {
      success = await result.current.purchaseBoost(makePackage('boost_7d_v2') as any, 'bar-1', 'user-1');
    });

    // El pago ya se realizó y el webhook activa el boost con boost_bar_id.
    expect(success).toBe(true);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('si falla setAttributes, la compra continúa igualmente', async () => {
    mockedSetAttributes.mockRejectedValueOnce(new Error('attr failed'));
    mockedPurchasePackage.mockResolvedValueOnce({ transaction: { transactionIdentifier: 'tx_9' } });
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const { result } = await renderHook(() => useBoostOfferings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean = false;
    await act(async () => {
      success = await result.current.purchaseBoost(makePackage('boost_7d_v2') as any, 'bar-1', 'user-1');
    });

    expect(success).toBe(true);
    expect(mockedPurchasePackage).toHaveBeenCalled();
  });

  it('no llama a Purchases.purchasePackage si el product id no es un plan de boost válido', async () => {
    const { result } = await renderHook(() => useBoostOfferings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.purchaseBoost(makePackage('unknown_product') as any, 'bar-1', 'user-1');
    });

    expect(success).toBe(false);
    expect(mockedPurchasePackage).not.toHaveBeenCalled();
  });

  it('si el usuario cancela la compra, no muestra ningún toast de error', async () => {
    mockedPurchasePackage.mockRejectedValueOnce({ userCancelled: true });

    const { result } = await renderHook(() => useBoostOfferings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.purchaseBoost(makePackage('boost_1y_v2') as any, 'bar-1', 'user-1');
    });

    expect(success).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('si la compra falla por un error real, muestra un toast de error y devuelve false', async () => {
    mockedPurchasePackage.mockRejectedValueOnce(new Error('network error'));

    const { result } = await renderHook(() => useBoostOfferings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.purchaseBoost(makePackage('boost_1y_v2') as any, 'bar-1', 'user-1');
    });

    expect(success).toBe(false);
    expect(toast.error).toHaveBeenCalled();
    expect(mockedFrom).not.toHaveBeenCalled();
  });
});

describe('useBoostOfferings - helpers de precio', () => {
  it('getCustomersToBreakEven redondea hacia arriba con un mínimo de 1', () => {
    expect(getCustomersToBreakEven(4.99)).toBe(1);
    expect(getCustomersToBreakEven(19.99)).toBe(2);
    expect(getCustomersToBreakEven(26)).toBe(2);
    expect(getCustomersToBreakEven(26.01)).toBe(3);
  });

  it('getYearlySavingsPercent compara con 12 meses sueltos y no muestra ahorros negativos', () => {
    expect(getYearlySavingsPercent(120, 20)).toBe(50);
    expect(getYearlySavingsPercent(300, 20)).toBeNull();
    expect(getYearlySavingsPercent(120, 0)).toBeNull();
  });
});
