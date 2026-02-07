import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/**
 * Tokens de animación para Reanimated.
 */

/** Duraciones en ms */
export const duration = {
  fast: 100,
  normal: 200,
  slow: 350,
} as const;

/** Configs de spring reutilizables */
export const springs = {
  /** Press feedback: rebote rápido y sutil */
  press: {
    damping: 15,
    stiffness: 400,
    mass: 0.5,
  } satisfies WithSpringConfig,

  /** Transiciones suaves entre estados */
  smooth: {
    damping: 20,
    stiffness: 200,
    mass: 0.8,
  } satisfies WithSpringConfig,

  /** Bounce para entradas llamativas */
  bouncy: {
    damping: 12,
    stiffness: 150,
    mass: 0.6,
  } satisfies WithSpringConfig,
} as const;

/** Configs de timing reutilizables */
export const timings = {
  /** Fade in/out rápido */
  fade: {
    duration: duration.normal,
    easing: Easing.out(Easing.cubic),
  } satisfies WithTimingConfig,

  /** Skeleton pulse */
  pulse: {
    duration: 800,
    easing: Easing.inOut(Easing.ease),
  } satisfies WithTimingConfig,
} as const;

/** Valores de escala para press animations */
export const pressScale = {
  subtle: 0.97,
  normal: 0.95,
  strong: 0.9,
} as const;
