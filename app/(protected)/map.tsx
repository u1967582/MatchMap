import { Stack } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import Map from '~/components/Map';
import AdBanner from '~/components/AdBanner';
import BottomTabBar from '~/components/ui/BottomTabBar';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  // Derive visibility directly from focus + plan to avoid state loops
  // Map screen is ad-free to guarantee stability
  // Set status bar style when component mounts
  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);
    if (Platform.OS === 'android' && StatusBar.setBackgroundColor) {
      StatusBar.setBackgroundColor('transparent', true);
    }
  }, []);

  // No auth/subscription checks here to avoid focus loops

  // No effect needed; showAd is derived, preventing update loops

  const bannerHeight = 50; // reserved (unused)

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

      {/* Floating ad overlay above the tab bar */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: (Platform.OS === 'ios' ? 80 : 64) + Math.max(insets.bottom, 8),
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#1A2332',
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
              width: '100%',
            }}
          >
            <AdBanner />
          </View>
        </View>
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