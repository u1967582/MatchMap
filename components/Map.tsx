import { View, StyleSheet, Alert } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import * as MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import SearchBar from '~/components/SearchBar';
import { memo } from 'react';

// Use environment variable for Mapbox token
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

const Map: React.FC = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setHasPermission(true);
          // Get initial location
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setUserLocation(location);
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

  // Start location tracking when permission is granted
  useEffect(() => {
    if (!hasPermission) return;

    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 10, // Update when user moves 10 meters
          },
          (location) => {
            setUserLocation(location);
            console.log('📍 User location updated:', {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
            });
          }
        );
      } catch (error) {
        console.error('Error starting location tracking:', error);
      }
    };

    startLocationTracking();

    // Cleanup subscription on unmount
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [hasPermission]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <SearchBar value={searchText} onChangeText={handleSearchChange} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView 
        style={styles.map} 
        styleURL="mapbox://styles/mapbox/dark-v11"
      >
        {/* Camera that centers on user location */}
        <MapboxGL.Camera
          centerCoordinate={
            userLocation
              ? [userLocation.coords.longitude, userLocation.coords.latitude]
              : undefined
          }
          zoomLevel={15}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* User location indicator */}
        <MapboxGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />

        {/* Animated location puck */}
        <MapboxGL.LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing
        />

        {/* Custom user location marker (optional - can be removed if using LocationPuck) */}
        {userLocation && (
          <MapboxGL.PointAnnotation
            id="userLocation"
            coordinate={[userLocation.coords.longitude, userLocation.coords.latitude]}
          >
            <View style={styles.userLocationMarker} />
          </MapboxGL.PointAnnotation>
        )}
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C2A3A',
  },
  userLocationMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default memo(Map);
