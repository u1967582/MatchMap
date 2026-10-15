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
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import {
  checkAndPromotePreRegisteredBar,
  checkOAuthSession,
  deleteAccount,
  formatAppleFullName,
  getAuthErrorMessage,
  getCurrentUser,
  getIsGuest,
  getOAuthRedirectUrl,
  MIN_PASSWORD_LENGTH,
  promptDeleteAccount,
  sendPasswordResetEmail,
  showGuestLoginAlert,
  signInWithApple,
  signInWithGoogle,
  signOut,
  updatePassword,
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
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: session.user },
      error: null,
    });
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
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: session.user },
      error: null,
    });
    const result = await deleteAccount();
    expect(result).toEqual({ success: false, error: 'No hay sesión activa.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('llama a la edge function con el token del usuario y cierra sesión al terminar', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: session.user },
      error: null,
    });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(deleteAccount()).resolves.toEqual({ success: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/functions/v1/delete-user-account');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer access-123');
    expect(JSON.parse(init.body)).toEqual({ userId: 'user-1' });
    // El usuario ya no existe en el servidor: solo se cierra la sesión local
    expect(mockedSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('no cierra sesión y devuelve un error en español si la edge function falla', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: session.user },
      error: null,
    });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Failed to delete user data' }, false, 500)
    );

    const result = await deleteAccount();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No se pudo eliminar la cuenta/);
    expect(result.error).not.toContain('Failed');
    expect(mockedSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('una respuesta no JSON (p. ej. 502) no rompe y devuelve error legible', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: session.user },
      error: null,
    });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: jest.fn(async () => {
        throw new SyntaxError('JSON Parse error');
      }),
    });

    const result = await deleteAccount();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No se pudo eliminar la cuenta/);
    expect(mockedSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('devuelve un error legible si la red falla', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: session.user },
      error: null,
    });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(deleteAccount()).resolves.toEqual({
      success: false,
      error: 'Error de conexión. Revisa tu internet e inténtalo de nuevo.',
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
    await expect(sendPasswordResetEmail('a@b.com')).resolves.toMatchObject({
      success: false,
      error: 'rate limited',
      rawError: { status: 429 },
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
    await expect(updatePassword('1')).resolves.toMatchObject({
      success: false,
      error: 'weak password',
    });
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
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: session.user },
      error: null,
    });
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

describe('checkAndPromotePreRegisteredBar', () => {
  /**
   * La función hace UNA consulta a auto_pre_register_bars (por email) y, si el
   * bar ya está convertido, consulta bar_images y bar_menus.
   */
  function mockPreRegisterQueries(rows: {
    simple?: any[];
    notConverted?: any[];
    full?: any[];
    fullError?: any;
  }) {
    const all = rows.full ?? rows.notConverted ?? rows.simple ?? [];
    const merged = [...(rows.full ?? []), ...(rows.notConverted ?? []), ...(rows.simple ?? [])];
    const unique = merged.filter((r, i) => merged.indexOf(r) === i);
    const builders: Record<string, any[]> = {};
    mockedSupabase.from.mockImplementation((table: string) => {
      const b = createQueryBuilderMock(
        table === 'auto_pre_register_bars'
          ? { data: rows.fullError ? null : unique, error: rows.fullError ?? null }
          : table === 'bar_images' || table === 'bar_menus'
            ? { data: all[0]?.__images ?? [], error: null }
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
    expect(builders.auto_pre_register_bars).toHaveLength(1);
    expect(builders.auto_pre_register_bars[0].eq).toHaveBeenCalledWith('email', 'owner@bar.com');
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
    expect(url).toBe(
      'https://test.supabase.co/functions/v1/promote_pre_registered_bar_with_images'
    );
    expect(init.headers.Authorization).toBe('Bearer access-123');
    expect(JSON.parse(init.body)).toEqual({ preBarId: 'pre-1', ownerId: 'user-1' });
    expect(alertSpy).toHaveBeenCalledWith(
      '¡Bar Reclamado!',
      expect.stringContaining('3 imágenes'),
      expect.anything()
    );
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

  it('si el bar ya está convertido y con imágenes no hace nada (ni avisa en cada login)', async () => {
    const converted = {
      ...preBar,
      status: 'converted',
      converted_bar_id: 'bar-9',
      __images: [{ id: 'i' }],
    };
    const builders = mockPreRegisterQueries({ simple: [converted], full: [converted] });

    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');

    // users.bar_id lo protege un trigger: el cliente no debe intentar cambiarlo
    expect(builders.users).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
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

describe('checkAndPromotePreRegisteredBar - selección del pre-registro', () => {
  it('prefiere el pre-registro pendiente sin convertir frente a uno rechazado', async () => {
    const rows = [
      { id: 'pre-rechazado', name: 'A', status: 'rejected', converted_bar_id: null },
      { id: 'pre-ok', name: 'B', status: 'pre_registered', converted_bar_id: null },
    ];
    mockedSupabase.from.mockImplementation(() => createQueryBuilderMock({ data: rows, error: null }));
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, barId: 'bar-1' }));

    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).preBarId).toBe('pre-ok');
  });

  it('no consulta nada si no hay email (p. ej. invitado)', async () => {
    await checkAndPromotePreRegisteredBar('user-1', '');
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });
});

describe('getAuthErrorMessage', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'invalid_credentials', 'Email o contraseña incorrectos'],
    [{ message: 'Invalid login credentials' }, 'invalid_credentials', 'Email o contraseña incorrectos'],
    [{ code: 'email_not_confirmed' }, 'email_not_confirmed', 'Email no verificado'],
    [{ message: 'User already registered' }, 'user_exists', 'Este email ya está registrado'],
    [{ code: 'weak_password', message: 'Password is known to be weak and easy to guess' }, 'weak_password', 'Contraseña poco segura'],
    [{ message: 'Password should be at least 6 characters.' }, 'weak_password', 'Contraseña poco segura'],
    [{ code: 'same_password' }, 'same_password', 'La nueva contraseña debe ser distinta de la anterior'],
    [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'rate_limit', 'Demasiados intentos'],
    [{ message: 'For security purposes, you can only request this after 42 seconds.' }, 'rate_limit', 'Demasiados intentos'],
    [{ status: 429, message: 'x' }, 'rate_limit', 'Demasiados intentos'],
    [{ code: 'email_address_invalid' }, 'invalid_email', 'El email no es válido'],
    [{ code: 'signup_disabled' }, 'signup_disabled', 'El registro no está disponible ahora mismo'],
    [new TypeError('Network request failed'), 'network', 'Error de conexión'],
  ])('%j → %s', (error, kind, title) => {
    expect(getAuthErrorMessage(error, 'Fallback')).toMatchObject({ kind, title });
  });

  it('un error desconocido usa el fallback y nunca el texto original en inglés', () => {
    const msg = getAuthErrorMessage({ message: 'Something exploded in GoTrue' }, 'No se pudo');
    expect(msg).toEqual({ kind: 'unknown', title: 'No se pudo', subtitle: 'Inténtalo de nuevo' });
  });

  it('acepta null/undefined', () => {
    expect(getAuthErrorMessage(null, 'F').kind).toBe('unknown');
    expect(getAuthErrorMessage(undefined, 'F').title).toBe('F');
  });

  it('la contraseña mínima es de 8 caracteres', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});

describe('promptDeleteAccount', () => {
  const callbacks = () => ({ onStart: jest.fn(), onFinish: jest.fn(), onDeleted: jest.fn() });

  const pressButton = (callIndex: number, text: string) => {
    const buttons = alertSpy.mock.calls[callIndex][2] as any[];
    return buttons.find((b) => b.text === text).onPress();
  };

  it('pide doble confirmación y no borra si se cancela', () => {
    const cb = callbacks();
    promptDeleteAccount(cb);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as any[];
    expect(buttons.find((b) => b.style === 'cancel')?.onPress).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cb.onStart).not.toHaveBeenCalled();
  });

  it('avisa de lo que se pierde (bares y Boost) antes de borrar', () => {
    promptDeleteAccount(callbacks());
    expect(alertSpy.mock.calls[0][1]).toMatch(/bares/);
    expect(alertSpy.mock.calls[0][1]).toMatch(/Boost/);
  });

  it('tras las dos confirmaciones borra la cuenta y llama a onDeleted', async () => {
    const cb = callbacks();
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    promptDeleteAccount(cb);
    pressButton(0, 'Continuar');
    await pressButton(1, 'Sí, eliminar');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cb.onStart).toHaveBeenCalled();
    expect(cb.onDeleted).toHaveBeenCalled();
    expect(cb.onFinish).toHaveBeenCalled();
  });

  it('si falla muestra el error en español y no llama a onDeleted', async () => {
    const cb = callbacks();
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }, false, 500));

    promptDeleteAccount(cb);
    pressButton(0, 'Continuar');
    await pressButton(1, 'Sí, eliminar');

    expect(cb.onDeleted).not.toHaveBeenCalled();
    expect(cb.onFinish).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenLastCalledWith('Error', expect.stringMatching(/No se pudo eliminar/));
  });
});

describe('OAuth: bar pre-registrado y nombre de Apple', () => {
  it('Google: tras iniciar sesión busca el bar pre-registrado del email', async () => {
    mockedSupabase.auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://accounts.google.com/x', provider: 'google' },
      error: null,
    });
    mockedOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'matchmap://auth/callback#access_token=AT&refresh_token=RT',
    });
    mockedSupabase.auth.setSession.mockResolvedValueOnce({ data: { session }, error: null });
    const builder = createQueryBuilderMock({ data: [], error: null });
    mockedSupabase.from.mockReturnValue(builder);

    await signInWithGoogle();

    expect(mockedSupabase.from).toHaveBeenCalledWith('auto_pre_register_bars');
    expect(builder.eq).toHaveBeenCalledWith('email', 'user@test.com');
  });

  it('Apple: guarda el nombre del primer login y busca el bar pre-registrado', async () => {
    mockedAppleAvailable.mockResolvedValueOnce(true);
    mockedAppleSignIn.mockResolvedValueOnce({
      identityToken: 'apple-token',
      fullName: { givenName: 'Ana', middleName: null, familyName: 'García' },
    });
    mockedSupabase.auth.signInWithIdToken.mockResolvedValueOnce({
      data: { user: session.user, session },
      error: null,
    });
    const builders: Record<string, any> = {};
    mockedSupabase.from.mockImplementation((table: string) => {
      builders[table] = createQueryBuilderMock({ data: [], error: null });
      return builders[table];
    });

    await signInWithApple();

    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: 'Ana García' },
    });
    expect(builders.users.update).toHaveBeenCalledWith({ full_name: 'Ana García' });
    expect(builders.users.eq).toHaveBeenCalledWith('id', 'user-1');
    // Solo si aún no tiene nombre (no pisar lo que haya editado el usuario)
    expect(builders.users.or).toHaveBeenCalledWith('full_name.is.null,full_name.eq.');
    expect(builders.auto_pre_register_bars.eq).toHaveBeenCalledWith('email', 'user@test.com');
  });

  it('Apple: en logins posteriores (sin nombre) no toca el perfil', async () => {
    mockedAppleAvailable.mockResolvedValueOnce(true);
    mockedAppleSignIn.mockResolvedValueOnce({ identityToken: 'apple-token', fullName: null });
    mockedSupabase.auth.signInWithIdToken.mockResolvedValueOnce({
      data: { user: session.user, session },
      error: null,
    });

    await signInWithApple();

    expect(mockedSupabase.auth.updateUser).not.toHaveBeenCalled();
    expect(mockedSupabase.from).not.toHaveBeenCalledWith('users');
  });

  it('formatAppleFullName', () => {
    expect(formatAppleFullName(null)).toBeNull();
    expect(formatAppleFullName({ givenName: ' ', familyName: null } as any)).toBeNull();
    expect(
      formatAppleFullName({ givenName: 'Ana', middleName: 'M.', familyName: 'García' } as any)
    ).toBe('Ana M. García');
  });
});

describe('logs sin datos personales (HALLAZGOS #17)', () => {
  const SECRETS = ['user@test.com', 'owner@bar.com', 'AT-SECRET', 'RT-SECRET', 'access-123'];

  const collectLogs = () => {
    const spies = (['log', 'error', 'warn', 'info', 'debug', 'table'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => {})
    );
    return () =>
      spies
        .flatMap((s) => s.mock.calls.flat())
        .map((arg) => (typeof arg === 'string' ? arg : (JSON.stringify(arg) ?? String(arg))))
        .join('\n');
  };

  it('Google, reset, promoción y consulta de sesión no imprimen emails ni tokens', async () => {
    const logs = collectLogs();

    // Google con éxito
    mockedSupabase.auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://accounts.google.com/x', provider: 'google' },
      error: null,
    });
    mockedOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'matchmap://auth/callback#access_token=AT-SECRET&refresh_token=RT-SECRET',
    });
    mockedSupabase.auth.setSession.mockResolvedValueOnce({ data: { session }, error: null });
    await signInWithGoogle();

    // Google sin refresh token (antes imprimía la URL completa)
    mockedSupabase.auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://accounts.google.com/x', provider: 'google' },
      error: null,
    });
    mockedOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'matchmap://auth/callback?access_token=AT-SECRET',
    });
    await signInWithGoogle();

    // Recuperación de contraseña, con éxito y con error
    await sendPasswordResetEmail('user@test.com');
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom', status: 500 },
    });
    await sendPasswordResetEmail('user@test.com');

    // Promoción de bar con fallo de la edge function
    mockedSupabase.from.mockImplementation(() =>
      createQueryBuilderMock({
        data: [{ id: 'p', name: 'Bar', status: 'pre_registered', converted_bar_id: null }],
        error: null,
      })
    );
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'x' }, false, 500));
    await checkAndPromotePreRegisteredBar('user-1', 'owner@bar.com');

    // Usuario actual y sesión
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: session.user }, error: null });
    await getCurrentUser();
    mockedSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { ...session, expires_at: 1 } },
      error: null,
    });
    await checkOAuthSession();

    const output = logs();
    for (const secret of SECRETS) {
      expect(output).not.toContain(secret);
    }
  });
});
