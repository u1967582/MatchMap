import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface DividerProps {
  spacing?: number;
  color?: string;
  style?: ViewStyle;
}

export default function Divider({
  spacing: verticalSpacing = spacing.lg,
  color = colors.border.subtle,
  style,
}: DividerProps) {
  return (
    <View
      style={[
        styles.divider,
        { marginVertical: verticalSpacing, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
  },
});
