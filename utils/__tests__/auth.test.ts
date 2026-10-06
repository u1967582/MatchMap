jest.mock('~/utils/supabase');

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'exp://127.0.0.1:8081/--/auth/callback'),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '192.168.1.10:8081' } },
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array([1, 2, 255])),
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

import { Alert } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import {
  checkAndPromotePreRegisteredBar,
  checkOAuthSession,
  deleteAccount,
  getCurrentUser,
  getIsGuest,
  getOAuthRedirectUrl,
  sendPasswordResetEmail,
  showGuestLoginAlert,
  signInWithApple,
  signInWithGoogle,
  signOut,
  updatePassword,
  useAuthStateChange,
} from '~/utils/auth';

const mockedSupabase = supabase as any;
const mockedOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const mockedAppleAvailable = AppleAuthentication.isAvailableAsync as jest.Mock;
const mockedAppleSignIn = AppleAuthentication.signInAsync as jest.Mock;

const session = {
  access_token: 'access-123',
  user: { id: 'user-1', email: 'user@test.com', app_metadata: { provider: 'email' } },
};

let fetchMock: jest.Mock;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn();
  global.fetch = fetchMock as any;
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedSupabase.auth.setSession = jest.fn();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'table').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const jsonResponse = (body: any, ok = true, status = 200) => ({
  ok,
  status,
  statusText: '',
  json: jest.fn(async () => body),
  text: jest.fn(async () => JSON.stringify(body)),
});

describe('getOAuthRedirectUrl', () => {
  it('en desarrollo usa la URL de Expo con la ruta auth/callback', () => {
    expect(getOAuthRedirectUrl()).toBe('exp://127.0.0.1:8081/--/auth/callback');
  });
});

describe('getCurrentUser', () => {
  it('devuelve el usuario autenticado', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    await expect(getCurrentUser()).resolves.toEqual(session.user);
  });

  it('devuelve null si Supabase devuelve error', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'jwt expired' },
    });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('devuelve null si getUser lanza', async () => {
    mockedSupabase.auth.getUser.mockRejectedValueOnce(new Error('network'));
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe('signOut', () => {
  it('devuelve error null si todo va bien', async () => {
    await expect(signOut()).resolves.toEqual({ error: null });
    expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('propaga el error de Supabase', async () => {
    const error = { message: 'boom' };
    mockedSupabase.auth.signOut.mockResolvedValueOnce({ error });
    await expect(signOut()).resolves.toEqual({ error });
  });

  it('captura excepciones', async () => {
    const error = new Error('crash');
    mockedSupabase.auth.signOut.mockRejectedValueOnce(error);
    await expect(signOut()).resolves.toEqual({ error });
  });
});

describe('deleteAccount', () => {
  it('falla si no hay usuario', async () => {
    const result = await deleteAccount();
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falla si no hay sesión activa', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    const result = await deleteAccount();
    expect(result).toEqual({ success: false, error: 'No hay sesión activa.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('llama a la edge function con el token del usuario y cierra sesión al terminar', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(deleteAccount()).resolves.toEqual({ success: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/functions/v1/delete-user-account');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer access-123');
    expect(JSON.parse(init.body)).toEqual({ userId: 'user-1' });
    expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('no cierra sesión y devuelve el error del servidor si la edge function falla', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Failed to delete user data' }, false, 500)
    );

    await expect(deleteAccount()).resolves.toEqual({
      success: false,
      error: 'Failed to delete user data',
    });
    expect(mockedSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('devuelve un error legible si la red falla', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(deleteAccount()).resolves.toEqual({
      success: false,
      error: 'Network request failed',
    });
  });
});

describe('sendPasswordResetEmail', () => {
  it('usa el hostUri de Expo como redirect en desarrollo', async () => {
    await expect(sendPasswordResetEmail('a@b.com')).resolves.toEqual({ success: true });
    expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', {
      redirectTo: 'exp://192.168.1.10:8081/--/auth/reset-password',
    });
  });

  it('devuelve el mensaje de error de Supabase', async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'rate limited', status: 429 },
    });
    await expect(sendPasswordResetEmail('a@b.com')).resolves.toEqual({
      success: false,
      error: 'rate limited',
    });
  });
});

describe('updatePassword', () => {
  it('actualiza la contraseña', async () => {
    await expect(updatePassword('secret123')).resolves.toEqual({ success: true });
    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'secret123' });
  });

  it('devuelve el error de Supabase', async () => {
    mockedSupabase.auth.updateUser.mockResolvedValueOnce({
      data: null,
      error: { message: 'weak password' },
    });
    await expect(updatePassword('1')).resolves.toEqual({ success: false, error: 'weak password' });
  });
});

describe('signInWithGoogle', () => {
  beforeEach(() => {
    mockedSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/auth?x=1', provider: 'google' },
      error: null,
    });
  });

  it('pide a Supabase la URL sin redirigir el navegador (mobile)', async () => {
    mockedOpenAuthSession.mockResolvedValueOnce({ type: 'cancel' });
    await signInWithGoogle();
    const args = mockedSupabase.auth.signInWithOAuth.mock.calls[0][0];
    expect(args.provider).toBe('google');
    expect(args.options.skipBrowserRedirect).toBe(true);
  });

  it('establece la sesión con los tokens del fragmento (#) del callback', async () => {
    mockedOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'matchmap://auth/callback#access_token=AT&refresh_token=RT',
    });
    mockedSupabase.auth.setSession.mockResolvedValueOnce({ data: { session }, error: null });

    const result = await signInWithGoogle();

    expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'AT',
      refresh_token: 'RT',
    });
    expect(result.success).toBe(true);
    expect(result.session).toBe(session);
  });

  it('acepta los tokens en query params', async () => {
    mockedOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'matchmap://auth/callback?access_token=AT2&refresh_token=RT2',
    });
    mockedSupabase.auth.setSession.mockResolvedValueOnce({ data: { session }, error: null });

    await expect(signInWithGoogle()).resolves.toMatchObject({ success: true });
    expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'AT2',
      refresh_token: 'RT2',
    });
  });

  it('falla si el callback no trae tokens', async () => {
    mockedOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'matchmap://auth/callback?error=access_denied',
    });
    await expect(signInWithGoogle()).resolves.toEqual({
      success: false,
      error: 'No tokens received in callback URL',
    });
    expect(mockedSupabase.auth.setSession).not.toHaveBeenCalled();
  });

  it.each([
    ['cancel', 'Login cancelled by user'],
    ['dismiss', 'Login dismissed'],
    ['locked', 'Unexpected result: locked'],
  ])('resultado "%s" del navegador → error "%s"', async (type, error) => {
    mockedOpenAuthSession.mockResolvedValueOnce({ type });
    await expect(signInWithGoogle()).resolves.toEqual({ success: false, error });
  });

  it('devuelve el error de OAuth sin abrir el navegador', async () => {
    mockedSupabase.auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: { message: 'provider disabled' },
    });
    await expect(signInWithGoogle()).resolves.toEqual({
      success: false,
      error: 'provider disabled',
    });
    expect(mockedOpenAuthSession).not.toHaveBeenCalled();
  });

  it('falla si Supabase no devuelve URL', async () => {
    mockedSupabase.auth.signInWithOAuth.mockResolvedValueOnce({ data: { url: null }, error: null });
    await expect(signInWithGoogle()).resolves.toMatchObject({ success: false });
  });

  it('propaga el error de setSession', async () => {
    mockedOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'matchmap://auth/callback#access_token=AT&refresh_token=RT',
    });
    mockedSupabase.auth.setSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'invalid refresh token' },
    });
    await expect(signInWithGoogle()).resolves.toEqual({
      success: false,
      error: 'invalid refresh token',
    });
  });

  it('traduce errores de red a un mensaje amigable', async () => {
    mockedOpenAuthSession.mockRejectedValueOnce(new Error('network down'));
    await expect(signInWithGoogle()).resolves.toEqual({
      success: false,
      error: 'Error de conexión. Verifica tu internet.',
    });
  });
});

describe('signInWithApple', () => {
  it('lanza si Apple Sign-In no está disponible', async () => {
    mockedAppleAvailable.mockResolvedValueOnce(false);
    await expect(signInWithApple()).rejects.toThrow('no está disponible');
  });

  it('envía el nonce hasheado a Apple y el nonce original a Supabase', async () => {
    mockedAppleAvailable.mockResolvedValueOnce(true);
    mockedAppleSignIn.mockResolvedValueOnce({ identityToken: 'apple-token' });
    mockedSupabase.auth.signInWithIdToken.mockResolvedValueOnce({
      data: { user: session.user, session },
      error: null,
    });

    const data = await signInWithApple();

    expect(mockedAppleSignIn.mock.calls[0][0].nonce).toBe('hashed-nonce');
    expect(mockedSupabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-token',
      nonce: '0102ff',
    });
    expect(data.session).toBe(session);
  });

  it('lanza si Apple no devuelve identityToken', async () => {
    mockedAppleAvailable.mockResolvedValueOnce(true);
    mockedAppleSignIn.mockResolvedValueOnce({ identityToken: null });
    await expect(signInWithApple()).rejects.toThrow('identityToken');
    expect(mockedSupabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('propaga el error de Supabase', async () => {
    mockedAppleAvailable.mockResolvedValueOnce(true);
    mockedAppleSignIn.mockResolvedValueOnce({ identityToken: 'apple-token' });
    mockedSupabase.auth.signInWithIdToken.mockResolvedValueOnce({
      data: null,
      error: { message: 'invalid nonce' },
    });
    await expect(signInWithApple()).rejects.toEqual({ message: 'invalid nonce' });
  });

  it('propaga la cancelación del usuario', async () => {
    mockedAppleAvailable.mockResolvedValueOnce(true);
    mockedAppleSignIn.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
    await expect(signInWithApple()).rejects.toEqual({ code: 'ERR_REQUEST_CANCELED' });
  });
});

describe('checkOAuthSession', () => {
  it('devuelve la sesión activa', async () => {
    mockedSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { ...session, expires_at: 1_800_000_000 } },
      error: null,
    });
    await expect(checkOAuthSession()).resolves.toMatchObject({ access_token: 'access-123' });
  });

  it('devuelve null si hay error', async () => {
    mockedSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'x' },
    });
    await expect(checkOAuthSession()).resolves.toBeNull();
  });
});

describe('getIsGuest / showGuestLoginAlert', () => {
  it('detecta usuarios anónimos', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'g', is_anonymous: true } },
      error: null,
    });
    await expect(getIsGuest()).resolves.toBe(true);
  });

  it('un usuario normal o sin sesión no es invitado', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    await expect(getIsGuest()).resolves.toBe(false);
    await expect(getIsGuest()).resolves.toBe(false);
  });

  it('la alerta de invitado ofrece ir al login', () => {
    const router = { push: jest.fn(), replace: jest.fn() };
    showGuestLoginAlert(router);
    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] as any[];
    const action = buttons.find((b) => b.style !== 'cancel');
    action.onPress();
    expect(router.push.mock.calls.length + router.replace.mock.calls.length).toBe(1);
  });
});

describe('useAuthStateChange', () => {
  it('en SIGNED_IN comprueba bar pre-registrado y ejecuta el callback; se desuscribe al desmontar', async () => {
    const unsubscribe = jest.fn();
    let listener: any;
    mockedSupabase.auth.onAuthStateChange.mockImplementationOnce((cb: any) => {
      listener = cb;
      return { data: { subscription: { unsubscribe } } };
    });
    const onSignedIn = jest.fn(async () => {});

    const { unmount } = await renderHook(() => useAuthStateChange(onSignedIn));
    await listener('SIGNED_IN', session);

    expect(onSignedIn).toHaveBeenCalledWith(session.user);
    expect(mockedSupabase.from).toHaveBeenCalledWith('auto_pre_register_bars');

    await unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('un error en el callback no rompe el listener', async () => {
    let listener: any;
    mockedSupabase.auth.onAuthStateChange.mockImplementationOnce((cb: any) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    const onSignedIn = jest.fn(async () => {
      throw new Error('fallo');
    });

    await renderHook(() => useAuthStateChange(onSignedIn));
    await expect(listener('SIGNED_IN', session)).resolves.toBeUndefined();
    await expect(listener('SIGNED_OUT', null)).resolves.toBeUndefined();
  });
});

describe('checkAndPromotePreRegisteredBar', () => {
  /**
   * La función hace estas consultas a auto_pre_register_bars en orden:
   * debug, simple (email), email + converted_bar_id null, completa.
   */
  function mockPreRegisterQueries(rows: {
    simple?: any[];
    notConverted?: any[];
    full?: any[];
    fullError?: any;
  }) {
    const queue = [
      createQueryBuilderMock({ data: [], error: null }),
      createQueryBuilderMock({ data: rows.simple ?? [], error: null }),
      createQueryBuilderMock({ data: rows.notConverted ?? [], error: null }),
      createQueryBuilderMock({ data: rows.full ?? [], error: rows.fullError ?? null }),
    ];
    const builders: Record<string, any[]> = {};
    mockedSupabase.from.mockImplementation((table: string) => {
      const b =
        table === 'auto_pre_register_bars' && queue.length
          ? queue.shift()
          : createQueryBuilderMock(
              table === 'bar_images' || table === 'bar_menus'
                ? { data: rows.full?.[0]?.__images ?? [], error: null }
                : { data: null, error: null }
            );
      (builders[table] ??= []).push(b);
      return b;
    });
    return builders;
  }

  const preBar = {
    id: 'pre-1',
    email: 'owner@bar.com',
    name: 'Bar Pepe',
    status: 'pre_registered',
    converted_bar_id: null,
  };

  it('normaliza el email (minúsculas y sin espacios) al buscar', async () => {
    const builders = mockPreRegisterQueries({});
    await checkAndPromotePreRegisteredBar('user-1', '  Owner@Bar.COM ');
    expect(builders.auto_pre_register_bars[1].eq).toHaveBeenCalledWith('email', 'owner@bar.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no hace nada si no hay bar pre-registrado', async () => {
    mockPreRegisterQueries({});
    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('no promociona un bar en estado distinto de pre_registered', async () => {
    const rejected = { ...preBar, status: 'rejected' };
    mockPreRegisterQueries({ simple: [rejected], notConverted: [rejected] });
    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('llama a la edge function de promoción con el token y avisa al usuario', async () => {
    mockPreRegisterQueries({ simple: [preBar], notConverted: [preBar], full: [preBar] });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, barId: 'bar-9', barImagesCount: 2, menuImagesCount: 1 })
    );

    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/functions/v1/promote_pre_registered_bar_with_images');
    expect(init.headers.Authorization).toBe('Bearer access-123');
    expect(JSON.parse(init.body)).toEqual({ preBarId: 'pre-1', ownerId: 'user-1' });
    expect(alertSpy).toHaveBeenCalledWith('¡Bar Reclamado!', expect.stringContaining('3 imágenes'), expect.anything());
  });

  it('muestra aviso de soporte si la edge function falla', async () => {
    mockPreRegisterQueries({ full: [preBar] });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'x' }, false, 500));

    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');
    expect(alertSpy).toHaveBeenCalledWith('Aviso', expect.stringContaining('soporte'));
  });

  it('no llama a la edge function sin sesión', async () => {
    mockPreRegisterQueries({ full: [preBar] });
    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si el bar ya está convertido y con imágenes, solo enlaza el usuario', async () => {
    const converted = { ...preBar, status: 'converted', converted_bar_id: 'bar-9', __images: [{ id: 'i' }] };
    const builders = mockPreRegisterQueries({ simple: [converted], full: [converted] });

    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');

    expect(builders.users[0].update).toHaveBeenCalledWith({ bar_id: 'bar-9' });
    expect(builders.users[0].eq).toHaveBeenCalledWith('id', 'user-1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Bar Vinculado', expect.any(String), expect.anything());
  });

  it('si el bar está convertido pero sin imágenes, llama a la edge function para completar', async () => {
    const converted = { ...preBar, status: 'converted', converted_bar_id: 'bar-9', __images: [] };
    mockPreRegisterQueries({ simple: [converted], full: [converted] });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, barId: 'bar-9' }));

    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('nunca lanza (no debe bloquear el login)', async () => {
    mockedSupabase.from.mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(checkAndPromotePreRegisteredBar('user-1', 'x@y.com')).resolves.toBeUndefined();
  });
});
