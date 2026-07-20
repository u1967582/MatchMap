import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ToastMessage from 'react-native-toast-message';

jest.mock('~/utils/supabase');
jest.mock('~/utils/auth', () => ({
  checkAndPromotePreRegisteredBar: jest.fn().mockResolvedValue(undefined),
}));

import { supabase } from '~/utils/supabase';
import { checkAndPromotePreRegisteredBar } from '~/utils/auth';
import LoginModal from '~/app/(auth)/components/LoginModal';

const mockedSignIn = supabase.auth.signInWithPassword as jest.Mock;
const mockedToastShow = ToastMessage.show as jest.Mock;
const mockedCheckAndPromote = checkAndPromotePreRegisteredBar as jest.Mock;

const setup = async (props?: Partial<React.ComponentProps<typeof LoginModal>>) => {
  const onClose = jest.fn();
  const onLoginSuccess = jest.fn();
  const utils = await render(
    <LoginModal visible onClose={onClose} onLoginSuccess={onLoginSuccess} {...props} />
  );
  return { ...utils, onClose, onLoginSuccess };
};

// "Iniciar Sesión" aparece tanto en el título del modal como en el texto del botón;
// el botón es siempre el último nodo con ese texto.
const pressLoginButton = async (getAllByText: (text: string) => any[]) => {
  const matches = getAllByText('Iniciar Sesión');
  await fireEvent.press(matches[matches.length - 1]);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginModal', () => {
  it('muestra un warning y no llama a Supabase si el formulario está incompleto', async () => {
    const { getAllByText, getByPlaceholderText } = await setup();

    // Solo rellenamos el email, la contraseña queda vacía
    await fireEvent.changeText(getByPlaceholderText('tu@email.com'), 'user@test.com');
    await pressLoginButton(getAllByText);

    expect(mockedSignIn).not.toHaveBeenCalled();
  });

  it('inicia sesión correctamente: llama a signInWithPassword, promueve el bar pre-registrado y cierra el modal', async () => {
    mockedSignIn.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'user@test.com' }, session: {} },
      error: null,
    });

    const { getAllByText, getByPlaceholderText, onClose, onLoginSuccess } = await setup();

    await fireEvent.changeText(getByPlaceholderText('tu@email.com'), 'user@test.com');
    await fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    await pressLoginButton(getAllByText);

    expect(mockedSignIn).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });

    await waitFor(() => {
      expect(mockedCheckAndPromote).toHaveBeenCalledWith('user-1', 'user@test.com');
    });

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    expect(mockedToastShow).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('muestra un toast de error y no cierra el modal si signInWithPassword falla', async () => {
    mockedSignIn.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const { getAllByText, getByPlaceholderText, onClose, onLoginSuccess } = await setup();

    await fireEvent.changeText(getByPlaceholderText('tu@email.com'), 'user@test.com');
    await fireEvent.changeText(getByPlaceholderText('••••••••'), 'wrongpass');
    await pressLoginButton(getAllByText);

    await waitFor(() => {
      expect(mockedToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: 'Email o contraseña incorrectos' })
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(onLoginSuccess).not.toHaveBeenCalled();
    expect(mockedCheckAndPromote).not.toHaveBeenCalled();
  });
});
