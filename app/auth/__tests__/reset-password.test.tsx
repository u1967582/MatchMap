import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

jest.mock('~/utils/supabase');
jest.mock('~/utils/auth', () => ({ updatePassword: jest.fn() }));

import { supabase } from '~/utils/supabase';
import { updatePassword } from '~/utils/auth';
import ResetPasswordScreen from '~/app/auth/reset-password';

const mockedSupabase = supabase as any;
const mockedUpdatePassword = updatePassword as jest.Mock;
// eslint-disable-next-line react-hooks/rules-of-hooks
const mockedRouter = useRouter();

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function renderWithSession() {
  mockedSupabase.auth.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'u1', email: 'a@b.com' } } },
  });
  const utils = await render(<ResetPasswordScreen />);
  await waitFor(() => expect(utils.getByPlaceholderText('Nueva contraseña')).toBeTruthy());
  return utils;
}

describe('ResetPasswordScreen', () => {
  it('sin sesión (link caducado) avisa y vuelve al inicio', async () => {
    await render(<ResetPasswordScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Link Inválido');
    alertSpy.mock.calls[0][2][0].onPress();
    expect(mockedRouter.replace).toHaveBeenCalledWith('/');
  });

  it('no actualiza si las contraseñas no coinciden o son cortas', async () => {
    const { getByPlaceholderText, getByText } = await renderWithSession();
    await fireEvent.changeText(getByPlaceholderText('Nueva contraseña'), '123');
    await fireEvent.changeText(getByPlaceholderText('Confirmar contraseña'), '123');
    await fireEvent.press(getByText('Actualizar Contraseña'));

    await fireEvent.changeText(getByPlaceholderText('Nueva contraseña'), '123456');
    await fireEvent.changeText(getByPlaceholderText('Confirmar contraseña'), '1234567');
    await fireEvent.press(getByText('Actualizar Contraseña'));

    expect(mockedUpdatePassword).not.toHaveBeenCalled();
  });

  it('actualiza la contraseña, cierra sesión y vuelve al inicio', async () => {
    mockedUpdatePassword.mockResolvedValueOnce({ success: true });
    const { getByPlaceholderText, getByText } = await renderWithSession();
    await fireEvent.changeText(getByPlaceholderText('Nueva contraseña'), 'nueva123');
    await fireEvent.changeText(getByPlaceholderText('Confirmar contraseña'), 'nueva123');
    await fireEvent.press(getByText('Actualizar Contraseña'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Contraseña Actualizada', expect.any(String), expect.anything()));
    expect(mockedUpdatePassword).toHaveBeenCalledWith('nueva123');
    expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
    alertSpy.mock.calls.at(-1)[2][0].onPress();
    expect(mockedRouter.replace).toHaveBeenCalledWith('/');
  });

  it('muestra el error del servidor', async () => {
    mockedUpdatePassword.mockResolvedValueOnce({ success: false, error: 'Password too weak' });
    const { getByPlaceholderText, getByText } = await renderWithSession();
    await fireEvent.changeText(getByPlaceholderText('Nueva contraseña'), 'nueva123');
    await fireEvent.changeText(getByPlaceholderText('Confirmar contraseña'), 'nueva123');
    await fireEvent.press(getByText('Actualizar Contraseña'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'Password too weak'));
    expect(mockedSupabase.auth.signOut).not.toHaveBeenCalled();
  });
});
