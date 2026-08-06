import { Stack, useRouter } from 'expo-router';
import { StatusBar, Platform, Linking } from 'react-native';
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
      console.log('🔗 Deep link recibido:', event.url);

      let access_token: string | null = null;
      let refresh_token: string | null = null;
      let isResetPassword = false;

      try {
        // Los tokens pueden venir en el hash fragment (#) o en query params (?)
        const url = new URL(event.url);

        // Intentar extraer del hash fragment primero (formato: #access_token=...&refresh_token=...)
        let authType: string | null = null;

        if (event.url.includes('#')) {
          const hashFragment = event.url.split('#')[1];
          if (hashFragment) {
            const params = new URLSearchParams(hashFragment);
            access_token = params.get('access_token');
            refresh_token = params.get('refresh_token');
            authType = params.get('type'); // 'recovery' para reset password
            console.log('🔍 Tokens encontrados en hash fragment');
          }
        }

        // Si no están en el hash, intentar en query params
        if (!access_token || !refresh_token) {
          access_token = url.searchParams.get('access_token');
          refresh_token = url.searchParams.get('refresh_token');
          authType = url.searchParams.get('type');
          if (access_token || refresh_token) {
            console.log('🔍 Tokens encontrados en query params');
          }
        }

        // Verificar si es un link de reset password (type=recovery)
        isResetPassword =
          authType === 'recovery' ||
          event.url.includes('/auth/reset-password') ||
          event.url.includes('reset-password');

        console.log(
          '🔍 Tipo de deep link:',
          isResetPassword ? 'Reset Password (recovery)' : 'Otro'
        );
        console.log('🔍 Auth type:', authType);

        console.log('📋 Tokens en URL:', {
          hasAccessToken: !!access_token,
          hasRefreshToken: !!refresh_token,
        });

        if (access_token && refresh_token) {
          console.log('🔐 Estableciendo sesión desde deep link...');

          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error('❌ Error estableciendo sesión:', error);
          } else {
            console.log('✅ Sesión establecida exitosamente desde deep link');
            console.log('   Usuario:', data.user?.email);

            // 🚀 NAVEGACIÓN: Si es reset password, navegar a la pantalla correspondiente
            if (isResetPassword) {
              console.log('🧭 Navegando a pantalla de reset password...');
              // Pequeño delay para asegurar que la sesión esté lista
              setTimeout(() => {
                router.push('/auth/reset-password');
              }, 500);
            }
          }
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
        console.log('🚀 App abierta con URL inicial:', url);
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
    <SafeAreaProvider>
      <AdsProvider>
        <RevenueCatProvider>
          <BoostSelectionProvider>
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
          </BoostSelectionProvider>
        </RevenueCatProvider>
      </AdsProvider>
      <ToastRoot config={toastConfig} position="top" topOffset={60} />
    </SafeAreaProvider>
  );
}
