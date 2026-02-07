import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../primitives/AppText';
import AppButton from '../primitives/AppButton';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface ErrorStateProps {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  title = 'Algo salió mal',
  subtitle = 'No se pudo cargar la información. Inténtalo de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={64} color={colors.status.error} />
      <AppText variant="title" align="center" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body" align="center" style={styles.subtitle}>
        {subtitle}
      </AppText>
      {onRetry && (
        <AppButton
          text={retryLabel}
          onPress={onRetry}
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
