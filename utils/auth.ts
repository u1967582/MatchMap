import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase, supabaseUrl } from './supabase';

// ⚠️ Logs: nunca imprimir emails, tokens ni ids de usuario. En producción los
// console.log se eliminan (babel), pero console.error/warn se mantienen.

// Completa la sesión de OAuth cuando se recibe el callback (debe ir al inicio)
WebBrowser.maybeCompleteAuthSession();

// ============================================
// CONFIGURACIÓN
// ============================================

/** Deep link de producción al que vuelven OAuth y la confirmación de email. */
export const AUTH_CALLBACK_URL = 'matchmap://auth/callback';
/** Deep link de producción del email de recuperación de contraseña. */
export const PASSWORD_RESET_URL = 'matchmap://auth/reset-password';

/**
 * Longitud mínima de contraseña en registro y cambio de contraseña.
 * Debe coincidir (o ser mayor) con Auth › Providers › Email › Minimum password length.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * URL de redirección para OAuth y para el enlace de confirmación de email.
 * Debe estar en Auth › URL Configuration › Redirect URLs de Supabase.
 */
export const getOAuthRedirectUrl = (): string => {
  if (__DEV__) {
    return makeRedirectUri({ scheme: 'matchmap', path: 'auth/callback' });
  }
  return AUTH_CALLBACK_URL;
};

/** URL de redirección del email de recuperación de contraseña. */
export const getPasswordResetRedirectUrl = (): string => {
  if (!__DEV__) return PASSWORD_RESET_URL;
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri
    ? `exp://${hostUri}/--/auth/reset-password`
    : 'exp://localhost:8081/--/auth/reset-password';
};

// ============================================
// MENSAJES DE ERROR EN ESPAÑOL
// ============================================

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'same_password'
  | 'rate_limit'
  | 'invalid_email'
  | 'signup_disabled'
  | 'session_expired'
  | 'network'
  | 'unknown';

export interface AuthErrorMessage {
  kind: AuthErrorKind;
  title: string;
  subtitle?: string;
}

/**
 * Traduce un error de Supabase Auth (o de red) a un mensaje comprensible.
 * Usa `error.code` cuando existe (supabase-js ≥ 2.4x) y cae al texto del mensaje.
 * Nunca devuelve el mensaje original en inglés.
 */
export function getAuthErrorMessage(error: any, fallback: string): AuthErrorMessage {
  const code: string = (error?.code ?? '').toString().toLowerCase();
  const msg: string = (typeof error === 'string' ? error : error?.message ?? '').toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => code === n || msg.includes(n));

  if (has('invalid_credentials', 'invalid login credentials')) {
    return { kind: 'invalid_credentials', title: 'Email o contraseña incorrectos' };
  }
  if (has('email_not_confirmed', 'email not confirmed')) {
    return { kind: 'email_not_confirmed', title: 'Email no verificado', subtitle: 'Revisa tu correo para confirmar tu cuenta' };
  }
  if (has('user_already_exists', 'email_exists', 'user already registered', 'already been registered')) {
    return { kind: 'user_exists', title: 'Este email ya está registrado', subtitle: 'Inicia sesión o recupera tu contraseña' };
  }
  if (has('weak_password', 'pwned', 'weak and easy to guess', 'password should')) {
    return {
      kind: 'weak_password',
      title: 'Contraseña poco segura',
      subtitle: `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres y evita contraseñas conocidas`,
    };
  }
  if (has('same_password', 'should be different from the old')) {
    return { kind: 'same_password', title: 'La nueva contraseña debe ser distinta de la anterior' };
  }
  if (
    has(
      'over_email_send_rate_limit',
      'over_request_rate_limit',
      'over_sms_send_rate_limit',
      'rate limit',
      'for security purposes',
      'too many requests'
    ) ||
    error?.status === 429
  ) {
    return { kind: 'rate_limit', title: 'Demasiados intentos', subtitle: 'Espera unos minutos y vuelve a intentarlo' };
  }
  if (
    has('email_address_invalid', 'invalid format', 'unable to validate email') ||
    (code === 'validation_failed' && msg.includes('email'))
  ) {
    return { kind: 'invalid_email', title: 'El email no es válido' };
  }
  if (has('signup_disabled', 'signups not allowed', 'email_provider_disabled')) {
    return { kind: 'signup_disabled', title: 'El registro no está disponible ahora mismo', subtitle: 'Inténtalo más tarde' };
  }
  if (has('session_not_found', 'session_expired', 'refresh_token_not_found', 'auth session missing')) {
    return { kind: 'session_expired', title: 'Tu sesión ha caducado', subtitle: 'Vuelve a iniciar sesión' };
  }
  if (has('network', 'fetch failed', 'failed to fetch', 'timeout', 'timed out')) {
    return { kind: 'network', title: 'Error de conexión', subtitle: 'Revisa tu conexión a internet' };
  }
  return { kind: 'unknown', title: fallback, subtitle: 'Inténtalo de nuevo' };
}

// ============================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================

/** Usuario autenticado actual o null. */
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      console.error('❌ Error al obtener usuario:', error.message);
      return null;
    }
    return user;
  } catch (error: any) {
    console.error('❌ Error inesperado al obtener usuario:', error?.message);
    return null;
  }
};

type PreRegisteredBarRow = {
  id: string;
  name: string | null;
  status: string | null;
  converted_bar_id: string | null;
};

/**
 * Elige el pre-registro a procesar entre las filas con el email del usuario:
 * primero uno pendiente sin convertir, luego cualquiera sin convertir y por
 * último cualquiera (para completar una conversión a medias).
 */
function pickPreRegisteredBar(rows: PreRegisteredBarRow[]): PreRegisteredBarRow | null {
  return (
    rows.find((r) => r.status === 'pre_registered' && !r.converted_bar_id) ??
    rows.find((r) => !r.converted_bar_id) ??
    rows[0] ??
    null
  );
}

/**
 * Si existe un bar pre-registrado con el email del usuario, lo promueve
 * (edge function `promote_pre_registered_bar_with_images`, que valida en
 * servidor que el email coincide y está confirmado). Nunca lanza: no debe
 * bloquear el login.
 */
export const checkAndPromotePreRegisteredBar = async (userId: string, userEmail: string) => {
  try {
    const normalizedEmail = (userEmail ?? '').toLowerCase().trim();
    if (!userId || !normalizedEmail) return;

    const { data: rows, error: queryError } = await supabase
      .from('auto_pre_register_bars')
      .select('id, name, status, converted_bar_id')
      .eq('email', normalizedEmail)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('❌ Error buscando bar pre-registrado:', queryError.message);
      return;
    }

    const foundBar = pickPreRegisteredBar((rows as PreRegisteredBarRow[] | null) ?? []);
    if (!foundBar) return;

    if (foundBar.converted_bar_id) {
      // Ya convertido: solo hay que actuar si faltan las imágenes por migrar
      const { data: existingImages } = await supabase
        .from('bar_images')
        .select('id')
        .eq('bar_id', foundBar.converted_bar_id)
        .limit(1);
      const { data: existingMenus } = await supabase
        .from('bar_menus')
        .select('id')
        .eq('bar_id', foundBar.converted_bar_id)
        .limit(1);

      const hasImages = !!existingImages?.length || !!existingMenus?.length;
      // Conversión completa: el bar ya quedó enlazado al convertirse. No
      // repetir el aviso en cada login.
      if (hasImages) return;
    } else if (foundBar.status !== 'pre_registered') {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      console.error('❌ Sin sesión para promover el bar pre-registrado');
      return;
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/promote_pre_registered_bar_with_images`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preBarId: foundBar.id, ownerId: userId }),
      }
    );

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      console.error('❌ Respuesta no válida al promover el bar. Status:', response.status);
      return;
    }

    if (!response.ok || !result?.success) {
      console.error('❌ Error al promover el bar pre-registrado. Status:', response.status);
      Alert.alert(
        'Aviso',
        'Se encontró un bar pre-registrado para tu email, pero hubo un error al reclamarlo. Contacta con soporte.'
      );
      return;
    }

    const totalImages = (result.barImagesCount || 0) + (result.menuImagesCount || 0);
    Alert.alert(
      '¡Bar Reclamado!',
      `Tu bar ha sido activado exitosamente${totalImages > 0 ? ` con ${totalImages} imágenes` : ''}. Ya puedes gestionar tu establecimiento.`,
      [{ text: 'OK' }]
    );
  } catch (error: any) {
    console.error('❌ Excepción en checkAndPromotePreRegisteredBar:', error?.message);
  }
};

/** Cierra la sesión del usuario actual. */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ Error al cerrar sesión:', error.message);
      return { error };
    }
    return { error: null };
  } catch (error: any) {
    console.error('❌ Error inesperado al cerrar sesión:', error?.message);
    return { error };
  }
};

// ============================================
// GOOGLE OAUTH
// ============================================

/**
 * Login con Google vía OAuth de Supabase en el navegador embebido:
 * 1. Supabase devuelve la URL de autorización (skipBrowserRedirect).
 * 2. Se abre con WebBrowser.openAuthSessionAsync.
 * 3. Se extraen los tokens del callback y se fija la sesión con setSession().
 * 4. Se comprueba si el usuario tiene un bar pre-registrado.
 */
export async function signInWithGoogle(): Promise<{
  success: boolean;
  error?: string;
  session?: any;
  url?: string;
}> {
  try {
    const redirectUrl = getOAuthRedirectUrl();

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true, // ⚠️ CRÍTICO: true para mobile
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'email profile',
      },
    });

    if (oauthError) {
      console.error('❌ OAuth Error:', oauthError.message);
      return { success: false, error: oauthError.message };
    }

    if (!data?.url) {
      console.error('❌ No authorization URL received');
      return { success: false, error: 'No authorization URL received from Supabase' };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
      showInRecents: true,
    });

    if (result.type === 'success' && result.url) {
      // Los tokens pueden venir en el hash (#) o en query params (?)
      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      if (result.url.includes('#')) {
        const params = new URLSearchParams(result.url.split('#')[1]);
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
      }

      if (!accessToken || !refreshToken) {
        const url = new URL(result.url);
        accessToken = url.searchParams.get('access_token');
        refreshToken = url.searchParams.get('refresh_token');
      }

      if (!accessToken || !refreshToken) {
        // No imprimir la URL: puede contener códigos o tokens
        console.error('❌ No tokens in callback URL');
        return { success: false, error: 'No tokens received in callback URL' };
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error('❌ Session Error:', sessionError.message);
        return { success: false, error: sessionError.message };
      }

      if (!sessionData.session) {
        console.error('❌ No session data received');
        return { success: false, error: 'Failed to establish session' };
      }

      const user = sessionData.session.user;
      if (user?.email) {
        await checkAndPromotePreRegisteredBar(user.id, user.email);
      }

      return { success: true, session: sessionData.session, url: data.url };
    } else if (result.type === 'cancel') {
      return { success: false, error: 'Login cancelled by user' };
    } else if (result.type === 'dismiss') {
      return { success: false, error: 'Login dismissed' };
    } else {
      console.error('❌ Unexpected result type:', result.type);
      return { success: false, error: `Unexpected result: ${result.type}` };
    }
  } catch (error: any) {
    console.error('❌ Exception in signInWithGoogle:', error?.message);

    let errorMessage = error?.message || 'Unknown error';
    if (error?.message?.includes('provider')) {
      errorMessage = 'Google OAuth no está configurado en Supabase. Verifica la configuración.';
    } else if (error?.message?.includes('redirect')) {
      errorMessage = 'Error en la configuración de redirect URL.';
    } else if (error?.message?.includes('network')) {
      errorMessage = 'Error de conexión. Verifica tu internet.';
    }

    return { success: false, error: errorMessage };
  }
}

/** Sesión actual (útil para depurar) o null. */
export async function checkOAuthSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      console.error('❌ Error al verificar sesión:', error.message);
      return null;
    }
    return session;
  } catch (error: any) {
    console.error('❌ Error inesperado al verificar sesión:', error?.message);
    return null;
  }
}

// ============================================
// APPLE SIGN-IN
// ============================================

/** Nombre completo a partir de la credencial de Apple (solo llega en el primer login). */
export function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null | undefined
): string | null {
  if (!fullName) return null;
  const name = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter((part) => !!part && part.trim().length > 0)
    .map((part) => (part as string).trim())
    .join(' ');
  return name.length > 0 ? name : null;
}

/**
 * Apple solo envía el nombre en el primer login y Supabase no lo guarda con
 * signInWithIdToken: se guarda aquí para no tener que pedirlo de nuevo
 * (App Review rechaza apps que piden nombre/email tras Sign in with Apple).
 */
async function persistAppleFullName(userId: string, fullName: string) {
  try {
    await supabase.auth.updateUser({ data: { full_name: fullName } });
    await supabase
      .from('users')
      .update({ full_name: fullName })
      .eq('id', userId)
      .or('full_name.is.null,full_name.eq.');
  } catch (error: any) {
    console.error('❌ No se pudo guardar el nombre de Apple:', error?.message);
  }
}

/**
 * Login con Apple (solo iOS).
 * @throws Error si no está disponible, si el usuario cancela o si falla Supabase
 */
export async function signInWithApple() {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Sign-In no está disponible en este dispositivo.');
    }

    // Nonce: a Apple se le envía el hash y a Supabase el original
    const rawNonceBytes = await Crypto.getRandomBytesAsync(16);
    const rawNonce = Array.from(rawNonceBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error('No se recibió identityToken de Apple.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      throw error;
    }

    const user = data?.user;
    if (user) {
      const fullName = formatAppleFullName(credential.fullName);
      if (fullName) {
        await persistAppleFullName(user.id, fullName);
      }
      // Con «Ocultar mi email» el email es un relay de Apple y no coincidirá
      // con ningún pre-registro, lo cual es correcto.
      if (user.email) {
        await checkAndPromotePreRegisteredBar(user.id, user.email);
      }
    }

    return data;
  } catch (error: any) {
    if (error?.code !== 'ERR_REQUEST_CANCELED') {
      console.error('❌ Error en Apple Sign-In:', error?.message);
    }
    throw error;
  }
}

// ============================================
// PASSWORD RECOVERY
// ============================================

/** Envía el email de recuperación de contraseña. */
export async function sendPasswordResetEmail(email: string): Promise<{
  success: boolean;
  error?: string;
  rawError?: any;
}> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl(),
    });

    if (error) {
      console.error('❌ Error enviando email de recuperación. Status:', error.status);
      return { success: false, error: error.message, rawError: error };
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Excepción al enviar email de recuperación:', error?.message);
    return { success: false, error: error?.message, rawError: error };
  }
}

/** Actualiza la contraseña del usuario con sesión (p. ej. la del enlace de recuperación). */
export async function updatePassword(newPassword: string): Promise<{
  success: boolean;
  error?: string;
  rawError?: any;
}> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error('❌ Error actualizando contraseña:', error.message);
      return { success: false, error: error.message, rawError: error };
    }
    return { success: true };
  } catch (error: any) {
    console.error('❌ Excepción actualizando contraseña:', error?.message);
    return { success: false, error: error?.message, rawError: error };
  }
}

// ============================================
// ACCOUNT DELETION
// ============================================

const DELETE_ACCOUNT_GENERIC_ERROR =
  'No se pudo eliminar la cuenta. Inténtalo de nuevo o contacta con soporte.';

/**
 * Elimina la cuenta del usuario actual vía la edge function
 * `delete-user-account` (borra datos, ficheros y el usuario de auth con
 * service_role) y cierra la sesión local.
 */
export async function deleteAccount(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'No se pudo obtener el usuario actual.' };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { success: false, error: 'No hay sesión activa.' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/delete-user-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: user.id }),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success) {
      console.error('❌ Error eliminando la cuenta. Status:', response.status);
      return { success: false, error: DELETE_ACCOUNT_GENERIC_ERROR };
    }

    // El usuario ya no existe en el servidor: cerrar solo la sesión local
    // (scope global haría una llamada que fallaría con 404/403).
    await supabase.auth.signOut({ scope: 'local' });

    return { success: true };
  } catch (error: any) {
    console.error('❌ Excepción eliminando la cuenta:', error?.message);
    const isNetwork = getAuthErrorMessage(error, '').kind === 'network';
    return {
      success: false,
      error: isNetwork
        ? 'Error de conexión. Revisa tu internet e inténtalo de nuevo.'
        : DELETE_ACCOUNT_GENERIC_ERROR,
    };
  }
}

export interface PromptDeleteAccountOptions {
  /** Se llama justo antes de empezar el borrado (para mostrar un loader). */
  onStart?: () => void;
  /** Se llama al terminar, con éxito o error (para ocultar el loader). */
  onFinish?: () => void;
  /** Se llama si la cuenta se eliminó (p. ej. navegar al inicio). */
  onDeleted: () => void;
}

/**
 * Flujo de borrado de cuenta con doble confirmación (Apple 5.1.1(v) y Google
 * Play). Compartido por Perfil y Editar perfil.
 */
export function promptDeleteAccount({ onStart, onFinish, onDeleted }: PromptDeleteAccountOptions) {
  const runDeletion = async () => {
    onStart?.();
    try {
      const result = await deleteAccount();
      if (result.success) {
        onDeleted();
      } else {
        Alert.alert('Error', result.error || DELETE_ACCOUNT_GENERIC_ERROR);
      }
    } finally {
      onFinish?.();
    }
  };

  Alert.alert(
    'Eliminar cuenta',
    'Esta acción es irreversible. Se eliminarán tu perfil, tus reseñas, favoritos y fotos, y los bares que gestiones dejarán de aparecer en MatchMap. Los Boost ya comprados no se reembolsan.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Continuar',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Confirmación final',
            '¿Seguro que quieres eliminar tu cuenta de forma permanente?',
            [
              { text: 'No, conservar', style: 'cancel' },
              { text: 'Sí, eliminar', style: 'destructive', onPress: runDeletion },
            ]
          );
        },
      },
    ]
  );
}

// ============================================
// INVITADOS
// ============================================

/** True si el usuario actual es un invitado (sesión anónima). */
export const getIsGuest = async (): Promise<boolean> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.is_anonymous === true;
};

/**
 * Alerta para invitados que intentan usar funciones restringidas.
 * Ofrece volver a la pantalla de bienvenida para iniciar sesión.
 */
export const showGuestLoginAlert = (router: any) => {
  Alert.alert('Inicia sesión', 'Necesitas una cuenta para usar esta función.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Iniciar sesión', onPress: () => router.replace('/') },
  ]);
};

export type AuthProvider = 'google' | 'apple' | 'facebook';

export interface OAuthError {
  message: string;
  provider: AuthProvider;
  originalError?: any;
}
