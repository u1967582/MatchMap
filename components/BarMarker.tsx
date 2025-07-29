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