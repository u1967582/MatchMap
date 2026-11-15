import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { EmptyState, colors } from '~/components/ds';
import { useIsAdmin } from '~/hooks/useIsAdmin';

/**
 * Guardia de cliente para pantallas de admin que se pueden abrir por deep link.
 * No monta la pantalla hasta confirmar que el usuario es super admin. La
 * protección real sigue en el servidor (RLS e is_super_admin() en las RPC).
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon="lock-closed-outline"
          title="Acceso restringido"
          subtitle="Esta pantalla es solo para administradores."
          actionLabel="Volver"
          onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

export function withAdminOnly<P extends object>(Screen: React.ComponentType<P>) {
  return function AdminOnlyScreen(props: P) {
    return (
      <AdminOnly>
        <Screen {...props} />
      </AdminOnly>
    );
  };
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.primary,
  },
});
