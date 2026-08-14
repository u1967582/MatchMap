import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from './AppText';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/radius';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accentColor?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor = colors.brand.primary,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.option, active && { backgroundColor: `${accentColor}1f` }]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <AppText variant="label" color={active ? accentColor : colors.text.secondary} maxScale={1.0}>
              {option.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radius.pill,
    padding: spacing.xxs,
    gap: spacing.xxs,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
