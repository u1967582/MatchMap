import * as React from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';

export type MarkerType = 'default' | 'boosted' | 'selected';

interface BarMapMarkerProps {
  type: MarkerType;
  animated?: boolean;
  onPress?: () => void;
}

/**
 * BarMapMarker Component - Versión mejorada
 * 
 * Marcadores de mapa más elegantes y pequeños:
 * - default: Marcador azul para bares regulares
 * - boosted: Marcador dorado con animación sutil para bares promocionados
 * - selected: Marcador naranja para el bar seleccionado
 */
const BarMapMarker: React.FC<BarMapMarkerProps> = ({ type, animated = false, onPress }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    console.log(`🎨 BarMapMarker rendered: type=${type}, animated=${animated}`);
  }, [type, animated]);

  // Animación de pulso sutil para marcadores boosted
  React.useEffect(() => {
    if (type === 'boosted' && animated) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [type, animated, pulseAnim]);

  // Estilos según el tipo de marcador
  const bubbleStyle = [
    styles.markerBubble,
    type === 'boosted' && styles.markerBubbleBoosted,
    type === 'selected' && styles.markerBubbleSelected,
  ];

  const tailStyle = [
    styles.markerTail,
    type === 'boosted' && styles.markerTailBoosted,
    type === 'selected' && styles.markerTailSelected,
  ];

  const containerStyle = type === 'boosted' && animated
    ? { transform: [{ scale: pulseAnim }] }
    : {};

  const MarkerContent = () => (
    <Animated.View style={[styles.markerContainer, containerStyle]}>
      {/* Burbuja principal del marcador */}
      <View style={bubbleStyle}>
        {/* Punto interior para mejor definición */}
        <View style={[
          styles.innerDot,
          type === 'boosted' && styles.innerDotBoosted,
          type === 'selected' && styles.innerDotSelected,
        ]} />
      </View>
      
      {/* Punta del marcador (triángulo hacia abajo) */}
      <View style={tailStyle} />
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
        <MarkerContent />
      </TouchableOpacity>
    );
  }

  return <MarkerContent />;
};

const styles = StyleSheet.create({
  touchableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ========== BURBUJA PRINCIPAL - Diseño minimalista y elegante ==========
  markerBubble: {
    width: 24,                    // Más pequeño (era 32)
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A90E2',   // Azul moderno y limpio
    borderWidth: 2,               // Borde definido pero no excesivo
    borderColor: '#FFFFFF',       // Borde blanco para contraste limpio
    justifyContent: 'center',
    alignItems: 'center',
    // Sombra sutil y elegante
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  markerBubbleBoosted: {
    backgroundColor: '#F5A623',   // Dorado elegante
    borderColor: '#FFFFFF',
    // Sombra ligeramente más visible para destacar
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  markerBubbleSelected: {
    backgroundColor: '#FF6B6B',   // Rojo coral elegante
    borderColor: '#FFFFFF',
    borderWidth: 2.5,             // Borde ligeramente más grueso para énfasis
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 7,
  },

  // ========== PUNTO INTERIOR - Minimalista y definido ==========
  innerDot: {
    width: 8,                     // Más pequeño y proporcionado
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },
  innerDotBoosted: {
    backgroundColor: '#FFFFFF',
    opacity: 1,
    // Añade un toque de brillo sutil
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  innerDotSelected: {
    backgroundColor: '#FFFFFF',
    opacity: 1,
  },

  // ========== PUNTA DEL MARCADOR - Proporcionada y definida ==========
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,           // Más pequeño y proporcionado
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',    // Blanco para continuidad con el borde
    marginTop: -2,
    // Sombra sutil para definir el contorno
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  markerTailBoosted: {
    borderTopColor: '#FFFFFF',
  },
  markerTailSelected: {
    borderTopColor: '#FFFFFF',
  },
});

export default BarMapMarker;