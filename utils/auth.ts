import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
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

          // ✅ IMPORTANTE: Verificar si hay un bar pre-registrado CUANDO TIENE SESIÓN
          try {
            await checkAndPromotePreRegisteredBar(session.user.id, session.user.email || '');
          } catch (error) {
            console.error('❌ Error verificando bar pre-registrado:', error);
            // No bloquear el login si falla
          }

          // Callback personalizado si se proporciona
          if (onUserSignedIn && session.user) {
            try {
              await onUserSignedIn(session.user);
            } catch (error) {
              console.error('❌ Error en callback onUserSignedIn:', error);
            }
          }

          // ✅ NO navegar aquí - la navegación se maneja en _layout.tsx
          console.log('ℹ️  Navegación manejada por _layout.tsx');
        }
        else if (event === 'SIGNED_OUT') {
          console.log('👋 Usuario cerró sesión');
          // ✅ NO navegar aquí - la navegación se maneja en _layout.tsx
          console.log('ℹ️  Navegación manejada por _layout.tsx');
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
 * Verifica si existe un bar pre-registrado para el usuario y lo promote
 * Esta función se debe llamar DESPUÉS de que el usuario ha iniciado sesión
 * @param userId ID del usuario autenticado
 * @param userEmail Email del usuario autenticado
 */
export const checkAndPromotePreRegisteredBar = async (userId: string, userEmail: string) => {
  try {
    // Normalize email to lowercase for consistent matching
    const normalizedEmail = userEmail.toLowerCase().trim();
    
    console.log(`\n========================================`);
    console.log(`🔍 BUSCANDO BAR PRE-REGISTRADO`);
    console.log(`========================================`);
    console.log(`📧 Email original: ${userEmail}`);
    console.log(`📧 Email normalizado: ${normalizedEmail}`);
    console.log(`👤 User ID: ${userId}`);

    // STEP 1: Debug - Show the last 5 rows in the table to compare
    console.log(`\n🔍 DEBUG: Últimas 5 filas en auto_pre_register_bars:`);
    const { data: debugRows, error: debugError } = await supabase
      .from('auto_pre_register_bars')
      .select('id, email, status, converted_bar_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (debugError) {
      console.error('❌ Error fetching debug rows:', debugError);
    } else {
      console.table(debugRows);
      debugRows?.forEach((row, index) => {
        console.log(`\n   Row ${index + 1}:`);
        console.log(`   - Email: "${row.email}" (length: ${row.email?.length})`);
        console.log(`   - Email matches: ${row.email === normalizedEmail}`);
        console.log(`   - Status: "${row.status}"`);
        console.log(`   - Converted: ${row.converted_bar_id}`);
        console.log(`   - Created: ${row.created_at}`);
      });
    }

    // STEP 2: Try simple query first (only email filter)
    console.log(`\n🔎 QUERY 1: Búsqueda simple (solo email):`);
    const { data: simpleQuery, error: simpleError } = await supabase
      .from('auto_pre_register_bars')
      .select('id, email, name, status, converted_bar_id, created_at')
      .eq('email', normalizedEmail);

    console.log(`   Resultados:`, {
      found: simpleQuery?.length || 0,
      data: simpleQuery,
      error: simpleError,
    });

    // STEP 3: Try with converted_bar_id filter
    console.log(`\n🔎 QUERY 2: Búsqueda con email + converted_bar_id IS NULL:`);
    const { data: withConvertedFilter, error: convertedError } = await supabase
      .from('auto_pre_register_bars')
      .select('id, email, name, status, converted_bar_id, created_at')
      .eq('email', normalizedEmail)
      .is('converted_bar_id', null);

    console.log(`   Resultados:`, {
      found: withConvertedFilter?.length || 0,
      data: withConvertedFilter,
      error: convertedError,
    });

    // STEP 4: Full query with all filters
    console.log(`\n🔎 QUERY 3: Búsqueda completa (email + status + converted_bar_id):`);
    const { data: preRegBars, error: queryError } = await supabase
      .from('auto_pre_register_bars')
      .select('id, email, name, status, converted_bar_id, created_at')
      .eq('email', normalizedEmail)
      .eq('status', 'pre_registered')
      .is('converted_bar_id', null)
      .limit(1);

    console.log(`   Resultados:`, {
      found: preRegBars?.length || 0,
      data: preRegBars,
      error: queryError,
    });

    if (queryError) {
      console.error('❌ Error querying pre-registered bars:', queryError);
      console.log(`========================================\n`);
      return;
    }

    // Use the simplest query that found results
    let foundBar = null;
    if (preRegBars && preRegBars.length > 0) {
      foundBar = preRegBars[0];
      console.log(`✅ Encontrado con query completa`);
    } else if (withConvertedFilter && withConvertedFilter.length > 0) {
      foundBar = withConvertedFilter[0];
      console.log(`✅ Encontrado sin filtro de status`);
    } else if (simpleQuery && simpleQuery.length > 0) {
      foundBar = simpleQuery[0];
      console.log(`✅ Encontrado solo con email`);
    }

    if (!foundBar) {
      console.log('\n❌ NO SE ENCONTRÓ BAR PRE-REGISTRADO CON NINGUNA QUERY');
      console.log(`   Posibles razones:`);
      console.log(`   - Email "${normalizedEmail}" no existe en la tabla`);
      console.log(`   - Revisa los emails en el DEBUG arriba`);
      console.log(`========================================\n`);
      return;
    }

    const preBarId = foundBar.id;
    console.log(`\n✅ BAR PRE-REGISTRADO ENCONTRADO!`);
    console.log(`   ID: ${preBarId}`);
    console.log(`   Nombre: ${foundBar.name}`);
    console.log(`   Email: ${foundBar.email}`);
    console.log(`   Status: ${foundBar.status}`);
    console.log(`   Converted Bar ID: ${foundBar.converted_bar_id}`);
    console.log(`   Creado: ${foundBar.created_at}`);

    // ========================================
    // VERIFICACIÓN: ¿Ya fue convertido?
    // ========================================
    if (foundBar.converted_bar_id) {
      console.log(`\n🔍 BAR TIENE converted_bar_id: ${foundBar.converted_bar_id}`);
      console.log(`   Verificando si las imágenes ya fueron migradas...`);

      // Verificar si las imágenes ya están en bar_images/bar_menus
      const { data: existingImages, error: imagesError } = await supabase
        .from('bar_images')
        .select('id')
        .eq('bar_id', foundBar.converted_bar_id)
        .limit(1);

      const { data: existingMenus, error: menusError } = await supabase
        .from('bar_menus')
        .select('id')
        .eq('bar_id', foundBar.converted_bar_id)
        .limit(1);

      const hasImages = (existingImages && existingImages.length > 0) || 
                       (existingMenus && existingMenus.length > 0);

      console.log(`   - Imágenes en bar_images: ${existingImages?.length || 0}`);
      console.log(`   - Imágenes en bar_menus: ${existingMenus?.length || 0}`);

      if (hasImages) {
        // Todo está completo: bar creado e imágenes migradas
        console.log(`\n✅ BAR COMPLETAMENTE CONVERTIDO`);
        console.log(`   - Bar creado: ${foundBar.converted_bar_id}`);
        console.log(`   - Imágenes migradas: Sí`);
        console.log(`   Acción: Solo enlazar usuario...`);

        // Solo actualizar users.bar_id si aún no lo tiene
        const { error: updateError } = await supabase
          .from('users')
          .update({ bar_id: foundBar.converted_bar_id })
          .eq('id', userId);

        if (updateError) {
          console.error(`❌ Error actualizando user bar_id:`, updateError);
        } else {
          console.log(`✅ Usuario enlazado al bar ${foundBar.converted_bar_id}`);
        }

        console.log(`========================================\n`);
        
        Alert.alert(
          'Bar Vinculado',
          `Tu bar "${foundBar.name}" ya está activo. Has sido vinculado correctamente.`,
          [{ text: 'OK' }]
        );
        return;
      } else {
        // Bar creado pero imágenes NO migradas → llamar Edge para completar
        console.log(`\n⚠️ BAR PARCIALMENTE CONVERTIDO`);
        console.log(`   - Bar creado: ${foundBar.converted_bar_id}`);
        console.log(`   - Imágenes migradas: NO`);
        console.log(`   Acción: Llamar Edge Function para completar migración de imágenes...`);
        // Continuar con el flujo normal de Edge Function
      }
    }

    // ========================================
    // VERIFICACIÓN: ¿Estado válido para promoción completa?
    // ========================================
    // Solo verificar status si NO tiene converted_bar_id
    // Si tiene converted_bar_id pero sin imágenes, permitir continuar
    if (!foundBar.converted_bar_id && foundBar.status !== 'pre_registered') {
      console.log(`\n⚠️ BAR NO ESTÁ EN ESTADO PRE_REGISTERED`);
      console.log(`   Status actual: ${foundBar.status}`);
      console.log(`   NO se llamará a la Edge Function`);
      console.log(`========================================\n`);
      return;
    }

    if (foundBar.converted_bar_id) {
      console.log(`\n✅ COMPLETANDO MIGRACIÓN DE IMÁGENES`);
      console.log(`   - Bar ID existente: ${foundBar.converted_bar_id}`);
      console.log(`   - Imágenes pendientes: Sí`);
      console.log(`   Procediendo a llamar Edge Function para migrar imágenes...`);
    } else {
      console.log(`\n✅ CONDICIONES VÁLIDAS PARA PROMOCIÓN COMPLETA`);
      console.log(`   - converted_bar_id es NULL`);
      console.log(`   - status es "pre_registered"`);
      console.log(`   Procediendo a llamar Edge Function...`);
    }

    // Get current session for auth token
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      console.error('❌ No session available for Edge Function call');
      console.log(`========================================\n`);
      return;
    }

    // Call Edge Function to promote the bar
    const supabaseUrl = supabase.supabaseUrl;
    const functionUrl = `${supabaseUrl}/functions/v1/promote_pre_registered_bar_with_images`;

    console.log(`\n🚀 LLAMANDO A EDGE FUNCTION`);
    console.log(`   URL: ${functionUrl}`);
    console.log(`   Payload:`, {
      preBarId: preBarId,
      ownerId: userId,
    });

    const requestBody = {
      preBarId: preBarId,
      ownerId: userId,
    };

    console.log(`📤 Enviando petición...`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📥 Respuesta recibida - Status: ${response.status} ${response.statusText}`);

    let result;
    try {
      result = await response.json();
      console.log(`📦 Response body:`, result);
    } catch (parseError) {
      console.error('❌ Error parsing response JSON:', parseError);
      const text = await response.text();
      console.log('📄 Raw response:', text);
      console.log(`========================================\n`);
      return;
    }

    if (!response.ok || !result.success) {
      console.error('❌ ERROR EN EDGE FUNCTION');
      console.error('   Status:', response.status);
      console.error('   Error:', result.error);
      console.error('   Details:', result.details || result);
      console.log(`========================================\n`);
      
      Alert.alert(
        'Aviso',
        'Se encontró un bar pre-registrado para tu email, pero hubo un error al reclamarlo. Contacta con soporte.'
      );
      return;
    }

    console.log(`✅ BAR PROMOVIDO EXITOSAMENTE!`);
    console.log(`   Bar ID: ${result.barId}`);
    console.log(`   Imágenes del bar: ${result.barImagesCount || 0}`);
    console.log(`   Imágenes del menú: ${result.menuImagesCount || 0}`);

    const totalImages = (result.barImagesCount || 0) + (result.menuImagesCount || 0);

    console.log(`\n🎉 PROCESO COMPLETADO`);
    console.log(`   Total imágenes migradas: ${totalImages}`);
    console.log(`========================================\n`);

    // Show success message
    Alert.alert(
      '¡Bar Reclamado!',
      `Tu bar ha sido activado exitosamente${totalImages > 0 ? ` con ${totalImages} imágenes` : ''}. Ya puedes gestionar tu establecimiento.`,
      [{ text: 'OK' }]
    );

  } catch (error: any) {
    console.error('\n❌ EXCEPCIÓN EN checkAndPromotePreRegisteredBar');
    console.error('   Error:', error);
    console.error('   Stack:', error.stack);
    console.log(`========================================\n`);
    // Don't block login if promotion fails
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
// APPLE OAUTH
// ============================================

import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Inicia el flujo de autenticación con Apple Sign-In
 * Solo disponible en iOS
 *
 * @returns Datos de autenticación o lanza error
 * @throws Error si no está disponible o falla
 */
export async function signInWithApple() {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();

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
// PASSWORD RECOVERY
// ============================================

/**
 * Envía email de recuperación de contraseña
 */
export async function sendPasswordResetEmail(
  email: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('📧 Enviando email de recuperación a:', email);

    // Generar URL de redirect correcta según el entorno
    let redirectUrl: string;
    
    if (__DEV__) {
      // En desarrollo, intentar obtener la IP/host del servidor de Expo
      try {
        const hostUri = Constants.expoConfig?.hostUri;
        console.log('🔍 Constants.expoConfig?.hostUri:', hostUri);
        
        if (hostUri) {
          redirectUrl = `exp://${hostUri}/--/auth/reset-password`;
          console.log('✅ URL construida desde hostUri');
        } else {
          // Fallback: usar localhost (funcionará en simulador)
          redirectUrl = 'exp://localhost:8081/--/auth/reset-password';
          console.log('⚠️ Usando localhost como fallback');
        }
      } catch (err) {
        console.error('❌ Error obteniendo hostUri:', err);
        redirectUrl = 'exp://localhost:8081/--/auth/reset-password';
      }
      
      console.log('🔧 URL de desarrollo generada');
    } else {
      // En producción, usar scheme personalizado
      redirectUrl = 'matchmap://auth/reset-password';
      console.log('🔧 URL de producción generada');
    }

    console.log('🔗 Password Reset Redirect URL:', redirectUrl);
    console.log('🌍 Environment:', __DEV__ ? 'Development' : 'Production');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('❌ Error enviando email:', error);
      console.error('   Error code:', error.status);
      console.error('   Error details:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email de recuperación enviado exitosamente');
    console.log('📬 Revisa tu inbox (y spam) en:', email);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Exception al enviar email:', error);
    console.error('   Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Actualiza la contraseña del usuario
 */
export async function updatePassword(
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('🔐 Actualizando contraseña...');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('❌ Error actualizando contraseña:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Contraseña actualizada exitosamente');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Exception:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// ACCOUNT DELETION
// ============================================

/**
 * Elimina la cuenta del usuario actual.
 * Borra datos en public.users y luego elimina el auth user via Edge Function.
 *
 * @returns Objeto con success y error opcional
 */
export async function deleteAccount(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'No se pudo obtener el usuario actual.' };
    }

    // Llamar a Edge Function que maneja la eliminación completa
    // (borrar datos relacionados + auth user con service_role)
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { success: false, error: 'No hay sesión activa.' };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hmtfxpihkoisncglllmq.supabase.co';
    const functionUrl = `${supabaseUrl}/functions/v1/delete-user-account`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: user.id }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Error al eliminar la cuenta.' };
    }

    // Sign out locally after deletion
    await supabase.auth.signOut();

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error inesperado al eliminar la cuenta.' };
  }
}

// ============================================
// TIPOS Y EXPORTS
// ============================================

/**
 * Verifica si el usuario actual es un invitado (sesión anónima).
 * Para uso en Phase 2 — restricción de funciones para invitados.
 */
export const getIsGuest = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.is_anonymous === true;
};

/**
 * Muestra alerta para invitados que intentan usar funciones restringidas.
 * Ofrece navegar al WelcomeScreen para iniciar sesión.
 */
export const showGuestLoginAlert = (router: any) => {
  Alert.alert(
    'Inicia sesión',
    'Necesitas una cuenta para usar esta función.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Iniciar sesión', onPress: () => router.replace('/') },
    ]
  );
};

export type AuthProvider = 'google' | 'apple' | 'facebook';

export interface OAuthError {
  message: string;
  provider: AuthProvider;
  originalError?: any;
}
