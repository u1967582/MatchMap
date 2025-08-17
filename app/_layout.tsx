import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function Layout() {
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
