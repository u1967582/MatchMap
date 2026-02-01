import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect } from 'react';
import Map from '~/components/Map';
import BottomTabBar from '~/components/ui/BottomTabBar';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  // Extract bar selection params
  const selectedBarId = params.selectedBarId as string | undefined;
  const selectedBarLat = params.selectedBarLat ? parseFloat(params.selectedBarLat as string) : undefined;
  const selectedBarLng = params.selectedBarLng ? parseFloat(params.selectedBarLng as string) : undefined;
  const selectedBarName = params.selectedBarName as string | undefined;
  
  // Set status bar style when component mounts
  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);
    if (Platform.OS === 'android' && StatusBar.setBackgroundColor) {
      StatusBar.setBackgroundColor('transparent', true);
    }
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 80 : 60) } ]}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'none',
        }} 
      />
      <Map 
        initialSelectedBarId={selectedBarId}
        initialSelectedBarCoords={selectedBarLat && selectedBarLng ? {
          latitude: selectedBarLat,
          longitude: selectedBarLng
        } : undefined}
        initialSelectedBarName={selectedBarName}
      />
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