import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Animated, Easing } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import SearchBarWithResults from '~/components/SearchBarWithResults';
import BarInfoCard from '~/components/BarInfoCard';
import BarMapMarker from '~/components/BarMapMarker';
import FilterModal from '~/components/ui/FilterModal';
import MatchPickerModal, { type Match } from '~/components/ui/MatchPickerModal';
import { supabase } from '~/utils/supabase';
import { useBoostSelection } from '~/context/BoostSelectionContext';
import { useBoostBars } from '~/hooks/useBoostBars';
import { useFilterData } from '~/hooks/useFilterData';
import { fetchBarIdsByMatch } from '~/services/bars';

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
  category_id?: number;
  bar_food_types?: { food_type_id: number; food_type: { name: string } }[];
  bar_selected_features?: { feature_id: number; feature: { name: string } }[];
  bar_languages?: { language_id: number; language: { name: string } }[];
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
  const [searchLocked, setSearchLocked] = React.useState(false);
  const [cameraCenter, setCameraCenter] = React.useState<[number, number] | null>(null);
  const [cameraZoom, setCameraZoom] = React.useState(15);
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | null>(null);
  const cameraRef = React.useRef<MapboxGL.Camera>(null);
  
  // Filter states
  const [filterModalVisible, setFilterModalVisible] = React.useState(false);
  const [selectedBarCategories, setSelectedBarCategories] = React.useState<number[]>([]);
  const [selectedFoodTypes, setSelectedFoodTypes] = React.useState<number[]>([]);
  const [selectedFeatures, setSelectedFeatures] = React.useState<number[]>([]);
  const [selectedLanguages, setSelectedLanguages] = React.useState<number[]>([]);
  
  // Match filter states
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);
  const [matchPickerOpen, setMatchPickerOpen] = React.useState(false);
  
  // Load filter data
  const { barCategories, foodTypes, barFeatures, languages, loading: filtersLoading } = useFilterData();

  // Get boost context and functions
  const { selectedBoostBarIds, setSelectedBoostBarIds, setCenterLatLng } = useBoostSelection();

  // Fetch active boost bars using the hook
  const { boostBars, isLoading: isLoadingBoost, error: boostError } = useBoostBars({
    centerLatLng: userLocation ? { 
      lat: userLocation.coords.latitude, 
      lng: userLocation.coords.longitude 
    } : null,
    enabled: !!userLocation,
  });

  // Update context when boost bars are loaded
  React.useEffect(() => {
    if (boostBars.length > 0) {
      const boostIds = boostBars.map(bar => bar.id);
      console.log('🟡 BOOST: Loaded boost bars:', boostIds.length, 'bars with boost');
      console.log('🟡 BOOST: Bar IDs with boost:', boostIds);
      setSelectedBoostBarIds(boostIds);
    }
  }, [boostBars, setSelectedBoostBarIds]);

  // Update center when user location changes
  React.useEffect(() => {
    if (userLocation) {
      setCenterLatLng({
        lat: userLocation.coords.latitude,
        lng: userLocation.coords.longitude,
      });
    }
  }, [userLocation, setCenterLatLng]);

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

  // Debug effect for state changes
  React.useEffect(() => {
    console.log('═══════════════════════════════════════');
    console.log('📍 STATE: Selected bar:', selectedBar?.name || 'NONE');
    console.log('📍 STATE: Show card:', showBarCard);
    console.log('📍 STATE: Selected marker ID:', selectedMarkerId || 'NONE');
    console.log('═══════════════════════════════════════');
  }, [selectedBar, showBarCard, selectedMarkerId]);

  // Debug effect for bars loading
  React.useEffect(() => {
    console.log('📊 BARS: Total bars loaded:', bars.length);
    if (bars.length > 0) {
      console.log('📊 BARS: Sample bar:', {
        name: bars[0].name,
        id: bars[0].id,
        coords: [bars[0].longitude, bars[0].latitude]
      });
    }
  }, [bars]);

  // Debug effect for boost bars
  React.useEffect(() => {
    console.log('═══════════════════════════════════════');
    console.log('🟡 BOOST STATE: Total boost IDs:', selectedBoostBarIds.length);
    console.log('🟡 BOOST STATE: IDs:', selectedBoostBarIds);
    console.log('🟡 BOOST STATE: Loading:', isLoadingBoost);
    if (boostError) {
      console.error('🟡 BOOST ERROR:', boostError);
    }
    console.log('═══════════════════════════════════════');
  }, [selectedBoostBarIds, isLoadingBoost, boostError]);

  // Handle close bar card
  const handleCloseBarCard = React.useCallback(() => {
    setShowBarCard(false);
    setSelectedBar(null);
    setSelectedMarkerId(null);
  }, []);

  // Apply filters to bars
  const filteredBars = React.useMemo(() => {
    let filtered = [...bars];

    // Apply category filter
    if (selectedBarCategories.length > 0) {
      filtered = filtered.filter(bar =>
        bar.category_id && selectedBarCategories.includes(bar.category_id)
      );
    }

    // Apply food types filter (must have ALL selected food types)
    if (selectedFoodTypes.length > 0) {
      filtered = filtered.filter(bar => {
        const foodIds = bar.bar_food_types?.map(ft => ft.food_type_id) || [];
        return selectedFoodTypes.every(selectedId => foodIds.includes(selectedId));
      });
    }

    // Apply features filter (must have ALL selected features)
    if (selectedFeatures.length > 0) {
      filtered = filtered.filter(bar => {
        const featureIds = bar.bar_selected_features?.map(f => f.feature_id) || [];
        return selectedFeatures.every(selectedId => featureIds.includes(selectedId));
      });
    }

    // Apply languages filter (must have ALL selected languages)
    if (selectedLanguages.length > 0) {
      filtered = filtered.filter(bar => {
        const languageIds = bar.bar_languages?.map(l => l.language_id) || [];
        return selectedLanguages.every(selectedId => languageIds.includes(selectedId));
      });
    }

    console.log('🎯 FILTERS: Applied filters, showing', filtered.length, 'of', bars.length, 'bars');
    return filtered;
  }, [bars, selectedBarCategories, selectedFoodTypes, selectedFeatures, selectedLanguages]);

  // Handle apply filters
  const handleApplyFilters = React.useCallback(() => {
    console.log('🎉 Applying filters...');
    setFilterModalVisible(false);
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
        
        // Step 1: If match filter is active, get bar IDs that have events for that match
        let barIdsFilter: string[] | null = null;
        if (selectedMatch) {
          console.log('⚽ Filtering by match:', selectedMatch.home_team?.name, 'vs', selectedMatch.away_team?.name);
          try {
            barIdsFilter = await fetchBarIdsByMatch(selectedMatch.id);
          } catch (e) {
            console.error('❌ Error fetching barIds by match:', e);
            barIdsFilter = [];
          }
          if (!barIdsFilter || barIdsFilter.length === 0) {
            console.log('⚽ No bars found with events for this match');
            setBars([]);
            return;
          }
          console.log('⚽ Found', barIdsFilter.length, 'bars broadcasting this match');
        }

        // Step 2: Build query
        let barsQuery = supabase
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

        // Apply match filter if active
        if (barIdsFilter) {
          barsQuery = barsQuery.in('id', barIdsFilter);
        }

        const { data, error } = await barsQuery;

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
  }, [selectedMatch]);

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
    setSearchLocked(false);
    setSearchText(text);
  }, []);

  // Debounced search effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!searchLocked && searchText.trim()) {
        searchLocations(searchText);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchText, searchLocked, searchLocations]);


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
    setSearchLocked(true);
    setSearchText(location.place_name);
    setSearchResults([]);
    setIsSearching(false);
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
        ref={cameraRef}
          centerCoordinate={
            cameraCenter || (userLocation
              ? [userLocation.coords.longitude, userLocation.coords.latitude]
              : undefined)
          }
          zoomLevel={cameraZoom}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* Animated location puck */}
        <MapboxGL.LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing
        />

        {/* Bar markers using PointAnnotation */}
        {filteredBars.map((bar) => {
          const isSelected = bar.id === selectedMarkerId;
          const isBoosted = selectedBoostBarIds.includes(bar.id);

          // Determine marker type: Selected > Boosted > Default
          let markerType: 'default' | 'boosted' | 'selected' = 'default';
          if (isBoosted && !isSelected) {
            markerType = 'boosted';
          }
          if (isSelected) {
            markerType = 'selected';
          }

          // Log marker type for debugging (only first 3 bars to avoid spam)
          if (filteredBars.indexOf(bar) < 3) {
            console.log(`🎨 MARKER[${bar.name}]: type=${markerType}, boosted=${isBoosted}, selected=${isSelected}`);
          }

          return (
            <MapboxGL.PointAnnotation
              key={`bar-${bar.id}-${markerType}`}
              id={`bar-annotation-${bar.id}`}
              coordinate={[bar.longitude, bar.latitude]}
              onSelected={() => {
                console.log('🔴 MARKER TOUCHED (onSelected):', bar.name);
                handleMarkerPress(bar);
              }}
              anchor={{ x: 0.5, y: 1.0 }}
            >
              <BarMapMarker 
                key={`marker-${markerType}-${bar.id}`}
                type={markerType} 
                animated={isBoosted && !isSelected}
                onPress={() => {
                  console.log('🟢 MARKER TOUCHED (custom onPress):', bar.name);
                  handleMarkerPress(bar);
                }}
              />
            </MapboxGL.PointAnnotation>
          );
        })}
      </MapboxGL.MapView>

      {/* Search bar with adjusted right margin for filter button */}
      <View style={styles.searchWrapper} pointerEvents="box-none">
        <SearchBarWithResults 
          value={searchText} 
          onChangeText={handleSearchChange}
          searchResults={searchResults}
          isSearching={isSearching}
          onLocationSelect={handleLocationSelect}
        />
      </View>
      
      {/* Filter buttons row */}
      <View style={styles.filterButtonsRow}>
        {/* Match filter button */}
        <TouchableOpacity
          style={[
            styles.filterRowButton,
            selectedMatch && styles.filterButtonActive
          ]}
          onPress={() => setMatchPickerOpen(true)}
        >
          <Text style={styles.teamButtonEmoji}>⚽</Text>
          {selectedMatch && (
            <View style={styles.filterDot} />
          )}
        </TouchableOpacity>
      
      {/* Filter button */}
      <TouchableOpacity
        style={[
            styles.filterRowButton,
          (selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || 
           selectedFeatures.length > 0 || selectedLanguages.length > 0) && styles.filterButtonActive
        ]}
        onPress={() => setFilterModalVisible(true)}
      >
        <Ionicons name="filter" size={20} color="#FFFFFF" />
        {(selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || 
          selectedFeatures.length > 0 || selectedLanguages.length > 0) && (
          <View style={styles.filterDot} />
        )}
      </TouchableOpacity>
      </View>

      {/* Center on user location button */}
      {userLocation && (
        <TouchableOpacity
          style={styles.centerButton}
          onPress={async () => {
            try {
              // Ensure permission and get fresh position
              if (hasPermission !== true) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permisos requeridos', 'Se necesitan permisos de ubicación para centrar el mapa.');
                  return;
                }
              }

              const fresh = await Location.getCurrentPositionAsync({});
              const { latitude, longitude } = fresh.coords;
              console.log('Center location button pressed:', { latitude, longitude });

              // Update state similarly to initial load
              setUserLocation(fresh);
              setSelectedBar(null);
              setSelectedMarkerId(null);
              setShowBarCard(false);
              // Use camera ref to ensure recenters even after manual pan
              const cam: any = cameraRef.current as any;
              if (cam?.setCamera) {
                cam.setCamera({
                  centerCoordinate: [longitude, latitude],
                  zoomLevel: 15,
                  animationDuration: 1000,
                  animationMode: 'flyTo',
                } as any);
                setCameraCenter([longitude, latitude]);
                setCameraZoom(15);
              } else {
                // Fallback: update props-controlled center/zoom
                setCameraCenter([longitude, latitude]);
                setCameraZoom(15);
              }
            } catch (error) {
              console.error('Error centering on user location:', error);
              Alert.alert('Error', 'No se pudo obtener tu ubicación actual.');
            }
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

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        barCategories={barCategories}
        foodTypes={foodTypes}
        barFeatures={barFeatures}
        languages={languages}
        selectedBarCategories={selectedBarCategories}
        selectedFoodTypes={selectedFoodTypes}
        selectedFeatures={selectedFeatures}
        selectedLanguages={selectedLanguages}
        onBarCategoriesChange={setSelectedBarCategories}
        onFoodTypesChange={setSelectedFoodTypes}
        onFeaturesChange={setSelectedFeatures}
        onLanguagesChange={setSelectedLanguages}
        onApplyFilters={handleApplyFilters}
        loading={filtersLoading}
      />

      {/* Match Picker Modal */}
      <MatchPickerModal
        visible={matchPickerOpen}
        onClose={() => setMatchPickerOpen(false)}
        onSelectMatch={(match) => setSelectedMatch(match)}
        selectedMatchId={selectedMatch?.id}
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
  searchWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 130, // Space for filter buttons row (2 buttons + gaps)
    bottom: 0,
    zIndex: 999,
  },
  filterButtonsRow: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    gap: 10,
    zIndex: 1000,
  },
  filterRowButton: {
    backgroundColor: '#3A4A5C',
    borderRadius: 12,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterButtonActive: {
    backgroundColor: '#1976D2',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
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
  teamButtonEmoji: {
    fontSize: 22,
  },
});

export default Map;
