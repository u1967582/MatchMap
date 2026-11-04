import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '~/utils/supabase';
import { reportError } from '~/utils/errorReporting';

const CACHED_TOKEN_KEY = 'matchmap_expo_push_token';

/**
 * Configura cómo se muestran las notificaciones en foreground y el canal
 * de Android. Llamar una única vez al arrancar la app (app/_layout.tsx).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos de partidos',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch((error) => console.error('Error creando canal de notificaciones:', error));
  }
}

/**
 * Obtiene el Expo Push Token del dispositivo actual. Devuelve null en
 * simuladores/emuladores (no generan tokens válidos) o si falla.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    console.error('No se encontró eas.projectId para generar el Expo Push Token');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    // Sin FCM (Android) o sin aps-environment (iOS) falla aquí: que se vea.
    reportError(error, { extra: { step: 'getExpoPushToken', platform: Platform.OS } });
    return null;
  }
}

/**
 * Registra (o reasigna) el push token del dispositivo actual al usuario
 * autenticado. Usa la RPC security definer fn_register_push_token.
 */
export async function registerPushToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('fn_register_push_token', {
    p_token: token,
    p_platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null,
    p_device_id: Device.modelId ?? Device.modelName ?? null,
  });

  if (error) throw error;

  await AsyncStorage.setItem(CACHED_TOKEN_KEY, token);
}

/**
 * Desregistra el token cacheado del dispositivo actual. Se llama en logout,
 * antes de que la sesión deje de estar disponible para la RPC.
 */
export async function unregisterCurrentPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(CACHED_TOKEN_KEY);
    if (!token) return;

    const { error } = await supabase.rpc('fn_unregister_push_token', { p_token: token });
    if (error) throw error;

    await AsyncStorage.removeItem(CACHED_TOKEN_KEY);
  } catch (error) {
    console.error('Error desregistrando push token:', error);
  }
}

/**
 * Pide permiso de notificaciones solo si el usuario todavía no ha decidido
 * (estado 'undetermined'). No vuelve a preguntar si ya concedió o denegó
 * antes. Si se concede, obtiene y registra el Expo Push Token.
 */
export async function requestMatchNotificationsPermission(
  userId: string
): Promise<'granted' | 'denied' | 'skipped'> {
  if (!Device.isDevice) return 'skipped';

  try {
    const { status: currentStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = currentStatus;
    if (currentStatus === 'undetermined') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return finalStatus === 'denied' ? 'denied' : 'skipped';
    }

    const token = await getExpoPushToken();
    if (!token) return 'skipped';

    await registerPushToken(token);
    return 'granted';
  } catch (error) {
    reportError(error, { extra: { step: 'requestMatchNotificationsPermission' } });
    return 'skipped';
  }
}

/** Lee la preferencia de avisos del equipo favorito del usuario. */
export async function fetchMatchNotificationsEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('match_notifications_enabled')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data?.match_notifications_enabled ?? true;
}

/** Actualiza la preferencia de avisos del equipo favorito del usuario. */
export async function setMatchNotificationsEnabled(
  userId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ match_notifications_enabled: enabled })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Interruptor «Avisos de mi equipo» de Perfil (auditoría 06-H6). Guarda la
 * preferencia y, al activarlo, se asegura de que los avisos puedan llegar:
 * pide permiso si el sistema aún deja preguntar, registra el token y, si el
 * permiso está denegado, ofrece abrir los ajustes del móvil. Sin esto el
 * interruptor salía activado y no llegaba nada.
 */
export async function syncMatchNotificationsToggle(
  userId: string,
  enabled: boolean
): Promise<'granted' | 'denied' | 'skipped' | 'disabled'> {
  await setMatchNotificationsEnabled(userId, enabled);
  if (!enabled) return 'disabled';
  if (!Device.isDevice) return 'skipped';

  let status: 'granted' | 'denied' | 'skipped' = 'skipped';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted' && current.canAskAgain !== false) {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status === 'granted' ? 'granted' : 'denied';
    } else {
      status = current.status === 'granted' ? 'granted' : 'denied';
    }

    if (status === 'granted') {
      const token = await getExpoPushToken();
      if (token) await registerPushToken(token);
    }
  } catch (error) {
    reportError(error, { extra: { step: 'syncMatchNotificationsToggle' } });
    return 'skipped';
  }

  if (status === 'denied') {
    Alert.alert(
      'Notificaciones desactivadas',
      'Para recibir los avisos de tu equipo, activa las notificaciones de MatchMap en los ajustes del móvil.',
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
      ]
    );
  }
  return status;
}
