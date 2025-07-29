import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '~/components/SearchBar';
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
        barData: bar
      }
    }))
  }), [bars]);

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

  // Handle close bar card
  const handleCloseBarCard = React.useCallback(() => {
    setShowBarCard(false);
    setSelectedBar(null);
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

  const handleSearchChange = React.useCallback((text: string) => {
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

        {/* Bars ShapeSource with clustering */}
        {bars.length > 0 && (
          <MapboxGL.ShapeSource
            id="bars"
            shape={barsVector}
            cluster={true}
            clusterRadius={50}
            clusterMaxZoom={14}
            onPress={handleShapeSourcePress}
          >
            {/* Cluster circles */}
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

            {/* Cluster count text */}
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

            {/* Only show bar icons if NOT clustered */}
            <MapboxGL.SymbolLayer
              id="barMarkers"
              filter={['!', ['has', 'point_count']]}
              style={{
                iconImage: 'bar_marker',
                iconAllowOverlap: true,
                iconSize: 0.1,
                iconAnchor: 'bottom',
              }}
            />

            {/* Register marker image */}
            <MapboxGL.Images images={{ bar_marker: require('~/assets/marker.png') }} />
          </MapboxGL.ShapeSource>
        )}

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
});

export default Map;
