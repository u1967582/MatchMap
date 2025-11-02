import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';
import * as Crypto from 'expo-crypto';

// ============================================
// CONFIGURACIÓN DE DEEP LINKING
// ============================================

// ⚠️ IMPORTANTE: Esto debe estar al inicio, antes de cualquier función
// Completa la sesión de OAuth cuando se reciba el callback
WebBrowser.maybeCompleteAuthSession();

/**
 * Obtiene la URL de redirección OAuth correcta según el entorno
 * @returns URL de redirección para OAuth callbacks
 */
export const getOAuthRedirectUrl = (): string => {
  if (__DEV__) {
    // Development: Usar URL de Expo dev client
    const redirectUrl = makeRedirectUri({ 
      scheme: 'matchmap',
      path: 'auth/callback' // ⚠️ AÑADIDO: Esto faltaba
    });
    console.log('🔗 OAuth Redirect URL (DEV):', redirectUrl);
    return redirectUrl;
  } else {
    // Production: Usar scheme de la app
    const redirectUrl = 'matchmap://auth/callback'; // ⚠️ CAMBIADO: Añadido /auth/callback
    console.log('🔗 OAuth Redirect URL (PROD):', redirectUrl);
    return redirectUrl;
  }
};

// ============================================
// HOOK: Manejo de Estado de Autenticación
// ============================================

/**
 * Hook que escucha cambios en el estado de autenticación
 * y maneja la navegación automática
 * 
 * @param onUserSignedIn Callback opcional cuando usuario inicia sesión
 */
export const useAuthStateChange = (onUserSignedIn?: (user: any) => Promise<void>) => {
  const router = useRouter();

  useEffect(() => {
    console.log('🔐 Iniciando listener de auth state changes...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('📡 Auth event:', event);

        if (event === 'SIGNED_IN' && session) {
          console.log('✅ Usuario autenticado:', session.user.email);
          console.log('   Provider:', session.user.app_metadata.provider);
          console.log('   User ID:', session.user.id);

          // Callback personalizado si se proporciona
          if (onUserSignedIn && session.user) {
            try {
              await onUserSignedIn(session.user);
            } catch (error) {
              console.error('❌ Error en callback onUserSignedIn:', error);
            }
          }

          // Redirigir al mapa
          console.log('🗺️  Redirigiendo al mapa...');
          router.replace('/(protected)/map' as any);
        } 
        else if (event === 'SIGNED_OUT') {
          console.log('👋 Usuario cerró sesión');
          router.replace('/');
        }
        else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token de sesión renovado');
        }
        else if (event === 'USER_UPDATED') {
          console.log('👤 Datos de usuario actualizados');
        }
      }
    );

    return () => {
      console.log('🔐 Desconectando listener de auth...');
      subscription.unsubscribe();
    };
  }, [router, onUserSignedIn]);
};

// ============================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================

/**
 * Obtiene el usuario actualmente autenticado
 * @returns Usuario actual o null
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Error al obtener usuario:', error.message);
      return null;
    }

    if (user) {
      console.log('✅ Usuario actual:', user.email);
    }

    return user;
  } catch (error) {
    console.error('❌ Error inesperado al obtener usuario:', error);
    return null;
  }
};

/**
 * Cierra la sesión del usuario actual
 * @returns Error si ocurre, o null si es exitoso
 */
export const signOut = async () => {
  try {
    console.log('👋 Cerrando sesión...');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ Error al cerrar sesión:', error.message);
      return { error };
    }

    console.log('✅ Sesión cerrada exitosamente');
    return { error: null };
  } catch (error: any) {
    console.error('❌ Error inesperado al cerrar sesión:', error);
    return { error };
  }
}; 

// ============================================
// GOOGLE OAUTH
// ============================================

/**
 * Genera la URL de redirección correcta para el entorno actual
 * @returns URL de redirección para OAuth callbacks
 */
function getRedirectUrl(): string {
  if (__DEV__) {
    // En desarrollo, usar el redirect URL generado por Expo
    const redirectUrl = makeRedirectUri({
      scheme: 'matchmap',
      path: 'auth/callback',
    });
    console.log('🔗 Dev Redirect URL:', redirectUrl);
    return redirectUrl;
  } else {
    // En producción, usar scheme personalizado
    const redirectUrl = 'matchmap://auth/callback';
    console.log('🔗 Prod Redirect URL:', redirectUrl);
    return redirectUrl;
  }
}

/**
 * Inicia el flujo de autenticación con Google OAuth usando método robusto
 * 
 * Proceso mejorado:
 * 1. Genera URL de OAuth de Supabase con skipBrowserRedirect: true
 * 2. Abre navegador EMBEBIDO de Expo (no Safari nativo)
 * 3. Usuario selecciona cuenta y autoriza en el navegador embebido
 * 4. Captura los tokens de la URL de callback manualmente
 * 5. Establece la sesión en Supabase con setSession()
 * 6. El trigger de Supabase crea el usuario en public.users
 * 
 * @returns Objeto con success, error y session
 */
export async function signInWithGoogle(): Promise<{
  success: boolean;
  error?: string;
  session?: any;
  url?: string;
}> {
  try {
    console.log('🔐 Iniciando Google OAuth (método robusto)...');
    console.log('   Platform:', Platform.OS);
    console.log('   Environment:', __DEV__ ? 'Development' : 'Production');

    // Paso 1: Generar URL de redirección
    const redirectUrl = getRedirectUrl();
    console.log('✅ Redirect URL configurada');

    // Paso 2: Obtener URL de autorización de Supabase
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true, // ⚠️ CRÍTICO: true para mobile
        queryParams: { 
          access_type: 'offline',
          prompt: 'consent'
        },
        scopes: 'email profile'
      },
    });

    if (oauthError) {
      console.error('❌ OAuth Error:', oauthError.message);
      return { 
        success: false, 
        error: oauthError.message 
      };
    }

    if (!data?.url) {
      console.error('❌ No authorization URL received');
      return { 
        success: false, 
        error: 'No authorization URL received from Supabase' 
      };
    }

    console.log('✅ Authorization URL received');
    console.log('   URL preview:', data.url.substring(0, 80) + '...');

    // Paso 3: Abrir navegador EMBEBIDO de Expo (NO Safari nativo)
    console.log('🌐 Opening embedded browser...');
    
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUrl,
      {
        showInRecents: true, // Para iOS
      }
    );

    console.log('📱 Browser result type:', result.type);

    // Paso 4: Manejar respuesta del navegador
    if (result.type === 'success' && result.url) {
      console.log('✅ Success! Received callback URL');
      
      // Parsear la URL de callback - los tokens están en el hash (#) o en query params (?)
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      
      // Intentar extraer de hash fragment primero (formato: #access_token=...&refresh_token=...)
      if (result.url.includes('#')) {
        const hashFragment = result.url.split('#')[1];
        const params = new URLSearchParams(hashFragment);
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
      }
      
      // Si no están en el hash, intentar en query params (formato: ?access_token=...&refresh_token=...)
      if (!accessToken || !refreshToken) {
        const url = new URL(result.url);
        accessToken = url.searchParams.get('access_token');
        refreshToken = url.searchParams.get('refresh_token');
      }

      if (!accessToken || !refreshToken) {
        console.error('❌ No tokens in callback URL');
        console.log('   URL:', result.url);
        return { 
          success: false, 
          error: 'No tokens received in callback URL' 
        };
      }

      console.log('✅ Tokens extracted from URL');
      console.log('   Access Token:', accessToken.substring(0, 20) + '...');
      console.log('   Refresh Token:', refreshToken.substring(0, 20) + '...');

      // Paso 5: Establecer sesión manualmente en Supabase
      console.log('🔄 Setting session in Supabase...');
      
      const { data: sessionData, error: sessionError } = 
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

      if (sessionError) {
        console.error('❌ Session Error:', sessionError.message);
        return { 
          success: false, 
          error: sessionError.message 
        };
      }

      if (!sessionData.session) {
        console.error('❌ No session data received');
        return { 
          success: false, 
          error: 'Failed to establish session' 
        };
      }

      console.log('✅ Session established successfully!');
      console.log('   User:', sessionData.session.user.email);
      console.log('   User ID:', sessionData.session.user.id);
      console.log('   Provider:', sessionData.session.user.app_metadata.provider);

      // Retornar éxito con la sesión
      return { 
        success: true, 
        session: sessionData.session,
        url: data.url
      };

    } else if (result.type === 'cancel') {
      console.log('ℹ️  User cancelled login');
      return { 
        success: false, 
        error: 'Login cancelled by user' 
      };
    } else if (result.type === 'dismiss') {
      console.log('ℹ️  Browser dismissed');
      return { 
        success: false, 
        error: 'Login dismissed' 
      };
    } else {
      console.error('❌ Unexpected result type:', result.type);
      return { 
        success: false, 
        error: `Unexpected result: ${result.type}` 
      };
    }

  } catch (error: any) {
    console.error('❌ Exception in signInWithGoogle:', error);
    console.error('   Stack:', error.stack);
    
    // Mensajes de error más amigables
    let errorMessage = error.message || 'Unknown error';
    
    if (error?.message?.includes('provider')) {
      errorMessage = 'Google OAuth no está configurado en Supabase. Verifica la configuración.';
    } else if (error?.message?.includes('redirect')) {
      errorMessage = 'Error en la configuración de redirect URL.';
    } else if (error?.message?.includes('network')) {
      errorMessage = 'Error de conexión. Verifica tu internet.';
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Verifica el estado de la sesión de OAuth
 * Útil para debugging
 */
export async function checkOAuthSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error al verificar sesión:', error.message);
      return null;
    }

    if (session) {
      console.log('✅ Sesión OAuth activa');
      console.log('   User:', session.user.email);
      console.log('   Provider:', session.user.app_metadata.provider);
      console.log('   Expires:', new Date(session.expires_at! * 1000).toLocaleString());
    } else {
      console.log('ℹ️  No hay sesión activa');
    }

    return session;
  } catch (error) {
    console.error('❌ Error inesperado al verificar sesión:', error);
    return null;
  }
}

// ============================================
// APPLE OAUTH (Opcional - para futuro)
// ============================================

/**
 * Inicia el flujo de autenticación con Apple Sign-In
 * Solo disponible en iOS
 * 
 * @returns Datos de autenticación o lanza error
 * @throws Error si no está disponible o falla
 */
export async function signInWithApple() {
  try {
    // Importar dinámicamente para evitar errores en Android
    // @ts-ignore - dynamic import for optional dependency
    const AppleAuthentication = await import('expo-apple-authentication');
    
    const isAvailable = await AppleAuthentication.AppleAuthentication.isAvailableAsync();
    
    if (!isAvailable) {
      throw new Error('Apple Sign-In no está disponible en este dispositivo.');
    }

    console.log('🍎 Iniciando Apple Sign-In...');

    // Generar nonce para seguridad
    const rawNonceBytes = await Crypto.getRandomBytesAsync(16);
    const rawNonce = Array.from(rawNonceBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256, 
      rawNonce
    );

    // Solicitar credenciales de Apple
    const credential = await AppleAuthentication.AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error('No se recibió identityToken de Apple.');
    }

    console.log('✅ Credenciales de Apple recibidas');

    // Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      console.error('❌ Error en Apple Sign-In:', error.message);
      throw error;
    }

    console.log('✅ Apple Sign-In exitoso');
    return data;
  } catch (error: any) {
    console.error('❌ Error en Apple Sign-In:', error);
    throw error;
  }
}

// ============================================
// UTILIDADES DE DEBUG
// ============================================

/**
 * Imprime información detallada del usuario actual
 * Útil para debugging de OAuth
 */
export async function debugUserInfo() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }

    console.log('👤 ==== USER DEBUG INFO ====');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Provider:', user.app_metadata.provider);
    console.log('Created:', new Date(user.created_at).toLocaleString());
    console.log('Last Sign In:', new Date(user.last_sign_in_at!).toLocaleString());
    console.log('Metadata:', JSON.stringify(user.user_metadata, null, 2));
    console.log('========================');
  } catch (error) {
    console.error('❌ Error en debugUserInfo:', error);
  }
}

// ============================================
// TIPOS Y EXPORTS
// ============================================

export type AuthProvider = 'google' | 'apple' | 'facebook';

export interface OAuthError {
  message: string;
  provider: AuthProvider;
  originalError?: any;
}
