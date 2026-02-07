import { useCallback, ReactNode } from 'react';
import { StyleSheet, ViewStyle, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';
import { shadows } from '../tokens/shadows';
import { springs, pressScale } from '../tokens/motion';

interface AppCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  pressable?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AppCard({
  children,
  onPress,
  style,
  pressable = !!onPress,
}: AppCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (pressable) {
      scale.value = withSpring(pressScale.subtle, springs.press);
    }
  }, [pressable, scale]);

  const handlePressOut = useCallback(() => {
    if (pressable) {
      scale.value = withSpring(1, springs.press);
    }
  }, [pressable, scale]);

  return (
    <AnimatedPressable
      style={[styles.card, animatedStyle, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!pressable}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
});
