import ToastLib from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

/**
 * Helper para mostrar toasts con haptic feedback.
 *
 * Uso:
 *   toast.success('Guardado correctamente');
 *   toast.error('No se pudo guardar', 'Revisa tu conexión');
 *   toast.info('Nuevo partido disponible');
 *   toast.warning('Límite casi alcanzado');
 *   toast.supabaseError(error, 'No se pudo cargar los datos');
 */
export const toast = {
  success(title: string, subtitle?: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    ToastLib.show({ type: 'success', text1: title, text2: subtitle });
  },

  error(title: string, subtitle?: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    ToastLib.show({ type: 'error', text1: title, text2: subtitle });
  },

  info(title: string, subtitle?: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ToastLib.show({ type: 'info', text1: title, text2: subtitle });
  },

  warning(title: string, subtitle?: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    ToastLib.show({ type: 'warning', text1: title, text2: subtitle });
  },

  /**
   * Muestra un toast de error parseando errores de Supabase
   * @param error Error de Supabase (PostgrestError, AuthError, etc.)
   * @param fallbackMsg Mensaje por defecto si no se puede parsear el error
   */
  supabaseError(error: any, fallbackMsg: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    let message = fallbackMsg;
    let subtitle: string | undefined;

    // Intentar extraer mensaje legible del error
    if (error) {
      if (typeof error === 'string') {
        message = error;
      } else if (error.message) {
        // PostgrestError o AuthError
        const errorMsg = error.message.toLowerCase();

        // Mensajes comunes de Supabase en español
        if (errorMsg.includes('invalid login credentials')) {
          message = 'Email o contraseña incorrectos';
        } else if (errorMsg.includes('email not confirmed')) {
          message = 'Email no verificado';
          subtitle = 'Revisa tu correo para confirmar tu cuenta';
        } else if (errorMsg.includes('user already registered')) {
          message = 'Este email ya está registrado';
        } else if (errorMsg.includes('network')) {
          message = 'Error de conexión';
          subtitle = 'Revisa tu conexión a internet';
        } else if (errorMsg.includes('timeout')) {
          message = 'La operación tardó demasiado';
          subtitle = 'Inténtalo de nuevo';
        } else {
          // Usar mensaje original del error
          message = fallbackMsg;
          subtitle = error.message;
        }
      }
    }

    ToastLib.show({ type: 'error', text1: message, text2: subtitle });
  },
};
