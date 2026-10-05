import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');

  let lastModalProps: any = null;

  const BottomSheetModal = ReactActual.forwardRef((props: any, ref: any) => {
    lastModalProps = props;
    ReactActual.useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    return ReactActual.createElement(View, { testID: 'boost-paywall-sheet' }, props.children);
  });

  const BottomSheetScrollView = ({ children, ...props }: any) =>
    ReactActual.createElement(View, props, children);

  const BottomSheetBackdrop = () => null;

  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetScrollView,
    BottomSheetBackdrop,
    __getLastBottomSheetModalProps: () => lastModalProps,
  };
});

jest.mock('~/hooks/useBoostOfferings');

import { useBoostOfferings, type BoostPackageInfo } from '~/hooks/useBoostOfferings';
import BoostPaywallSheet from '~/components/boost/BoostPaywallSheet';

const { __getLastBottomSheetModalProps } = jest.requireMock('@gorhom/bottom-sheet');
const mockedUseBoostOfferings = useBoostOfferings as jest.Mock;

const PACKAGE_1M: BoostPackageInfo = {
  pkg: { identifier: 'boost_1m_v2_pkg', product: { identifier: 'boost_1m_v2' } } as any,
  plan: '1m',
  title: 'Boost Mensual',
  price: '19,99 €',
  isPopular: true,
  duration: '1 mes',
  amortization: 'Se amortiza con solo 5 clientes nuevos',
  icon: 'trending-up',
  buttonColors: ['#D4AF37', '#B8956A'],
};

function baseHookState(overrides: Partial<ReturnType<typeof useBoostOfferings>> = {}) {
  return {
    packages: [],
    isLoading: false,
    error: null,
    purchaseBoost: jest.fn().mockResolvedValue(true),
    isPurchasing: false,
    purchasingId: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseBoostOfferings.mockReturnValue(baseHookState());
});

describe('BoostPaywallSheet - configuración del bottom sheet', () => {
  it('deshabilita explícitamente el dynamic sizing para no romper el snap point fijo del 95%', async () => {
    await render(
      <BoostPaywallSheet isVisible userId="user-1" barId="bar-1" onClose={jest.fn()} />
    );

    const props = __getLastBottomSheetModalProps();
    expect(props.enableDynamicSizing).toBe(false);
    expect(props.snapPoints).toEqual(['95%']);
  });

  it('presenta el sheet cuando isVisible es true', async () => {
    await render(
      <BoostPaywallSheet isVisible userId="user-1" barId="bar-1" onClose={jest.fn()} />
    );

    expect(mockPresent).toHaveBeenCalled();
  });

  it('cierra el sheet cuando isVisible pasa a false', async () => {
    const { rerender } = await render(
      <BoostPaywallSheet isVisible userId="user-1" barId="bar-1" onClose={jest.fn()} />
    );

    await rerender(
      <BoostPaywallSheet isVisible={false} userId="user-1" barId="bar-1" onClose={jest.fn()} />
    );

    expect(mockDismiss).toHaveBeenCalled();
  });
});

describe('BoostPaywallSheet - estados de carga', () => {
  it('muestra el indicador de carga mientras se obtienen las ofertas', async () => {
    mockedUseBoostOfferings.mockReturnValue(baseHookState({ isLoading: true }));

    const { getByText, queryByText } = await render(
      <BoostPaywallSheet isVisible userId="user-1" barId="bar-1" onClose={jest.fn()} />
    );

    expect(getByText('Cargando productos...')).toBeTruthy();
    expect(queryByText('Activar Boost')).toBeNull();
  });

  it('muestra un mensaje de error si fallan las ofertas, sin romper el resto del sheet', async () => {
    mockedUseBoostOfferings.mockReturnValue(
      baseHookState({ error: new Error('No hay ofertas disponibles') })
    );

    const { getByText, queryByText } = await render(
      <BoostPaywallSheet isVisible userId="user-1" barId="bar-1" onClose={jest.fn()} />
    );

    expect(getByText('No se han podido cargar los productos. Comprueba la conexión.')).toBeTruthy();
    expect(queryByText('Activar Boost')).toBeNull();
  });

  it('muestra los planes con su precio cuando la carga es correcta', async () => {
    mockedUseBoostOfferings.mockReturnValue(baseHookState({ packages: [PACKAGE_1M] }));

    const { getByText } = await render(
      <BoostPaywallSheet isVisible userId="user-1" barId="bar-1" onClose={jest.fn()} />
    );

    expect(getByText('Boost Mensual')).toBeTruthy();
    expect(getByText('19,99 €')).toBeTruthy();
    expect(getByText('Activar Boost')).toBeTruthy();
  });
});

describe('BoostPaywallSheet - flujo de compra', () => {
  it('al pulsar "Activar Boost" compra el paquete correcto y, si tiene éxito, cierra el sheet y avisa', async () => {
    const purchaseBoost = jest.fn().mockResolvedValue(true);
    const onPurchaseComplete = jest.fn();
    mockedUseBoostOfferings.mockReturnValue(
      baseHookState({ packages: [PACKAGE_1M], purchaseBoost })
    );

    const { getByText } = await render(
      <BoostPaywallSheet
        isVisible
        userId="user-1"
        barId="bar-1"
        onClose={jest.fn()}
        onPurchaseComplete={onPurchaseComplete}
      />
    );

    await fireEvent.press(getByText('Activar Boost'));

    expect(purchaseBoost).toHaveBeenCalledWith(PACKAGE_1M.pkg, 'bar-1', 'user-1');
    expect(mockDismiss).toHaveBeenCalled();
    expect(onPurchaseComplete).toHaveBeenCalled();
  });

  it('si la compra no tiene éxito, no cierra el sheet ni notifica onPurchaseComplete', async () => {
    const purchaseBoost = jest.fn().mockResolvedValue(false);
    const onPurchaseComplete = jest.fn();
    mockedUseBoostOfferings.mockReturnValue(
      baseHookState({ packages: [PACKAGE_1M], purchaseBoost })
    );

    const { getByText } = await render(
      <BoostPaywallSheet
        isVisible
        userId="user-1"
        barId="bar-1"
        onClose={jest.fn()}
        onPurchaseComplete={onPurchaseComplete}
      />
    );

    mockDismiss.mockClear(); // ignora la llamada a dismiss del present() inicial

    await fireEvent.press(getByText('Activar Boost'));

    expect(purchaseBoost).toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(onPurchaseComplete).not.toHaveBeenCalled();
  });
});
