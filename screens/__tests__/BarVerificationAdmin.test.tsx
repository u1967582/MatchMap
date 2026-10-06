import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('~/utils/supabase');
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('~/services/bars', () => ({ approveBars: jest.fn() }));

import { createQueryBuilderMock } from '../../test-utils/mockSupabase';
import { supabase } from '~/utils/supabase';
import { approveBars } from '~/services/bars';
import BarVerificationAdminScreen from '~/app/bar-verification-admin';

const mockedFrom = supabase.from as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;
const mockedApproveBars = approveBars as jest.Mock;

const OWNERLESS_BARS = [
  {
    id: 'bar-1',
    name: 'Bar Uno',
    address: 'Calle 1',
    city: 'madrid',
    created_at: null,
    bar_images: [],
  },
  {
    id: 'bar-2',
    name: 'Bar Dos',
    address: 'Calle 2',
    city: 'madrid',
    created_at: null,
    bar_images: [],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
  mockedFrom.mockImplementation((table: string) => {
    if (table === 'users')
      return createQueryBuilderMock({ data: { is_super_user: true }, error: null });
    if (table === 'bars') return createQueryBuilderMock({ data: OWNERLESS_BARS, error: null });
    return createQueryBuilderMock({ data: [], error: null });
  });
});

const renderScreen = async () => {
  const utils = await render(<BarVerificationAdminScreen />);
  await waitFor(() => expect(utils.getByText('Bar Uno')).toBeTruthy());
  return utils;
};

describe('BarVerificationAdminScreen - aprobación por lotes', () => {
  it('muestra por defecto los bares sin dueño con la pista de selección', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Bar Dos')).toBeTruthy();
    expect(getByText(/Mantén pulsado un bar/)).toBeTruthy();
  });

  it('mantener pulsado entra en modo selección y aprueba tras confirmar', async () => {
    mockedApproveBars.mockResolvedValueOnce(['bar-1', 'bar-2']);
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) => buttons?.[1]?.onPress?.());

    const { getByText, queryByText } = await renderScreen();

    fireEvent(getByText('Bar Uno'), 'longPress');
    await waitFor(() => expect(getByText('1 seleccionado')).toBeTruthy());

    // En modo selección, un toque normal también selecciona
    fireEvent.press(getByText('Bar Dos'));
    await waitFor(() => expect(getByText('2 seleccionados')).toBeTruthy());

    fireEvent.press(getByText('Aprobar 2'));

    await waitFor(() => expect(mockedApproveBars).toHaveBeenCalledWith(['bar-1', 'bar-2']));
    expect(alertSpy).toHaveBeenCalledWith('Aprobar 2 bares', expect.any(String), expect.any(Array));
    await waitFor(() => expect(queryByText('Bar Uno')).toBeNull());
    alertSpy.mockRestore();
  });

  it('no aprueba nada si se cancela la confirmación', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _msg, buttons) => buttons?.[0]?.onPress?.());

    const { getByText } = await renderScreen();
    fireEvent(getByText('Bar Uno'), 'longPress');
    await waitFor(() => expect(getByText('Aprobar 1')).toBeTruthy());
    fireEvent.press(getByText('Aprobar 1'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockedApproveBars).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('"Seleccionar los N cargados" selecciona toda la lista', async () => {
    const { getByText } = await renderScreen();

    fireEvent(getByText('Bar Uno'), 'longPress');
    await waitFor(() => expect(getByText('Seleccionar los 2 cargados')).toBeTruthy());
    fireEvent.press(getByText('Seleccionar los 2 cargados'));

    await waitFor(() => expect(getByText('Aprobar 2')).toBeTruthy());
  });
});
