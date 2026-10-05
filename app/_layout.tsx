import { Stack, useRouter } from 'expo-router';
import { StatusBar, Platform, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import ToastRoot from 'react-native-toast-message';
import { BoostSelectionProvider } from '~/context/BoostSelectionContext';
import { RevenueCatProvider } from '~/contexts/RevenueCatContext';
import { AdsProvider } from '~/contexts/AdsContext';
import { supabase } from '~/utils/supabase';
import { toastConfig } from '~/components/ds/feedback/ToastConfig';
import { useFavoritesStore } from '~/stores/favoritesStore';
import { useLikesStore } from '~/stores/likesStore';
import { configureNotificationHandler, unregisterCurrentPushToken } from '~/services/notifications';
import { parseAuthDeepLink } from '~/utils/authDeepLink';
export default function Layout() {
  const router = useRouter();
  const setFavoritesUserId = useFavoritesStore((state) => state.setUserId);
  const setLikesUserId = useLikesStore((state) => state.setUserId);

  useEffect(() => {
    configureNotificationHandler();

    type NotificationData = { matchId?: string; type?: string };

    const handleNotificationTap = (data: NotificationData | undefined) => {
      if (data?.type === 'favorite_team_match' && data.matchId) {
        router.push({ pathname: '/(protected)/map', params: { matchId: data.matchId } });
      }
    };

    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationTap(response.notification.request.content.data as NotificationData);
      }
    );

    // Cubre el caso de la app abierta en frío tocando la notificación
    Notifications.getLastNotificationResponseAsync().then((response) => {
      handleNotificationTap(response?.notification.request.content.data as NotificationData);
    });

    return () => {
      notificationSubscription.remove();
    };
  }, [router]);

  useEffect(() => {
    // Configure Android navigation bar
    if (Platform.OS === 'android') {
      try {
        const NavigationBar: any = requireOptionalNativeModule('ExpoNavigationBar');
        if (NavigationBar && NavigationBar.setBackgroundColorAsync) {
          NavigationBar.setBackgroundColorAsync('#1C2A3A');
          if (NavigationBar.setButtonStyleAsync) {
            NavigationBar.setButtonStyleAsync('dark');
          }
        }
      } catch {
        // no-op if module not available (Expo Go)
      }
    }

    // Initialize session on app start
    initializeSession();

    // 🔥 Listener de auth state para manejar login/logout
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth State Change en _layout:', event);

      if (event === 'SIGNED_IN' && session) {
        // Inicializar stores con el userId
        setFavoritesUserId(session.user.id);
        setLikesUserId(session.user.id);
        console.log('🔄 Stores inicializados con userId:', session.user.id);

        // No redirigir al mapa si es sesión anónima (guest en WelcomeScreen)
        if (session.user.is_anonymous) {
          console.log('👤 Sesión anónima detectada, no redirigir al mapa');
          return;
        }

        console.log('✅ Usuario autenticado en _layout, navegando a mapa...');
        // Pequeño delay para asegurar que todo esté listo
        setTimeout(() => {
          router.replace('/(protected)/map');
        }, 300);
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 Usuario cerró sesión en _layout, navegando a inicio...');
        // Desregistrar el push token del dispositivo antes de perder la sesión
        unregisterCurrentPushToken();
        // Limpiar stores
        setFavoritesUserId(null);
        setLikesUserId(null);
        console.log('🧹 Stores limpiados');
        router.replace('/');
      }
    });

    // 🔥 NUEVO: Manejar deep links de autenticación de Supabase
    const handleDeepLink = async (event: { url: string }) => {
      try {
        const link = parseAuthDeepLink(event.url);
        if (!link) return;

        if (link.kind === 'callback') {
          // Nunca reemplazar una sesión real ya iniciada con tokens de un enlace
          const { data: current } = await supabase.auth.getSession();
          if (current.session && !current.session.user.is_anonymous) {
            console.log('ℹ️ Ya hay una sesión activa, se ignoran los tokens del enlace');
            return;
          }
        }

        console.log('🔐 Estableciendo sesión desde deep link...', link.kind);

        const { error } = await supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        });

        if (error) {
          console.error('❌ Error estableciendo sesión:', error);
          return;
        }

        console.log('✅ Sesión establecida exitosamente desde deep link');

        // 🚀 NAVEGACIÓN: Si es reset password, navegar a la pantalla correspondiente
        if (link.kind === 'recovery') {
          // Pequeño delay para asegurar que la sesión esté lista
          setTimeout(() => {
            router.push('/auth/reset-password');
          }, 500);
        }
      } catch (err) {
        console.error('❌ Error procesando deep link:', err);
      }
    };

    // Escuchar deep links entrantes
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Verificar si la app se abrió con un deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🚀 App abierta con URL inicial');
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
      authSubscription.unsubscribe();
    };
  }, []);

  const initializeSession = async () => {
    try {
      // This will automatically restore the session from AsyncStorage if it exists
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Error al inicializar la sesión:', error);
        return;
      }

      if (session) {
        console.log('✅ Sesión restaurada automáticamente al iniciar la app');
        console.log('   Usuario:', session.user.email);
        // Inicializar stores con el userId
        setFavoritesUserId(session.user.id);
        setLikesUserId(session.user.id);
        console.log('🔄 Stores inicializados en session restore con userId:', session.user.id);
      } else {
        console.log('ℹ️ No hay sesión guardada');
      }
    } catch (error) {
      console.error('❌ Error inesperado al verificar la sesión:', error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AdsProvider>
          <RevenueCatProvider>
            <BoostSelectionProvider>
              <BottomSheetModalProvider>
                <StatusBar barStyle="light-content" backgroundColor="#1C2A3A" translucent={false} />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    presentation: 'card',
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                    contentStyle: { backgroundColor: '#1C2A3A' },
                  }}
                />
              </BottomSheetModalProvider>
            </BoostSelectionProvider>
          </RevenueCatProvider>
        </AdsProvider>
        <ToastRoot config={toastConfig} position="top" topOffset={60} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
