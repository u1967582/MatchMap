import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ErrorState from '~/components/ds/feedback/ErrorState';
import { colors } from '~/components/ds/tokens/colors';
import { reportError } from '~/utils/errorReporting';

interface AppErrorFallbackProps {
  error: Error;
  retry: () => Promise<void> | void;
}

/**
 * Pantalla de «algo ha fallado» del error boundary global (app/_layout.tsx).
 * Reporta el error una vez y permite reintentar renderizando de nuevo la ruta.
 */
export default function AppErrorFallback({ error, retry }: AppErrorFallbackProps) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    reportError(error, { source: 'boundary' });
  }, [error]);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container} testID="app-error-fallback">
      <ErrorState
        title="Algo ha fallado"
        subtitle="Ha ocurrido un error inesperado. Puedes intentarlo de nuevo; si se repite, cierra y vuelve a abrir la app."
        onRetry={handleRetry}
        retryLabel="Reintentar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
});
