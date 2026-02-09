import { View, StyleSheet } from 'react-native';
import { BaseToast, ErrorToast, BaseToastProps } from 'react-native-toast-message';
import { colors } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

const baseStyle = {
  borderLeftWidth: 3,
  backgroundColor: colors.bg.card,
  borderRadius: radius.lg,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  minHeight: 48,
  width: '88%' as const,
};

const text1Style = {
  fontSize: typography.size.caption,
  fontWeight: typography.weight.semibold,
  color: colors.text.primary,
};

const text2Style = {
  fontSize: typography.size.caption - 1,
  fontWeight: typography.weight.regular,
  color: colors.text.secondary,
};

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={[baseStyle, { borderLeftColor: colors.status.success }]}
      text1Style={text1Style}
      text2Style={text2Style}
      text2NumberOfLines={2}
    />
  ),

  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={[baseStyle, { borderLeftColor: colors.status.error }]}
      text1Style={text1Style}
      text2Style={text2Style}
      text2NumberOfLines={2}
    />
  ),

  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={[baseStyle, { borderLeftColor: colors.brand.primary }]}
      text1Style={text1Style}
      text2Style={text2Style}
      text2NumberOfLines={2}
    />
  ),

  warning: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={[baseStyle, { borderLeftColor: colors.status.warning }]}
      text1Style={text1Style}
      text2Style={text2Style}
      text2NumberOfLines={2}
    />
  ),
};
