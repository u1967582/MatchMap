import { View, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import Mapbox, { Camera, MapView, LocationPuck } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import SearchBar from '~/components/SearchBar';

Mapbox.setAccessToken('pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w');

export default function Map() {
  const [hasPermission, setHasPermission] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
      } else {
        alert('Permisos de ubicación no concedidos');
      }
    })();
  }, []);

  if (!hasPermission) return null;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} styleURL="mapbox://styles/mapbox/dark-v11">
        <Camera followUserLocation followZoomLevel={15} />
        <LocationPuck puckBearingEnabled puckBearing="heading" pulsing />
      </MapView>

      <SearchBar value={searchText} onChangeText={setSearchText} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
