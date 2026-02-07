import React, { useCallback } from 'react';
import { StyleSheet, ActivityIndicator, ViewStyle, Pressable } from 'react-native';
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
import { springs, pressScale } from '../tokens/motion';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'dark' | 'ghost';

interface AppButtonProps {
  text: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variantBg: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.brand.link },
  secondary: { backgroundColor: colors.bg.surface },
  outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.border.outline },
  dark: { backgroundColor: colors.bg.input },
  ghost: { backgroundColor: 'transparent' },
};

const variantTextColor: Record<ButtonVariant, string> = {
  primary: colors.text.primary,
  secondary: colors.text.soft,
  outline: colors.text.soft,
  dark: colors.text.primary,
  ghost: colors.brand.link,
};

const variantLoadingColor: Record<ButtonVariant, string> = {
  primary: colors.text.primary,
  secondary: colors.text.muted,
  outline: colors.text.muted,
  dark: colors.text.primary,
  ghost: colors.brand.link,
};

export default function AppButton({
  text,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  haptic = true,
}: AppButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.subtle, springs.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, springs.press);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [onPress, haptic]);

  return (
    <AnimatedPressable
      style={[
        styles.base,
        variantBg[variant],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variantLoadingColor[variant]} size="small" />
      ) : (
        <AppText variant="button" color={variantTextColor[variant]}>
          {text}
        </AppText>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
});
