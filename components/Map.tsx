import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import SearchBarWithResults from '~/components/SearchBarWithResults';
import { supabase } from '~/utils/supabase';

// Use environment variable for Mapbox token
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);



const Map: React.FC = () => {
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [userLocation, setUserLocation] = React.useState<Location.LocationObject | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [cameraCenter, setCameraCenter] = React.useState<[number, number] | null>(null);
  const [cameraZoom, setCameraZoom] = React.useState(15);



  React.useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setHasPermission(status === 'granted');
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        setHasPermission(false);
      }
    };

    requestLocationPermission();
  }, []);



  // Search for locations using Mapbox Geocoding API
  const searchLocations = React.useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const encodedQuery = encodeURIComponent(query);
      // Búsqueda más genérica: incluye ciudades, regiones, países, POI y direcciones
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=place,poi,address&limit=8&language=es&autocomplete=true`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features) {
        setSearchResults(data.features);
        console.log('📍 Search results:', data.features.length, 'locations found');
        console.log('📍 Sample results:', data.features.slice(0, 3).map((f: any) => f.place_name));
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Error searching locations:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search text change with debouncing
  const handleSearchChange = React.useCallback((text: string) => {
    setSearchText(text);
  }, []);

  // Debounced search effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchText.trim()) {
        searchLocations(searchText);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText, searchLocations]);

  // Handle location selection
  const handleLocationSelect = React.useCallback((location: any) => {
    const [longitude, latitude] = location.center;
    
    console.log('📍 Selected location:', location.place_name);
    console.log('📍 Coordinates:', latitude, longitude);
    console.log('📍 Place type:', location.place_type);
    
    // Determine appropriate zoom level based on place type
    let zoomLevel = 16; // Default for specific addresses/POIs
    
    if (location.place_type?.includes('place')) {
      // Cities, regions, countries - use wider zoom
      zoomLevel = 12;
    } else if (location.place_type?.includes('poi')) {
      // Points of interest - medium zoom
      zoomLevel = 15;
    } else if (location.place_type?.includes('address')) {
      // Specific addresses - close zoom
      zoomLevel = 16;
    }
    
    // Center camera on selected location
    setCameraCenter([longitude, latitude]);
    setCameraZoom(zoomLevel);
    
    // Clear search
    setSearchText(location.place_name);
    setSearchResults([]);
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <SearchBarWithResults 
            value={searchText} 
            onChangeText={handleSearchChange}
            searchResults={[]}
            isSearching={false}
            onLocationSelect={() => {}}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapboxGL.MapView 
        style={styles.map} 
        styleURL="mapbox://styles/mapbox/dark-v11"
        scaleBarEnabled={false}
      >
        {/* Camera that centers on user location or search result */}
        <MapboxGL.Camera
          centerCoordinate={
            cameraCenter || (userLocation
              ? [userLocation.coords.longitude, userLocation.coords.latitude]
              : undefined)
          }
          zoomLevel={cameraZoom}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* User location indicator */}
        <MapboxGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />

      </MapboxGL.MapView>

      <SearchBarWithResults 
        value={searchText} 
        onChangeText={handleSearchChange}
        searchResults={searchResults}
        isSearching={isSearching}
        onLocationSelect={handleLocationSelect}
      />

      {/* Center on user location button */}
      {userLocation && (
        <TouchableOpacity
          style={styles.centerButton}
          onPress={() => {
            setCameraCenter([userLocation.coords.longitude, userLocation.coords.latitude]);
            setCameraZoom(15);
          }}
        >
          <Ionicons name="locate" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      

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
  },
  map: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#3A4A5C',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});

export default Map;
