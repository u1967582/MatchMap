import { Platform, ViewStyle } from 'react-native';

/**
 * Tokens de sombras.
 * Valores extraídos de los componentes existentes.
 */
export const shadows = {
  /** Sombra suave para cards y elementos elevados */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  } satisfies ViewStyle,

  /** Sombra media para elementos flotantes */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } satisfies ViewStyle,

  /** Sombra fuerte para tab bar y overlays */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  } satisfies ViewStyle,

  /** Sin sombra */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } satisfies ViewStyle,
} as const;
