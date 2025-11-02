import { Stack } from 'expo-router';
import { StatusBar, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { BoostSelectionProvider } from '~/context/BoostSelectionContext';
import { supabase } from '~/utils/supabase';

export default function Layout() {
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
  }, []);

  const initializeSession = async () => {
    try {
      // This will automatically restore the session from AsyncStorage if it exists
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Error al inicializar la sesión:', error);
        return;
      }

      if (session) {
        console.log('✅ Sesión restaurada automáticamente al iniciar la app');
        console.log('   Usuario:', session.user.email);
      } else {
        console.log('ℹ️ No hay sesión guardada');
      }
    } catch (error) {
      console.error('❌ Error inesperado al verificar la sesión:', error);
    }
  };

  return (
    <SafeAreaProvider>
      <BoostSelectionProvider>
        <StatusBar barStyle="light-content" backgroundColor="#1C2A3A" translucent={false} />
        <Stack
          screenOptions={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1C2A3A' }
          }}
        />
      </BoostSelectionProvider>
    </SafeAreaProvider>
  );
}
