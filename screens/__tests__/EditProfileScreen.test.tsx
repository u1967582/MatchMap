import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ToastMessage from 'react-native-toast-message';
import { useRouter } from 'expo-router';

jest.mock('~/utils/supabase');
jest.mock('~/utils/auth', () => ({
  deleteAccount: jest.fn(),
}));

import { createQueryBuilderMock } from '../../test-utils/mockSupabase';
import { supabase } from '~/utils/supabase';
import EditProfileScreen from '~/screens/EditProfileScreen';

const mockedFrom = supabase.from as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;
const mockedUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockedToastShow = ToastMessage.show as jest.Mock;
// useRouter() está mockeado en jest.setup.ts y siempre devuelve la misma instancia compartida.
// eslint-disable-next-line react-hooks/rules-of-hooks
const mockedRouter = useRouter();

const AUTH_USER = { id: 'user-1', email: 'user@test.com' };
const PROFILE_ROW = {
  full_name: 'Nombre Original',
  username: 'usuario_original',
  email: 'user@test.com',
  profile_image_url: null,
};

const mockInitialLoad = (profileOverrides: Partial<typeof PROFILE_ROW> = {}) => {
  mockedGetUser.mockResolvedValueOnce({ data: { user: AUTH_USER }, error: null });
  mockedFrom.mockReturnValueOnce(
    createQueryBuilderMock({ data: { ...PROFILE_ROW, ...profileOverrides }, error: null })
  );
};

const renderScreen = async () => {
  const utils = await render(<EditProfileScreen />);
  await waitFor(() => {
    expect(utils.queryByText('Cargando perfil...')).toBeNull();
  });
  return utils;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EditProfileScreen - carga inicial', () => {
  it('redirige a /login si no hay usuario autenticado', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await render(<EditProfileScreen />);

    await waitFor(() => {
      expect(mockedRouter.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('carga el perfil y muestra el formulario', async () => {
    mockInitialLoad();
    const { getByText } = await renderScreen();

    expect(getByText('Editar Perfil')).toBeTruthy();
  });
});

describe('EditProfileScreen - botón de guardar deshabilitado', () => {
  it('permanece deshabilitado si no hay cambios, aunque el formulario sea válido', async () => {
    mockInitialLoad();
    const { getAllByText, getByText } = await renderScreen();

    const callsBeforePress = mockedFrom.mock.calls.filter(([table]) => table === 'users').length;

    await fireEvent.press(getAllByText('Guardar cambios')[0]);

    expect(getByText('Modifica algún campo para guardar cambios')).toBeTruthy();
    // El botón está deshabilitado: no debe dispararse ningún update adicional
    expect(mockedFrom.mock.calls.filter(([table]) => table === 'users')).toHaveLength(
      callsBeforePress
    );
  });

  it('permanece deshabilitado si el nombre introducido tiene menos de 2 caracteres', async () => {
    mockInitialLoad();
    const { getByPlaceholderText, getAllByText } = await renderScreen();

    await fireEvent.changeText(getByPlaceholderText('Nombre Original'), 'a');
    await fireEvent.press(getAllByText('Guardar cambios')[0]);

    // El update de perfil nunca se dispara: el botón bloquea el guardado
    expect(mockedFrom.mock.calls.filter(([table]) => table === 'users')).toHaveLength(1); // solo la carga inicial
  });
});

describe('EditProfileScreen - feedback visual de contraseñas', () => {
  it('muestra el error inline si las contraseñas no coinciden', async () => {
    mockInitialLoad();
    const { getByText, getAllByPlaceholderText } = await renderScreen();

    await fireEvent.press(getByText('Cambiar contraseña'));
    const [passwordInput, confirmInput] = getAllByPlaceholderText(
      /nueva contraseña|Confirma tu nueva contraseña/i
    );

    await fireEvent.changeText(passwordInput, 'secret6');
    await fireEvent.changeText(confirmInput, 'otra-cosa');

    expect(getByText('Las contraseñas no coinciden')).toBeTruthy();
  });
});

describe('EditProfileScreen - guardado exitoso', () => {
  it('actualiza el nombre completo y navega hacia atrás', async () => {
    mockInitialLoad();
    const { getByPlaceholderText, getAllByText } = await renderScreen();

    await fireEvent.changeText(getByPlaceholderText('Nombre Original'), 'Nombre Nuevo');

    const updateBuilder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(updateBuilder);

    await fireEvent.press(getAllByText('Guardar cambios')[0]);

    await waitFor(() => {
      expect(mockedFrom).toHaveBeenCalledWith('users');
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ full_name: 'Nombre Nuevo' })
      );
    });

    await waitFor(() => {
      expect(mockedRouter.back).toHaveBeenCalled();
    });

    expect(mockedToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text1: 'Perfil actualizado' })
    );
  });

  it('actualiza la contraseña vía supabase.auth.updateUser cuando se cambia', async () => {
    mockInitialLoad();
    const { getByText, getAllByPlaceholderText, getAllByText } = await renderScreen();

    await fireEvent.press(getByText('Cambiar contraseña'));
    const [passwordInput, confirmInput] = getAllByPlaceholderText(
      /nueva contraseña|Confirma tu nueva contraseña/i
    );
    await fireEvent.changeText(passwordInput, 'nueva-clave');
    await fireEvent.changeText(confirmInput, 'nueva-clave');

    mockedUpdateUser.mockResolvedValueOnce({ data: { user: AUTH_USER }, error: null });

    await fireEvent.press(getAllByText('Guardar cambios')[0]);

    await waitFor(() => {
      expect(mockedUpdateUser).toHaveBeenCalledWith({ password: 'nueva-clave' });
    });

    await waitFor(() => {
      expect(mockedRouter.back).toHaveBeenCalled();
    });
  });
});
