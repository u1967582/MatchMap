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
};
