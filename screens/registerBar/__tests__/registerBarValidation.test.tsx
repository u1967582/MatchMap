import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

jest.mock('~/utils/supabase');
jest.mock('expo-location', () => ({}));
jest.mock('~/components/AddressSearch', () => () => null);
jest.mock('~/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [{ id: '3', name: 'Pub' }],
    loading: false,
    error: null,
    usingFallback: false,
    refetch: jest.fn(),
  }),
}));

import { useBarRegisterStore } from '~/stores/barRegisterStore';
import Step1GeneralInfo from '~/screens/registerBar/Step1GeneralInfo';
import Step3Location from '~/screens/registerBar/Step3Location';

// eslint-disable-next-line react-hooks/rules-of-hooks
const mockedRouter = useRouter();

beforeEach(() => {
  jest.clearAllMocks();
  useBarRegisterStore.getState().resetForm();
});

describe('Registro de bar - paso 1 (información general)', () => {
  it('no avanza y muestra errores si faltan campos obligatorios', async () => {
    await render(<Step1GeneralInfo />);
    await fireEvent.press(screen.getByText('Siguiente'));

    expect(screen.getByText('El nombre del bar es requerido')).toBeTruthy();
    expect(screen.getByText('La descripción es requerida')).toBeTruthy();
    expect(screen.getByText('El teléfono es requerido')).toBeTruthy();
    expect(screen.getByText('Selecciona una categoría')).toBeTruthy();
    expect(mockedRouter.push).not.toHaveBeenCalled();
  });

  it('avanza al paso 2 con los datos completos', async () => {
    const s = useBarRegisterStore.getState();
    s.setField('name', 'Bar Pepe');
    s.setField('description', 'Fútbol y tapas');
    s.setField('phone', '+34 600 000 000');
    s.setField('categoryId', '3');

    await render(<Step1GeneralInfo />);
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(mockedRouter.push).toHaveBeenCalledWith('/register-bar/step2');
  });

  it('en registro en frío exige un email de propietario válido', async () => {
    const s = useBarRegisterStore.getState();
    s.setField('name', 'Bar Pepe');
    s.setField('description', 'x');
    s.setField('phone', '1');
    s.setField('categoryId', '3');
    s.setField('email', 'no-es-email');

    await render(<Step1GeneralInfo isAutoPreRegister />);
    await waitFor(() => expect(useBarRegisterStore.getState().isAutoPreRegister).toBe(true));
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(screen.getByText('El email no es válido')).toBeTruthy();
    expect(mockedRouter.push).not.toHaveBeenCalled();

    await fireEvent.changeText(
      screen.getByPlaceholderText('propietario@ejemplo.com'),
      'dueno@bar.com'
    );
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(mockedRouter.push).toHaveBeenCalledWith('/register-bar/step2?mode=auto_pre_register');
  });
});

describe('Registro de bar - paso 3 (ubicación)', () => {
  const fillValidAddress = () => {
    const s = useBarRegisterStore.getState();
    s.setField('address', 'Carrer Major 1');
    s.setField('city', 'Barcelona');
    s.setField('latitude', 41.38);
    s.setField('longitude', 2.17);
  };

  it('exige dirección, ciudad y código postal', async () => {
    await render(<Step3Location />);
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(screen.getByText('La dirección es requerida')).toBeTruthy();
    expect(screen.getByText('La ciudad es requerida')).toBeTruthy();
    expect(screen.getByText('El código postal es requerido')).toBeTruthy();
    expect(mockedRouter.push).not.toHaveBeenCalled();
  });

  it.each(['0800', '080011', 'ABCDE'])('rechaza el código postal "%s"', async (cp) => {
    fillValidAddress();
    useBarRegisterStore.getState().setField('postalCode', cp);
    await render(<Step3Location />);
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(screen.getByText('El código postal debe tener 5 dígitos')).toBeTruthy();
    expect(mockedRouter.push).not.toHaveBeenCalled();
  });

  it('avanza con una dirección válida', async () => {
    fillValidAddress();
    useBarRegisterStore.getState().setField('postalCode', '08001');
    await render(<Step3Location />);
    await fireEvent.press(screen.getByText('Siguiente'));
    expect(mockedRouter.push).toHaveBeenCalled();
  });
});
