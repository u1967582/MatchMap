import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '~/utils/supabase';
import { fetchFavoriteTeamStatus, fetchBettingBarsStatus } from '~/services/users';
import { requestMatchNotificationsPermission } from '~/services/notifications';
import FavoriteTeamPopup from '~/components/FavoriteTeamPopup';
import BettingBarsAgeGatePopup from '~/components/BettingBarsAgeGatePopup';
import { useBettingBarsVisibilityStore } from '~/stores/bettingBarsVisibilityStore';

export default function ProtectedLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [favoriteTeamUserId, setFavoriteTeamUserId] = useState<string | null>(null);
  const [showFavoriteTeamPopup, setShowFavoriteTeamPopup] = useState(false);
  const [bettingBarsUserId, setBettingBarsUserId] = useState<string | null>(null);
  const [showBettingBarsPopup, setShowBettingBarsPopup] = useState(false);
  const router = useRouter();
  const setBettingBarsFromServer = useBettingBarsVisibilityStore((state) => state.setFromServer);

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
        let needsFavoriteTeamPopup = false;

        try {
          const status = await fetchFavoriteTeamStatus(session.user.id);
          if (status && status.favorite_team_prompted_at === null) {
            needsFavoriteTeamPopup = true;
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

        try {
          const bettingStatus = await fetchBettingBarsStatus(session.user.id);
          if (bettingStatus) {
            setBettingBarsFromServer(bettingStatus);
            if (bettingStatus.betting_bars_prompted_at === null) {
              setBettingBarsUserId(session.user.id);
              // No se solapan: si el popup de equipo favorito ya se va a
              // mostrar, este espera a que se cierre (ver onClose de abajo).
              if (!needsFavoriteTeamPopup) {
                setShowBettingBarsPopup(true);
              }
            }
          }
        } catch (error) {
          console.error('Error checking betting bars status:', error);
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
          onClose={() => {
            setShowFavoriteTeamPopup(false);
            // Encadena el popup de apuestas deportivas tras cerrarse este,
            // para que nunca se solapen en un usuario totalmente nuevo.
            if (bettingBarsUserId) {
              setShowBettingBarsPopup(true);
            }
          }}
        />
      )}
      {bettingBarsUserId && (
        <BettingBarsAgeGatePopup
          visible={showBettingBarsPopup}
          userId={bettingBarsUserId}
          mode="onboarding"
          onClose={() => setShowBettingBarsPopup(false)}
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