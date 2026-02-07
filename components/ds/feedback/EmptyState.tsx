import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../primitives/AppText';
import AppButton from '../primitives/AppButton';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = 'search',
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={colors.text.secondary} />
      <AppText variant="title" align="center" style={styles.title}>
        {title}
      </AppText>
      {subtitle && (
        <AppText variant="body" align="center" style={styles.subtitle}>
          {subtitle}
        </AppText>
      )}
      {actionLabel && onAction && (
        <AppButton
          text={actionLabel}
          onPress={onAction}
          variant="primary"
          fullWidth={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxxl,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    marginTop: spacing.lg,
  },
  subtitle: {
    marginBottom: spacing.sm,
  },
});
