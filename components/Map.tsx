import { View, StyleSheet, Alert } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import * as MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import SearchBar from '~/components/SearchBar';
import { memo } from 'react';

MapboxGL.setAccessToken('pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w');

const Map: React.FC = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasPermission(true);
        } else {
          Alert.alert(
            'Permisos requeridos',
            'La aplicación necesita permisos de ubicación para mostrar tu posición en el mapa.',
            [{ text: 'Entendido' }]
          );
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        Alert.alert('Error', 'No se pudieron solicitar los permisos de ubicación');
      }
    };

    requestLocationPermission();
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  if (!hasPermission) return null;

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map} styleURL="mapbox://styles/mapbox/dark-v11">
        <MapboxGL.Camera followUserLocation followZoomLevel={15} />
        <MapboxGL.LocationPuck puckBearingEnabled puckBearing="heading" pulsing />
      </MapboxGL.MapView>

      <SearchBar value={searchText} onChangeText={handleSearchChange} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1C2A3A',
  },
  map: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default memo(Map);
