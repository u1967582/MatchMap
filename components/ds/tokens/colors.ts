/**
 * Paleta de colores del Design System.
 * Extraída de los valores reales usados en el proyecto.
 */
export const colors = {
  // Backgrounds (dark theme)
  bg: {
    primary: '#1C2A3A',
    card: '#1A2332',
    elevated: '#2A3A4A',
    element: '#243243',
    input: '#3A4A5C',
    surface: '#1E2A38',
    muted: '#2C3E50',
    match: '#1E3A5F',
  },

  // Brand
  brand: {
    primary: '#1976D2',
    primaryDark: '#1565C0',
    link: '#007AFF',
    accent: '#10B981',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#A3B3CC',
    muted: '#8E8E93',
    soft: '#CDE6FF',
    light: '#E5E7EB',
    inverse: '#000000',
  },

  // Status / Semantic
  status: {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    boost: '#FFD700',
    destructive: '#FF6B6B',
  },

  // Borders
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    medium: '#3B4B5B',
    outline: '#CDE6FF',
  },

  // Overlays
  overlay: {
    dark: 'rgba(0, 0, 0, 0.5)',
    medium: 'rgba(0, 0, 0, 0.4)',
    light: 'rgba(0, 0, 0, 0.3)',
  },

  // Transparent variants
  alpha: {
    brandLight: 'rgba(0, 122, 255, 0.1)',
    brandBorder: 'rgba(0, 122, 255, 0.3)',
    boostGlow: 'rgba(255, 215, 0, 0.4)',
  },

  // Tags (specific colors for category badges)
  tags: {
    category: '#5A8FBF',
    food: '#D89B6A',
    tv: '#7FB894',
    feature: '#B084B8',
  },
} as const;
