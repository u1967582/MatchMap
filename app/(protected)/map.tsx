import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect } from 'react';
import Map from '~/components/Map';
import BottomTabBar from '~/components/ui/BottomTabBar';
import AdBanner from '~/components/ads/AdBanner';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  // Extract bar selection params
  const selectedBarId = params.selectedBarId as string | undefined;
  const selectedBarLat = params.selectedBarLat ? parseFloat(params.selectedBarLat as string) : undefined;
  const selectedBarLng = params.selectedBarLng ? parseFloat(params.selectedBarLng as string) : undefined;
  const selectedBarName = params.selectedBarName as string | undefined;
  const matchId = params.matchId as string | undefined;

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
        initialMatchId={matchId}
      />
      {/* Debajo de topControlsRow (zIndex 1000, termina ~108px) para no competir
          con búsqueda/filtros. pointerEvents box-none deja pasar gestos del mapa
          donde el banner no ha cargado nada. Pendiente de validar visualmente en
          un dev build contra paneles de navegación/partido activo. */}
      <View style={styles.mapAdBannerWrapper} pointerEvents="box-none">
        <AdBanner placement="map" />
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
  mapAdBannerWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 500,
  },
});