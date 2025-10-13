import { Stack, useFocusEffect } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect } from 'react';
import Map from '~/components/Map';
import AdBanner from '~/components/AdBanner';
import BottomTabBar from '~/components/ui/BottomTabBar';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  // Set status bar style when component mounts
  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);
    if (Platform.OS === 'android' && StatusBar.setBackgroundColor) {
      StatusBar.setBackgroundColor('transparent', true);
    }
  }, []);

  const bannerHeight = 50; // BANNER height hint

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 80 : 60) } ]}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'none',
        }} 
      />
      {/* Map fills the screen */}
      <View style={{ flex: 1 }}>
        <Map />
      </View>

      {/* Bottom area: banner above tab bar, respect safe area */}
      <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <AdBanner size="BANNER" />
      </View>
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
}); 