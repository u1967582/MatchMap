import React from 'react';
import { View, ViewStyle } from 'react-native';

interface Props {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

const Gradient: React.FC<Props> = ({ colors, style, children }) => {
  // Lightweight fallback: render a solid color using the first provided color.
  // This avoids bundling optional native modules in environments where they aren't installed.
  const backgroundColor = colors?.[0] || '#1976D2';
  return <View style={[{ backgroundColor }, style]}>{children}</View>;
};

export default Gradient;


