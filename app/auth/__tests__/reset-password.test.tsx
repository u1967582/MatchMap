import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

jest.mock('~/utils/supabase');
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'exp://test') }));
jest.mock('~/utils/auth', () => ({
  ...jest.requireActual('~/utils/auth'),
  updatePassword: jest.fn(),
}));

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

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Contraseña Actualizada',
        expect.any(String),
        expect.anything()
      )
    );
    expect(mockedUpdatePassword).toHaveBeenCalledWith('nueva123');
    expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
    alertSpy.mock.calls.at(-1)[2][0].onPress();
    expect(mockedRouter.replace).toHaveBeenCalledWith('/');
  });

  it('una sesión de invitado (anónima) no sirve para cambiar la contraseña', async () => {
    mockedSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'g1', is_anonymous: true } } },
    });
    await render(<ResetPasswordScreen />);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Link Inválido');
  });

  it('exige el mínimo de 8 caracteres', async () => {
    const { getByPlaceholderText, getByText } = await renderWithSession();
    await fireEvent.changeText(getByPlaceholderText('Nueva contraseña'), '1234567');
    await fireEvent.changeText(getByPlaceholderText('Confirmar contraseña'), '1234567');
    await fireEvent.press(getByText('Actualizar Contraseña'));
    expect(mockedUpdatePassword).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor en español', async () => {
    mockedUpdatePassword.mockResolvedValueOnce({
      success: false,
      error: 'Password is known to be weak and easy to guess',
      rawError: { code: 'weak_password', message: 'Password is known to be weak and easy to guess' },
    });
    const { getByPlaceholderText, getByText } = await renderWithSession();
    await fireEvent.changeText(getByPlaceholderText('Nueva contraseña'), 'nueva123');
    await fireEvent.changeText(getByPlaceholderText('Confirmar contraseña'), 'nueva123');
    await fireEvent.press(getByText('Actualizar Contraseña'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Contraseña poco segura', expect.any(String))
    );
    expect(mockedSupabase.auth.signOut).not.toHaveBeenCalled();
  });
});
