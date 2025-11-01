/**
 * @deprecated This component is deprecated and has been replaced by BarMapMarker
 * 
 * Please use BarMapMarker instead which provides:
 * - Three distinct marker states (default, boosted, selected)
 * - Better visual design with custom styling
 * - Smooth animations for boosted markers
 * - Better integration with the boost system
 * 
 * @see /components/BarMapMarker.tsx
 * @see /docs/MAP_MARKERS_IMPLEMENTATION.md
 */

import * as React from 'react';
import { Image, StyleSheet } from 'react-native';

interface BarMarkerProps {
  size?: number;
  selected?: boolean;
  category?: string;
  rating?: number;
  barId?: string;
}

const BarMarker: React.FC<BarMarkerProps> = ({ 
  size = 40, 
  selected = false,
  category,
  rating,
  barId
}) => {
  console.warn('BarMarker is deprecated. Please use BarMapMarker instead.');
  
  return (
    <Image
      source={require('~/assets/marker.png')}
      style={[
        styles.markerImage,
        { width: size, height: size },
        selected && styles.selected
      ]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  markerImage: {
    width: '100%',
    height: '100%',
  },
  selected: {
    transform: [{ scale: 1.2 }],
  },
});

export default BarMarker; 