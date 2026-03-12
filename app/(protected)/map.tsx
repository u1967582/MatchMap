import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform, BackHandler, ToastAndroid } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef } from 'react';
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

  // Double back to exit (Android only)
  const lastBackPress = useRef<number>(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress.current = now;
      ToastAndroid.show('Prem back una altra vegada per sortir', ToastAndroid.SHORT);
      return true;
    });

    return () => handler.remove();
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