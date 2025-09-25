import { Stack } from 'expo-router';
import { StatusBar, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { installNativeEventEmitterWorkaround } from '../utils/polyfills';
import { requireOptionalNativeModule } from 'expo-modules-core';

export default function Layout() {
  useEffect(() => {
    installNativeEventEmitterWorkaround();
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
