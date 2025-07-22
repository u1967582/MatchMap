import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSession } from '~/hooks/useSession';

export default function AuthLayout() {
  const { isAuthenticated, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // If user is already logged in, redirect to main app
      router.replace('/(protected)/map');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // If user is authenticated, don't render anything (will redirect)
  if (isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Only render the auth screens if user is NOT authenticated
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        presentation: 'card',
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' }
      }} 
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C2A3A',
  },
}); 