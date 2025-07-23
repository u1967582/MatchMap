import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import * as MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '~/components/SearchBar';
import { memo } from 'react';

MapboxGL.setAccessToken('pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w');

const Map: React.FC = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [searchText, setSearchText] = useState('');
  const cameraRef = useRef<any>(null);

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

  const centerMapOnUser = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la ubicación.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Center the map on user location
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [location.coords.longitude, location.coords.latitude],
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación actual.');
    }
  }, []);

  if (!hasPermission) return null;

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map} styleURL="mapbox://styles/mapbox/dark-v11">
        <MapboxGL.Camera 
          ref={cameraRef}
          followUserLocation 
          followZoomLevel={15} 
        />
        <MapboxGL.LocationPuck puckBearingEnabled puckBearing="heading" pulsing />
      </MapboxGL.MapView>

      <SearchBar value={searchText} onChangeText={handleSearchChange} />
      
      {/* Center Location Button */}
      <TouchableOpacity
        style={styles.centerButton}
        onPress={centerMapOnUser}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={24} color="white" />
      </TouchableOpacity>
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
  centerButton: {
    position: 'absolute',
    bottom: 100, // justo encima del tab bar
    right: 20,
    backgroundColor: '#4A90E2', // Color más claro (azul más suave)
    padding: 12,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10,
  },
});

export default memo(Map);
