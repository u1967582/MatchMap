/**
 * Tokens de tipografía.
 * Valores extraídos de los tamaños y pesos reales del proyecto.
 */
export const typography = {
  size: {
    xs: 9,
    sm: 11,
    caption: 13,
    body: 14,
    input: 15,
    button: 16,
    subtitle: 18,
    title: 20,
    h2: 24,
    h1: 32,
  },

  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  lineHeight: {
    tight: 18,
    normal: 22,
    relaxed: 26,
    heading: 38,
  },
} as const;
