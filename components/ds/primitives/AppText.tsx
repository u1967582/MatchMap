import { Text, TextProps, TextStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';

type TextVariant = 'h1' | 'h2' | 'title' | 'subtitle' | 'body' | 'caption' | 'label' | 'button';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

const variantStyles: Record<TextVariant, TextStyle> = {
  h1: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.heading,
    color: colors.text.primary,
  },
  h2: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.relaxed,
    color: colors.text.primary,
  },
  title: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.size.subtitle,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  body: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.regular,
    lineHeight: typography.lineHeight.normal,
    color: colors.text.secondary,
  },
  caption: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.medium,
    color: colors.text.muted,
  },
  label: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
  },
  button: {
    fontSize: typography.size.button,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
};

export default function AppText({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[
        variantStyles[variant],
        color !== undefined && { color },
        align !== undefined && { textAlign: align },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
