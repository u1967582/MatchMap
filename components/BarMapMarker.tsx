import * as React from 'react';
import { StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MarkerType = 'default' | 'boosted' | 'selected' | 'destination';

interface BarMapMarkerProps {
  type: MarkerType;
  animated?: boolean;
  onPress?: () => void;
}

// Configuración de colores por tipo (en orden de prioridad)
const MARKER_COLORS = {
  destination: '#EF4444',  // Rojo (máxima prioridad)
  boosted: '#FFD700',      // Dorado
  selected: '#60A5FA',     // Azul claro
  default: '#007AFF',      // Azul (mínima prioridad)
};

const MARKER_SIZES = {
  destination: 36,
  boosted: 36,
  selected: 36,
  default: 32,
};

/**
 * BarMapMarker Component - Versión unificada simple
 * 
 * Todos los marcadores usan el mismo icono de ubicación con diferentes colores:
 * - destination: Rojo (#EF4444) - Destino de navegación
 * - boosted: Dorado (#FFD700) - Bar promocionado
 * - selected: Azul claro (#60A5FA) - Bar con card visible
 * - default: Azul (#007AFF) - Bar predeterminado
 */
const BarMapMarker: React.FC<BarMapMarkerProps> = React.memo(({ type, animated = false, onPress }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Animación de pulso para marcadores boosted y destination
  React.useEffect(() => {
    if ((type === 'boosted' || type === 'destination') && animated) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [type, animated, pulseAnim]);

  const color = MARKER_COLORS[type];
  const size = MARKER_SIZES[type];

  const containerStyle = (type === 'boosted' || type === 'destination') && animated
    ? { transform: [{ scale: pulseAnim }] }
    : {};

  const markerView = (
    <Animated.View style={[styles.markerContainer, containerStyle]}>
      <Ionicons name="location" size={size} color={color} />
    </Animated.View>
  );

  // Si tiene onPress, envolver en TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={() => {
          console.log('🎯 BarMapMarker pressed, type:', type);
          onPress();
        }}
        activeOpacity={0.7}
        style={styles.touchableContainer}
      >
        {markerView}
      </TouchableOpacity>
    );
  }

  return markerView;
});

const styles = StyleSheet.create({
  touchableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BarMapMarker;