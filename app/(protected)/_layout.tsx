import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '~/utils/supabase';
import { fetchFavoriteTeamStatus } from '~/services/users';
import { requestMatchNotificationsPermission } from '~/services/notifications';
import FavoriteTeamPopup from '~/components/FavoriteTeamPopup';

export default function ProtectedLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [favoriteTeamUserId, setFavoriteTeamUserId] = useState<string | null>(null);
  const [showFavoriteTeamPopup, setShowFavoriteTeamPopup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuthState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const authenticated = !!session;

      if (!authenticated) {
        // Redirect to home if not authenticated
        router.replace('/');
        return;
      }

      setIsAuthenticated(authenticated);

      if (!session.user.is_anonymous) {
        try {
          const status = await fetchFavoriteTeamStatus(session.user.id);
          if (status && status.favorite_team_prompted_at === null) {
            setFavoriteTeamUserId(session.user.id);
            setShowFavoriteTeamPopup(true);
          } else if (status && status.favorite_team_id) {
            // Usuarios que ya eligieron equipo antes de esta feature (o en
            // una sesión anterior) nunca vuelven a ver el popup, así que
            // nunca se les pediría permiso de notificaciones. La función
            // es idempotente: no repregunta si el estado ya no es
            // 'undetermined', así que es seguro llamarla en cada sesión.
            requestMatchNotificationsPermission(session.user.id).catch((err) =>
              console.error('Error solicitando permiso de notificaciones:', err)
            );
          }
        } catch (error) {
          console.error('Error checking favorite team status:', error);
        }
      }
    };

    checkAuthState();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const authenticated = !!session;

        if (!authenticated) {
          // Redirect to home if user logs out
          router.replace('/');
        } else {
          setIsAuthenticated(authenticated);
        }
      }
    );

    return () => subscription.unsubscribe();
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
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: 'card',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' }
        }}
      />
      {favoriteTeamUserId && (
        <FavoriteTeamPopup
          visible={showFavoriteTeamPopup}
          userId={favoriteTeamUserId}
          mode="onboarding"
          onClose={() => setShowFavoriteTeamPopup(false)}
        />
      )}
    </>
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