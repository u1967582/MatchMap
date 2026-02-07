import { useCallback } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AppText from './AppText';
import { colors } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';
import { shadows } from '../tokens/shadows';
import { springs, pressScale } from '../tokens/motion';

interface AppChipProps {
  icon?: string;
  label: string;
  selected?: boolean;
  onPress: () => void;
  haptic?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AppChip({
  icon,
  label,
  selected = false,
  onPress,
  haptic = true,
}: AppChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.normal, springs.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, springs.press);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (haptic) {
      Haptics.selectionAsync();
    }
    onPress();
  }, [onPress, haptic]);

  return (
    <AnimatedPressable
      style={[
        styles.chip,
        selected && styles.chipSelected,
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {icon && (
        <AppText style={styles.icon}>{icon}</AppText>
      )}
      <AppText
        variant="label"
        color={selected ? colors.text.primary : colors.text.secondary}
        style={selected ? styles.labelSelected : undefined}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.element,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.lg - 6,
    borderRadius: radius.xxl,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
    minWidth: 90,
    minHeight: 44,
    ...shadows.sm,
  },
  chipSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
    shadowColor: colors.brand.primary,
    shadowOpacity: 0.4,
  },
  icon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  labelSelected: {
    fontWeight: '700',
  },
});
