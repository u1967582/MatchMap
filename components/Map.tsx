import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import SearchBarWithResults from '~/components/SearchBarWithResults';
import BarInfoCard from '~/components/BarInfoCard';
import { supabase } from '~/utils/supabase';

// Use environment variable for Mapbox token
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

interface Bar {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  image_url?: string;
  rating?: number;
  review_count?: number;
  distance_km?: number;
}

const Map: React.FC = () => {
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [userLocation, setUserLocation] = React.useState<Location.LocationObject | null>(null);
  const [bars, setBars] = React.useState<Bar[]>([]);
  const [searchText, setSearchText] = React.useState('');
  const [selectedBar, setSelectedBar] = React.useState<Bar | null>(null);
  const [showBarCard, setShowBarCard] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [cameraCenter, setCameraCenter] = React.useState<[number, number] | null>(null);
  const [cameraZoom, setCameraZoom] = React.useState(15);
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | null>(null);

  // Create vector collection from bars
  const barsVector = React.useMemo(() => ({
    type: 'FeatureCollection',
    features: bars.map((bar) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [bar.longitude, bar.latitude]
      },
      properties: {
        barId: bar.id,
        barName: bar.name,
        barData: bar,
        isSelected: bar.id === selectedMarkerId
      }
    }))
  }), [bars, selectedMarkerId]);

  // Handle marker press
  const handleMarkerPress = React.useCallback((bar: Bar) => {
    console.log('📍 Marker pressed for bar:', bar.name);
    console.log('📍 Setting selected bar and showing card');
    console.log('📍 Bar data:', {
      id: bar.id,
      name: bar.name,
      address: bar.address,
      image_url: bar.image_url
    });
    setSelectedBar(bar);
    setSelectedMarkerId(bar.id);
    setShowBarCard(true);
  }, []);

  // Handle shape source press
  const handleShapeSourcePress = React.useCallback((e: any) => {
    if (e.features && e.features.length > 0) {
      const { properties } = e.features[0];
      const selectedBarId = properties?.barId;
      
      if (selectedBarId) {
        const selectedBar = bars.find((b) => b.id === selectedBarId);
        if (selectedBar) {
          console.log('📍 Shape source pressed for bar:', selectedBar.name);
          handleMarkerPress(selectedBar);
        }
      }
    }
  }, [bars, handleMarkerPress]);

  // Debug effect for state changes
  React.useEffect(() => {
    console.log('📍 State changed - selectedBar:', selectedBar?.name, 'showBarCard:', showBarCard);
  }, [selectedBar, showBarCard]);

  // Debug effect for bars loading
  React.useEffect(() => {
    console.log('📍 Bars state updated - count:', bars.length);
  }, [bars]);

  // Debug effect for selected marker
  React.useEffect(() => {
    console.log('📍 Selected marker changed:', selectedMarkerId);
  }, [selectedMarkerId]);

  // Handle close bar card
  const handleCloseBarCard = React.useCallback(() => {
    setShowBarCard(false);
    setSelectedBar(null);
    setSelectedMarkerId(null);
  }, []);

  // Handle navigate to bar
  const handleNavigateToBar = React.useCallback((barId: string) => {
    console.log('🧭 Navigating to bar:', barId);
    // TODO: Implement navigation functionality
    // This could open Google Maps or Apple Maps with directions
  }, []);

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

  React.useEffect(() => {
    const fetchBars = async () => {
      try {
        console.log('📍 Fetching bars from Supabase...');
        const { data, error } = await supabase
          .from('bars')
          .select(`
            id,
            name,
            latitude,
            longitude,
            address,
            city,
            rating,
            review_count,
            category_id,
            bar_images!inner(
              image_url,
              image_order
            )
          `)
          .eq('is_active', true)
          .eq('bar_images.image_order', 1);

        if (error) {
          console.error('❌ Error fetching bars:', error);
          return;
        }

        if (data) {
          // Process each bar to load its characteristics
          const processedBars = await Promise.all(data.map(async (bar: any) => {
            // Load category name
            let category = undefined;
            if (bar.category_id) {
              const { data: categoryData } = await supabase
                .from('bar_categories')
                .select('id, name')
                .eq('id', bar.category_id)
                .single();
              if (categoryData) {
                category = { id: categoryData.id, name: categoryData.name };
              }
            }

            // Load food types
            const { data: foodTypes } = await supabase
              .from('bar_food_types')
              .select('food_type_id, food_types(name)')
              .eq('bar_id', bar.id);

            // Load languages
            const { data: languages } = await supabase
              .from('bar_languages')
              .select('language_id, languages(name)')
              .eq('bar_id', bar.id);

            // Load features
            const { data: features } = await supabase
              .from('bar_selected_features')
              .select('feature_id, bar_features(name)')
              .eq('bar_id', bar.id);

            return {
              ...bar,
              image_url: bar.bar_images?.[0]?.image_url || null,
              category,
              bar_food_types: foodTypes?.map((item: any) => ({
                food_type_id: item.food_type_id,
                food_type: { name: item.food_types?.name || 'Unknown' }
              })) || [],
              bar_languages: languages?.map((item: any) => ({
                language_id: item.language_id,
                language: { name: item.languages?.name || 'Unknown' }
              })) || [],
              bar_selected_features: features?.map((item: any) => ({
                feature_id: item.feature_id,
                feature: { name: item.bar_features?.name || 'Unknown' }
              })) || [],
              // Remove the nested bar_images object
              bar_images: undefined
            };
          }));

          console.log('✅ Bars fetched successfully:', processedBars.length);
          setBars(processedBars);
        }
      } catch (error) {
        console.error('❌ Error fetching bars:', error);
      }
    };

    fetchBars();
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
        {/* Register marker images (must be direct child of MapView) */}
        <MapboxGL.Images
          images={{
            bar_marker: require('~/assets/marker.png'),
          }}
        />
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

        {/* Animated location puck */}
        <MapboxGL.LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing
        />

        {/* Bars ShapeSource always rendered with empty FeatureCollection when no bars */}
        <MapboxGL.ShapeSource
          id="bars"
          shape={barsVector}
          cluster={true}
          clusterRadius={50}
          clusterMaxZoom={14}
          onPress={handleShapeSourcePress}
        >
          <MapboxGL.CircleLayer
            id="clusteredBars"
            filter={['has', 'point_count']}
            style={{
              circleColor: '#FF6B6B',
              circleRadius: 20,
              circleOpacity: 0.8,
              circleStrokeWidth: 2,
              circleStrokeColor: 'white',
            }}
          />
          <MapboxGL.SymbolLayer
            id="clusterCount"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count'],
              textSize: 14,
              textColor: '#ffffff',
              textPitchAlignment: 'map',
            }}
          />
          <MapboxGL.SymbolLayer
            id="selectedBarMarkers"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'isSelected'], true]]}
            style={{
              iconImage: 'bar_marker',
              iconAllowOverlap: true,
              iconSize: 0.1,
              iconAnchor: 'bottom',
              iconRotationAlignment: 'viewport',
              iconPitchAlignment: 'viewport',
              iconTextFit: 'none',
              iconKeepUpright: true,
              iconRotate: 0,
              iconColor: '#38B6FF',
            }}
          />
          <MapboxGL.SymbolLayer
            id="normalBarMarkers"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'isSelected'], false]]}
            style={{
              iconImage: 'bar_marker',
              iconAllowOverlap: true,
              iconSize: 0.1,
              iconAnchor: 'bottom',
              iconRotationAlignment: 'viewport',
              iconPitchAlignment: 'viewport',
              iconTextFit: 'none',
              iconKeepUpright: true,
              iconRotate: 0,
              iconColor: '#8E8E93',
            }}
          />
        </MapboxGL.ShapeSource>

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
      
      {/* Bar Info Card */}
      <BarInfoCard
        bar={selectedBar}
        visible={showBarCard}
        onClose={handleCloseBarCard}
        onNavigate={handleNavigateToBar}
      />
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
  userLocationMarker: {
    width: 20,
    height: 20,
    backgroundColor: '#4285F4',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
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
