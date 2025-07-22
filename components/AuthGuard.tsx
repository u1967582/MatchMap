import { useEffect, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSession } from '~/hooks/useSession';

interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
  redirectTo = '/',
}) => {
  const { isAuthenticated, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (requireAuth && !isAuthenticated) {
      // Redirect to specified route or default welcome screen
      router.replace(redirectTo as any);
    } else if (!requireAuth && isAuthenticated) {
      // Redirect authenticated users away from auth screens
      router.replace('/(protected)/map');
    }
  }, [isAuthenticated, loading, requireAuth, redirectTo, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Don't render children if auth state doesn't match requirements
  if ((requireAuth && !isAuthenticated) || (!requireAuth && isAuthenticated)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C2A3A',
  },
}); 