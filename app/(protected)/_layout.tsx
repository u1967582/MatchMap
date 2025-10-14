import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '~/utils/supabase';

export default function ProtectedLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const authenticated = !!session;
      if (!isMounted) return;
      if (!authenticated) {
        router.replace('/');
        return;
      }
      setIsAuthenticated(authenticated);
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const authenticated = !!session;
        if (!isMounted) return;
        if (!authenticated) {
          router.replace('/');
        } else if (isAuthenticated !== authenticated) {
          setIsAuthenticated(authenticated);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Only render the stack if user is authenticated
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        presentation: 'card',
        animation: 'none',
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