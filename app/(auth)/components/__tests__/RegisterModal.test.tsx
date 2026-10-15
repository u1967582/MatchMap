import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ToastMessage from 'react-native-toast-message';

jest.mock('~/utils/supabase');
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'exp://127.0.0.1:8081/--/auth/callback'),
}));

import { supabase } from '~/utils/supabase';
import RegisterModal from '~/app/(auth)/components/RegisterModal';

const mockedSignUp = supabase.auth.signUp as jest.Mock;
const mockedToastShow = ToastMessage.show as jest.Mock;

const VALID_FIELDS = {
  email: 'user@test.com',
  username: 'usuario123',
  fullName: 'Juan Pérez',
  password: 'secret88',
  confirmPassword: 'secret88',
};

const setup = async (props?: Partial<React.ComponentProps<typeof RegisterModal>>) => {
  const onClose = jest.fn();
  const onRegisterSuccess = jest.fn();
  const utils = await render(
    <RegisterModal visible onClose={onClose} onRegisterSuccess={onRegisterSuccess} {...props} />
  );
  return { ...utils, onClose, onRegisterSuccess };
};

// "Crear Cuenta" aparece en el título del modal y en el texto del botón;
// el botón es siempre el último nodo con ese texto.
const pressRegisterButton = async (getAllByText: (text: string) => any[]) => {
  const matches = getAllByText('Crear Cuenta');
  await fireEvent.press(matches[matches.length - 1]);
};

const fillFields = async (utils: any, fields: Partial<typeof VALID_FIELDS>) => {
  const { getByPlaceholderText, getAllByPlaceholderText } = utils;
  if (fields.email !== undefined) {
    await fireEvent.changeText(getByPlaceholderText('tu@email.com'), fields.email);
  }
  if (fields.username !== undefined) {
    await fireEvent.changeText(getByPlaceholderText('usuario123'), fields.username);
  }
  if (fields.fullName !== undefined) {
    await fireEvent.changeText(getByPlaceholderText('Juan Pérez'), fields.fullName);
  }
  const passwordInputs = getAllByPlaceholderText('••••••••');
  if (fields.password !== undefined) {
    await fireEvent.changeText(passwordInputs[0], fields.password);
  }
  if (fields.confirmPassword !== undefined) {
    await fireEvent.changeText(passwordInputs[1], fields.confirmPassword);
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RegisterModal - formulario incompleto/inválido no permite registrar', () => {
  const cases: Array<[string, Partial<typeof VALID_FIELDS>]> = [
    ['email vacío', { ...VALID_FIELDS, email: '' }],
    ['email sin @', { ...VALID_FIELDS, email: 'noesunemail' }],
    ['username con menos de 3 caracteres', { ...VALID_FIELDS, username: 'ab' }],
    ['fullName vacío', { ...VALID_FIELDS, fullName: '' }],
    [
      'password con menos de 8 caracteres',
      { ...VALID_FIELDS, password: '1234567', confirmPassword: '1234567' },
    ],
    ['passwords que no coinciden', { ...VALID_FIELDS, confirmPassword: 'otra-cosa' }],
  ];

  it.each(cases)('%s: no llama a signUp al pulsar el botón', async (_label, fields) => {
    const utils = await setup();
    await fillFields(utils, fields);
    await pressRegisterButton(utils.getAllByText);

    expect(mockedSignUp).not.toHaveBeenCalled();
  });
});

describe('RegisterModal - feedback visual', () => {
  it('muestra el error inline "Las contraseñas no coinciden" mientras se escriben, sin esperar al submit', async () => {
    const utils = await setup();
    await fillFields(utils, { password: 'secret88', confirmPassword: 'diferente' });

    expect(utils.getByText('Las contraseñas no coinciden')).toBeTruthy();
  });
});

describe('RegisterModal - registro exitoso', () => {
  it('llama a signUp con el payload correcto, limpia el formulario y cierra el modal', async () => {
    mockedSignUp.mockResolvedValueOnce({
      data: { user: { id: 'user-1', identities: [{}] }, session: { access_token: 't' } },
      error: null,
    });

    const utils = await setup();
    await fillFields(utils, VALID_FIELDS);
    await pressRegisterButton(utils.getAllByText);

    expect(mockedSignUp).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'secret88',
      options: {
        emailRedirectTo: 'exp://127.0.0.1:8081/--/auth/callback',
        data: {
          username: 'usuario123',
          full_name: 'Juan Pérez',
        },
      },
    });

    await waitFor(() => {
      expect(utils.onRegisterSuccess).toHaveBeenCalled();
      expect(utils.onClose).toHaveBeenCalled();
    });

    expect(mockedToastShow).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('normaliza username a minúsculas al escribirlo', async () => {
    mockedSignUp.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });

    const utils = await setup();
    await fillFields(utils, { ...VALID_FIELDS, username: 'UsuArio123' });
    await pressRegisterButton(utils.getAllByText);

    expect(mockedSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ username: 'usuario123' }),
        }),
      })
    );
  });
});

describe('RegisterModal - error del servidor', () => {
  it('muestra un toast de error y no cierra el modal si signUp falla', async () => {
    mockedSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    const utils = await setup();
    await fillFields(utils, VALID_FIELDS);
    await pressRegisterButton(utils.getAllByText);

    await waitFor(() => {
      expect(mockedToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: 'Este email ya está registrado' })
      );
    });

    expect(utils.onClose).not.toHaveBeenCalled();
    expect(utils.onRegisterSuccess).not.toHaveBeenCalled();
  });
});

describe('RegisterModal - confirmación de email', () => {
  it('sin sesión (confirmación de email activa) cierra el modal pero no navega al mapa', async () => {
    mockedSignUp.mockResolvedValueOnce({
      data: { user: { id: 'user-1', identities: [{}] }, session: null },
      error: null,
    });

    const utils = await setup();
    await fillFields(utils, VALID_FIELDS);
    await pressRegisterButton(utils.getAllByText);

    await waitFor(() => expect(utils.onClose).toHaveBeenCalled());
    expect(utils.onRegisterSuccess).not.toHaveBeenCalled();
    expect(mockedToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text2: expect.stringContaining('correo') })
    );
  });

  it('detecta el email ya registrado aunque Supabase no devuelva error (identities vacío)', async () => {
    mockedSignUp.mockResolvedValueOnce({
      data: { user: { id: 'fake', identities: [] }, session: null },
      error: null,
    });

    const utils = await setup();
    await fillFields(utils, VALID_FIELDS);
    await pressRegisterButton(utils.getAllByText);

    await waitFor(() => {
      expect(mockedToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: 'Este email ya está registrado' })
      );
    });
    expect(utils.onClose).not.toHaveBeenCalled();
    expect(utils.onRegisterSuccess).not.toHaveBeenCalled();
  });

  it('traduce la contraseña filtrada/débil a un mensaje en español', async () => {
    mockedSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'weak_password', message: 'Password is known to be weak and easy to guess' },
    });

    const utils = await setup();
    await fillFields(utils, VALID_FIELDS);
    await pressRegisterButton(utils.getAllByText);

    await waitFor(() => {
      expect(mockedToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: 'Contraseña poco segura' })
      );
    });
  });
});
