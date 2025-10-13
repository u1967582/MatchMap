import { Stack } from 'expo-router';
import { StatusBar, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import Constants from 'expo-constants';
import AppOpenAdHandler from '~/components/AppOpenAdHandler';

export default function Layout() {
  useEffect(() => {
    // Initialize Google Mobile Ads SDK early (skip in Expo Go)
    if (Constants.appOwnership !== 'expo') {
      import('react-native-google-mobile-ads')
        .then(m => m.default().initialize())
        .catch(() => {
          // Avoid crashing if initialization fails (e.g., missing Google Services during dev)
        });
    }

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
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1C2A3A" translucent={false} />
      <AppOpenAdHandler />
      <Stack 
        screenOptions={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#1C2A3A' }
        }}
      />
    </SafeAreaProvider>
  );
}
