import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Easing, Platform, ActivityIndicator, Image } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import SearchBarWithResults, { SearchBarRef } from '~/components/SearchBarWithResults';
import BarInfoCard from '~/components/BarInfoCard';
import BoostedBarsPopup from '~/components/BoostedBarsPopup';
import BarMapMarker from '~/components/BarMapMarker';
import FilterModal from '~/components/ui/FilterModal';
import MatchPickerModal, { type Match } from '~/components/ui/MatchPickerModal';
import { supabase } from '~/utils/supabase';
import { useBoostSelection } from '~/context/BoostSelectionContext';
import { useBoostBars } from '~/hooks/useBoostBars';
import { useFilterData } from '~/hooks/useFilterData';
import { useMapboxDirections } from '~/hooks/useMapboxDirections';
import { fetchBarIdsByMatch } from '~/services/bars';
import { AppText, MapSkeleton } from '~/components/ds';

// Use environment variable for Mapbox token
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

// Helper function to get icon based on maneuver instruction
const getManeuverIcon = (instruction: string): keyof typeof Ionicons.glyphMap => {
  const lowerInstruction = instruction.toLowerCase();
  
  if (lowerInstruction.includes('derecha') || lowerInstruction.includes('right') || lowerInstruction.includes('gira a la derecha')) {
    return 'arrow-forward';
  }
  if (lowerInstruction.includes('izquierda') || lowerInstruction.includes('left') || lowerInstruction.includes('gira a la izquierda')) {
    return 'arrow-back';
  }
  if (lowerInstruction.includes('recto') || lowerInstruction.includes('straight') || lowerInstruction.includes('continúa') || lowerInstruction.includes('sigue')) {
    return 'arrow-up';
  }
  if (lowerInstruction.includes('rotonda') || lowerInstruction.includes('roundabout')) {
    return 'sync';
  }
  if (lowerInstruction.includes('salida') || lowerInstruction.includes('exit')) {
    return 'exit-outline';
  }
  if (lowerInstruction.includes('llegada') || lowerInstruction.includes('destino') || lowerInstruction.includes('arrive') || lowerInstruction.includes('has llegado')) {
    return 'flag';
  }
  if (lowerInstruction.includes('gira') || lowerInstruction.includes('turn')) {
    return 'return-down-forward';
  }
  
  return 'navigate';
};

// Helper function to format distance
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

// Find the index of the closest route point to the user's position
const findClosestPointIndex = (
  routeCoords: [number, number][],
  userLng: number,
  userLat: number
): number => {
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < routeCoords.length; i++) {
    const dx = routeCoords[i][0] - userLng;
    const dy = routeCoords[i][1] - userLat;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
};

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
  bar_selected_tv_features?: { tv_feature_id: number; tv_feature: { name: string } }[];
}

interface MapProps {
  initialSelectedBarId?: string;
  initialSelectedBarCoords?: { latitude: number; longitude: number };
  initialSelectedBarName?: string;
}

// Module-level flag: persists while the JS bundle is loaded (i.e., the whole app session)
let boostedPopupShownThisSession = false;

const Map: React.FC<MapProps> = ({ initialSelectedBarId, initialSelectedBarCoords, initialSelectedBarName }) => {
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [userLocation, setUserLocation] = React.useState<Location.LocationObject | null>(null);
  const [bars, setBars] = React.useState<Bar[]>([]);
  const [loadingBars, setLoadingBars] = React.useState(true);
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
  const searchBarRef = React.useRef<SearchBarRef>(null);

  // Filter states
  const [filterModalVisible, setFilterModalVisible] = React.useState(false);
  const [selectedBarCategories, setSelectedBarCategories] = React.useState<number[]>([]);
  const [selectedFoodTypes, setSelectedFoodTypes] = React.useState<number[]>([]);
  const [selectedFeatures, setSelectedFeatures] = React.useState<number[]>([]);
  const [selectedTvFeatures, setSelectedTvFeatures] = React.useState<number[]>([]);
  
  // Match filter states
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);
  const [matchPickerOpen, setMatchPickerOpen] = React.useState(false);

  // Search bar expanded state
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  
  // Boosted bars popup state — only show once per app session
  const [showBoostedPopup, setShowBoostedPopup] = React.useState(!boostedPopupShownThisSession);

  // Navigation states
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [navigationStarted, setNavigationStarted] = React.useState(false); // New: started full navigation mode
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0); // Track which step we're on
  const [routeProgressIndex, setRouteProgressIndex] = React.useState(0); // Index in route coords closest to user
  const [navigationDestination, setNavigationDestination] = React.useState<{
    latitude: number;
    longitude: number;
    name: string;
  } | null>(null);

  // Ref to hold location subscription during active navigation
  const locationSubscriptionRef = React.useRef<Location.LocationSubscription | null>(null);
  
  // Load filter data
  const { barCategories, foodTypes, barFeatures, tvFeatures, loading: filtersLoading } = useFilterData();

  // MapBox Directions hook
  const { loading: directionsLoading, error: directionsError, routeData, travelMode, getDirections, clearRoute } = useMapboxDirections();

  // Ref to always access latest routeData inside async callbacks (avoids stale closure in watchPositionAsync)
  const routeDataRef = React.useRef(routeData);
  React.useEffect(() => { routeDataRef.current = routeData; }, [routeData]);

  // Get boost context and functions
  const { selectedBoostBarIds, setSelectedBoostBarIds, setCenterLatLng } = useBoostSelection();

  // Fetch active boost bars using the hook
  const { selected3Stable, selected3Bars, isLoading: isLoadingBoost, error: boostError } = useBoostBars({
    centerLatLng: userLocation ? {
      lat: userLocation.coords.latitude,
      lng: userLocation.coords.longitude
    } : null,
    enabled: !!userLocation,
  });

  // Update context with only the 3 selected bars — same ones shown in popup and search
  React.useEffect(() => {
    setSelectedBoostBarIds(selected3Stable);
  }, [selected3Stable, setSelectedBoostBarIds]);


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
    setSelectedBar(bar);
    setSelectedMarkerId(bar.id);
    setShowBarCard(true);
  }, []);

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

    // Apply TV features filter (must have ALL selected TV features)
    if (selectedTvFeatures.length > 0) {
      filtered = filtered.filter(bar => {
        const tvFeatureIds = bar.bar_selected_tv_features?.map(tf => tf.tv_feature_id) || [];
        return selectedTvFeatures.every(selectedId => tvFeatureIds.includes(selectedId));
      });
    }

    return filtered;
  }, [bars, selectedBarCategories, selectedFoodTypes, selectedFeatures, selectedTvFeatures]);

  // Handle apply filters
  const handleApplyFilters = React.useCallback(() => {
    setFilterModalVisible(false);
  }, []);

  // Handle navigate to bar
  const handleNavigateToBar = React.useCallback((barId: string) => {
    // TODO: Implement navigation functionality
    // This could open Google Maps or Apple Maps with directions
  }, []);

  // Handle start navigation
  const handleStartNavigation = React.useCallback(async (destination: {
    latitude: number;
    longitude: number;
    name: string;
  }) => {
    if (!userLocation) {
      Alert.alert('Error', 'No se pudo obtener tu ubicación actual');
      return;
    }

    setNavigationDestination(destination);
    setIsNavigating(true);
    setShowBarCard(false);

    // Fetch route from MapBox (walking by default)
    const route = await getDirections(
      {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      },
      {
        latitude: destination.latitude,
        longitude: destination.longitude
      },
      'walking'
    );

    if (route) {
      // Adjust camera to show the full route
      const allCoords = [
        [userLocation.coords.longitude, userLocation.coords.latitude],
        ...route.coordinates
      ];
      
      // Calculate bounds
      const lngs = allCoords.map(c => c[0]);
      const lats = allCoords.map(c => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      // Calculate appropriate padding based on route distance (reduced for closer view)
      const lngDiff = maxLng - minLng;
      const latDiff = maxLat - minLat;
      const padding = Math.max(lngDiff, latDiff) * 0.15; // 15% padding for closer view
      
      const bounds = {
        ne: [maxLng + padding, maxLat + padding],
        sw: [minLng - padding, minLat - padding]
      };

      const cam: any = cameraRef.current as any;
      if (cam?.fitBounds) {
        // Edge padding: left, top, right, bottom - adjusted for closer view
        cam.fitBounds(bounds.ne, bounds.sw, [40, 120, 40, 180], 1000);
      }
    } else if (directionsError) {
      Alert.alert('Error', 'No se pudo calcular la ruta');
    }
  }, [userLocation, getDirections, directionsError]);

  // Handle cancel navigation
  const handleCancelNavigation = React.useCallback(() => {
    // Stop real-time location subscription
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    setIsNavigating(false);
    setNavigationStarted(false);
    setNavigationDestination(null);
    setCurrentStepIndex(0);
    setRouteProgressIndex(0);
    clearRoute();

    // Return camera to user location, reset tilt and bearing
    if (userLocation && cameraRef.current) {
      const cam: any = cameraRef.current as any;
      if (cam?.setCamera) {
        cam.setCamera({
          centerCoordinate: [userLocation.coords.longitude, userLocation.coords.latitude],
          zoomLevel: 15,
          pitch: 0,
          bearing: 0,
          animationDuration: 1000,
        } as any);
      }
    }
  }, [userLocation, clearRoute]);

  // Handle start navigation button
  const handleBeginNavigation = React.useCallback(() => {
    setNavigationStarted(true);
    setRouteProgressIndex(0);

    // Initial camera: follow user with navigation tilt
    if (userLocation && cameraRef.current) {
      const cam: any = cameraRef.current as any;
      if (cam?.setCamera) {
        cam.setCamera({
          centerCoordinate: [userLocation.coords.longitude, userLocation.coords.latitude],
          zoomLevel: 17,
          pitch: 45,
          bearing: userLocation.coords.heading ?? 0,
          animationDuration: 1000,
        } as any);
      }
    }

    // Start watching location for real-time navigation updates
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (location) => {
        setUserLocation(location);

        const { latitude, longitude, heading } = location.coords;
        const currentRouteData = routeDataRef.current;

        if (currentRouteData && cameraRef.current) {
          // Find closest point on route to show traveled path
          const closestIdx = findClosestPointIndex(
            currentRouteData.coordinates,
            longitude,
            latitude
          );
          setRouteProgressIndex(closestIdx);

          // Update current navigation step based on progress
          let cumulativeDist = 0;
          const progressDist = (closestIdx / currentRouteData.coordinates.length) * currentRouteData.distance * 1000;
          let newStepIdx = 0;
          for (let i = 0; i < currentRouteData.steps.length; i++) {
            cumulativeDist += currentRouteData.steps[i].distance;
            if (progressDist < cumulativeDist) {
              newStepIdx = i;
              break;
            }
            newStepIdx = i;
          }
          setCurrentStepIndex(Math.min(newStepIdx, currentRouteData.steps.length - 1));

          // Move camera to follow user with heading
          const cam: any = cameraRef.current as any;
          if (cam?.setCamera) {
            cam.setCamera({
              centerCoordinate: [longitude, latitude],
              zoomLevel: 17,
              pitch: 45,
              bearing: heading ?? 0,
              animationDuration: 500,
            } as any);
          }
        }
      }
    ).then((subscription) => {
      locationSubscriptionRef.current = subscription;
    });
  }, [userLocation]);

  // Handle change travel mode
  const handleChangeTravelMode = React.useCallback(async () => {
    if (!userLocation || !navigationDestination) return;

    setRouteProgressIndex(0);
    const newMode = travelMode === 'walking' ? 'driving' : 'walking';
    await getDirections(
      {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      },
      {
        latitude: navigationDestination.latitude,
        longitude: navigationDestination.longitude
      },
      newMode
    );
  }, [userLocation, navigationDestination, travelMode, getDirections]);

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

  // Cleanup location subscription on unmount
  React.useEffect(() => {
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, []);

  // Handle initial bar selection from navigation params
  React.useEffect(() => {
    if (initialSelectedBarId && bars.length > 0) {
      
      // Find the bar in the loaded bars
      const bar = bars.find(b => b.id === initialSelectedBarId);
      
      if (bar) {
        // Select the bar and show card
        setSelectedBar(bar);
        setSelectedMarkerId(bar.id);
        setShowBarCard(true);
        
        // Center camera on the bar
        if (cameraRef.current) {
          const cam: any = cameraRef.current as any;
          if (cam?.setCamera) {
            cam.setCamera({
              centerCoordinate: [bar.longitude, bar.latitude],
              zoomLevel: 16,
              animationDuration: 1000,
            } as any);
          }
        }
      } else if (initialSelectedBarCoords && initialSelectedBarName) {
        // Bar not in current list but we have coords, create a temporary bar object
        const tempBar: Bar = {
          id: initialSelectedBarId,
          name: initialSelectedBarName,
          latitude: initialSelectedBarCoords.latitude,
          longitude: initialSelectedBarCoords.longitude,
          address: '',
          city: '',
        };
        
        setSelectedBar(tempBar);
        setSelectedMarkerId(initialSelectedBarId);
        setShowBarCard(true);
        
        // Center camera on the coordinates
        if (cameraRef.current) {
          const cam: any = cameraRef.current as any;
          if (cam?.setCamera) {
            cam.setCamera({
              centerCoordinate: [initialSelectedBarCoords.longitude, initialSelectedBarCoords.latitude],
              zoomLevel: 16,
              animationDuration: 1000,
            } as any);
          }
        }
      }
    }
  }, [initialSelectedBarId, bars, initialSelectedBarCoords, initialSelectedBarName]);

  React.useEffect(() => {
    const fetchBars = async () => {
      try {
        setLoadingBars(true);

        // Step 1: If match filter is active, get bar IDs that have events for that match
        let barIdsFilter: string[] | null = null;
        if (selectedMatch) {
          try {
            barIdsFilter = await fetchBarIdsByMatch(selectedMatch.id);
          } catch (e) {
            console.error('❌ Error fetching barIds by match:', e);
            barIdsFilter = [];
          }
          if (!barIdsFilter || barIdsFilter.length === 0) {
            setBars([]);
            setLoadingBars(false);
            return;
          }
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
            bar_images(
              image_url,
              image_order
            )
          `)
          .eq('is_active', true);

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

            // Load TV features
            const { data: tvFeatures } = await supabase
              .from('bar_selected_tv_features')
              .select('tv_feature_id, bar_tv_features(name)')
              .eq('bar_id', bar.id);

            // Load features
            const { data: features } = await supabase
              .from('bar_selected_features')
              .select('feature_id, bar_features(name)')
              .eq('bar_id', bar.id);

            // Find image with image_order = 1, fallback to first image or null
            const mainImage = bar.bar_images
              ?.find((img: any) => img.image_order === 1)?.image_url || 
              bar.bar_images?.[0]?.image_url || null;

            return {
              ...bar,
              image_url: mainImage,
              category,
              bar_food_types: foodTypes?.map((item: any) => ({
                food_type_id: item.food_type_id,
                food_type: { name: item.food_types?.name || 'Unknown' }
              })) || [],
              bar_selected_tv_features: tvFeatures?.map((item: any) => ({
                tv_feature_id: item.tv_feature_id,
                tv_feature: { name: item.bar_tv_features?.name || 'Unknown' }
              })) || [],
              bar_selected_features: features?.map((item: any) => ({
                feature_id: item.feature_id,
                feature: { name: item.bar_features?.name || 'Unknown' }
              })) || [],
              // Remove the nested bar_images object
              bar_images: undefined
            };
          }));

          setBars(processedBars);
        }
      } catch (error) {
        console.error('❌ Error fetching bars:', error);
      } finally {
        setLoadingBars(false);
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

  // Show skeleton while loading bars
  if (loadingBars) {
    return (
      <View style={styles.container}>
        <MapSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
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
          const isDestination = isNavigating && navigationDestination && 
            bar.latitude === navigationDestination.latitude && 
            bar.longitude === navigationDestination.longitude;

          // Determine marker type with priority: Destination > Boosted > Selected > Default
          let markerType: 'default' | 'boosted' | 'selected' | 'destination' = 'default';
          
          if (isSelected && !isBoosted && !isDestination) {
            markerType = 'selected';
          }
          if (isBoosted && !isDestination) {
            markerType = 'boosted';
          }
          if (isDestination) {
            markerType = 'destination';
          }

          return (
            <MapboxGL.PointAnnotation
              key={`bar-${bar.id}`}
              id={`bar-annotation-${bar.id}`}
              coordinate={[bar.longitude, bar.latitude]}
              onSelected={() => handleMarkerPress(bar)}
              anchor={{ x: 0.5, y: 1.0 }}
            >
              <BarMapMarker
                key={`marker-${markerType}-${bar.id}`}
                type={markerType}
                animated={(isBoosted || isDestination) && !isSelected}
                onPress={() => handleMarkerPress(bar)}
              />
            </MapboxGL.PointAnnotation>
          );
        })}

        {/* Navigation Route - Traveled portion (gray) */}
        {isNavigating && routeData && navigationStarted && routeProgressIndex > 0 && (
          <MapboxGL.ShapeSource
            id="traveledRouteSource"
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeData.coordinates.slice(0, routeProgressIndex + 1)
              }
            }}
          >
            <MapboxGL.LineLayer
              id="traveledRouteOutline"
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 7,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.3,
              }}
            />
            <MapboxGL.LineLayer
              id="traveledRouteLine"
              style={{
                lineColor: '#6B7280',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.6,
              }}
              aboveLayerID="traveledRouteOutline"
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Navigation Route - Remaining portion (blue) */}
        {isNavigating && routeData && (
          <MapboxGL.ShapeSource
            id="routeSource"
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: navigationStarted
                  ? routeData.coordinates.slice(routeProgressIndex)
                  : routeData.coordinates
              }
            }}
          >
            <MapboxGL.LineLayer
              id="routeOutline"
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 7,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#007AFF',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              aboveLayerID="routeOutline"
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>
      </View>

      {/* Top controls row */}
      <View style={styles.topControlsRow}>
        {/* Botón búsqueda - estilo distinto al de filtros */}
        <TouchableOpacity
          style={styles.searchIconBtn}
          onPress={() => searchBarRef.current?.expand()}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Botón pill central - ¿Qué partido quieres ver? */}
        <TouchableOpacity
          style={styles.matchFilterButton}
          onPress={() => setMatchPickerOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.matchButtonContent}>
            <Ionicons name="football-outline" size={19} color="rgba(255,255,255,0.75)" />
            <Text style={styles.matchButtonText}>¿Qué partido quieres ver?</Text>
          </View>
        </TouchableOpacity>

        {/* Botón circular filtros */}
        <TouchableOpacity
          style={[
            styles.circleBtn,
            (selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 ||
             selectedFeatures.length > 0 || selectedTvFeatures.length > 0) && styles.circleBtnActive,
          ]}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="menu-outline" size={22} color="#FFFFFF" />
          {(selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 ||
            selectedFeatures.length > 0 || selectedTvFeatures.length > 0) && (
            <View style={styles.filterDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search bar - Opens below the controls */}
      <View style={styles.searchWrapper} pointerEvents="box-none">
        <SearchBarWithResults
          ref={searchBarRef}
          value={searchText}
          onChangeText={handleSearchChange}
          searchResults={searchResults}
          isSearching={isSearching}
          onLocationSelect={handleLocationSelect}
          onExpandChange={setIsSearchExpanded}
        />
      </View>

      {/* Center on user location button */}
      {userLocation && (
        <TouchableOpacity
          style={[
            styles.centerButton,
            selectedMatch && !isSearchExpanded && !showBarCard && !isNavigating
              ? { bottom: 216 }
              : { bottom: 128 },
          ]}
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
          <Ionicons name="locate" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Turn-by-Turn Navigation Instructions - Top (Only when navigation started) */}
      {navigationStarted && routeData && routeData.steps.length > 0 && currentStepIndex < routeData.steps.length && (
        <View style={styles.navigationInstructionPanel}>
          <View style={styles.instructionIconContainer}>
            <Ionicons 
              name={getManeuverIcon(routeData.steps[currentStepIndex].instruction)} 
              size={32} 
              color="#FFFFFF" 
            />
          </View>
          <View style={styles.instructionTextContainer}>
            <AppText style={styles.instructionText} numberOfLines={2}>
              {routeData.steps[currentStepIndex].instruction}
            </AppText>
            {routeData.steps[currentStepIndex].distance > 0 && (
              <AppText style={styles.instructionDistance}>
                en {formatDistance(routeData.steps[currentStepIndex].distance)}
              </AppText>
            )}
          </View>
        </View>
      )}

      {/* Navigation Panel - Bottom Unified */}
      {isNavigating && routeData && navigationDestination && (
        <View style={styles.navigationBottomPanel}>
          {!navigationStarted ? (
            /* Preview Mode - Before starting navigation */
            <>
              {/* Header with title and close */}
              <View style={styles.navigationPanelHeader}>
                <AppText style={styles.navigationTitle}>{navigationDestination.name}</AppText>
                <TouchableOpacity 
                  style={styles.cancelNavigationButton}
                  onPress={handleCancelNavigation}
                >
                  <Ionicons name="close" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
              
              {/* Stats and Mode selector in balanced row */}
              <View style={styles.navigationContentRow}>
                {/* Stats on the left */}
                <View style={styles.navigationStatsLeft}>
                  <View style={styles.navigationStat}>
                    <Ionicons name="time-outline" size={16} color="#10B981" />
                    <AppText style={styles.navigationStatText}>
                      {Math.round(routeData.duration)} min
                    </AppText>
                  </View>
                  <View style={styles.navigationStat}>
                    <Ionicons name="navigate-outline" size={16} color="#007AFF" />
                    <AppText style={styles.navigationStatText}>
                      {routeData.distance.toFixed(1)} km
                    </AppText>
                  </View>
                </View>
                
                {/* Travel Mode Selector on the right - Compact */}
                <View style={styles.travelModeCompact}>
                  <TouchableOpacity 
                    style={[
                      styles.segmentButtonCompact,
                      travelMode === 'walking' && styles.segmentButtonActive
                    ]}
                    onPress={() => travelMode !== 'walking' && handleChangeTravelMode()}
                    disabled={directionsLoading}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="walk" 
                      size={18} 
                      color={travelMode === 'walking' ? '#FFFFFF' : '#7C8A9D'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.segmentButtonCompact,
                      travelMode === 'driving' && styles.segmentButtonActive
                    ]}
                    onPress={() => travelMode !== 'driving' && handleChangeTravelMode()}
                    disabled={directionsLoading}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="car" 
                      size={18} 
                      color={travelMode === 'driving' ? '#FFFFFF' : '#7C8A9D'} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Start Navigation Button */}
              <TouchableOpacity 
                style={styles.startNavigationButton}
                onPress={handleBeginNavigation}
              >
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <AppText style={styles.startNavigationButtonText}>Iniciar</AppText>
              </TouchableOpacity>
              
              {directionsLoading && (
                <AppText style={styles.navigationLoading}>Calculando ruta...</AppText>
              )}
            </>
          ) : (
            /* Active Navigation Mode */
            <View style={styles.activeNavigationPanel}>
              <TouchableOpacity 
                style={styles.endNavigationButton}
                onPress={handleCancelNavigation}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <AppText style={styles.endNavigationButtonText}>Finalizar</AppText>
              </TouchableOpacity>
              
              <View style={styles.activeNavStats}>
                <AppText style={styles.activeNavTime}>{Math.round(routeData.duration)} min</AppText>
                <AppText style={styles.activeNavDistance}>{routeData.distance.toFixed(1)} km</AppText>
              </View>
            </View>
          )}
        </View>
      )}
      
      {/* Active Match Filter Banner - Bottom (above nav) */}
      {selectedMatch && !isSearchExpanded && !showBarCard && !isNavigating && (
        <View style={styles.activeMatchBanner}>
          {/* Competition header */}
          {selectedMatch.competition?.name && (
            <AppText style={styles.bannerCompetition} numberOfLines={1}>
              {selectedMatch.competition.name}
            </AppText>
          )}

          {/* Teams row */}
          <View style={styles.bannerTeamsRow}>
            <View style={styles.bannerTeam}>
              {selectedMatch.home_team?.logo_url ? (
                <Image
                  source={{ uri: selectedMatch.home_team.logo_url }}
                  style={styles.bannerTeamLogo}
                />
              ) : (
                <Ionicons name="shield-outline" size={20} color="#FFFFFF" />
              )}
              <AppText style={styles.bannerTeamName} numberOfLines={2}>
                {selectedMatch.home_team?.name || 'Local'}
              </AppText>
            </View>

            <View style={styles.bannerVsContainer}>
              <AppText style={styles.bannerVs}>VS</AppText>
              {selectedMatch.time && (
                <AppText style={styles.bannerTime}>
                  {selectedMatch.time.slice(0, 5)}
                </AppText>
              )}
            </View>

            <View style={styles.bannerTeam}>
              {selectedMatch.away_team?.logo_url ? (
                <Image
                  source={{ uri: selectedMatch.away_team.logo_url }}
                  style={styles.bannerTeamLogo}
                />
              ) : (
                <Ionicons name="shield-outline" size={20} color="#FFFFFF" />
              )}
              <AppText style={styles.bannerTeamName} numberOfLines={2}>
                {selectedMatch.away_team?.name || 'Visitante'}
              </AppText>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setSelectedMatch(null)}
            style={styles.bannerCloseButton}
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Boosted Bars Popup */}
      <BoostedBarsPopup
        visible={showBoostedPopup}
        onClose={() => {
          boostedPopupShownThisSession = true;
          setShowBoostedPopup(false);
        }}
        bars={selected3Bars}
        isLoading={isLoadingBoost}
      />

      {/* Bar Info Card */}
      <BarInfoCard
        bar={selectedBar}
        visible={showBarCard}
        onClose={handleCloseBarCard}
        onNavigate={handleNavigateToBar}
        onStartNavigation={handleStartNavigation}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        barCategories={barCategories}
        foodTypes={foodTypes}
        barFeatures={barFeatures}
        tvFeatures={tvFeatures}
        selectedBarCategories={selectedBarCategories}
        selectedFoodTypes={selectedFoodTypes}
        selectedFeatures={selectedFeatures}
        selectedTvFeatures={selectedTvFeatures}
        onBarCategoriesChange={setSelectedBarCategories}
        onFoodTypesChange={setSelectedFoodTypes}
        onFeaturesChange={setSelectedFeatures}
        onTvFeaturesChange={setSelectedTvFeatures}
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
  mapWrapper: {
    flex: 1,
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
    top: Platform.OS === 'ios' ? 116 : 96,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  topControlsRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 68 : 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 1000,
  },
  searchIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26,35,50,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26,35,50,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnActive: {
    backgroundColor: 'rgba(25, 118, 210, 0.85)',
    borderColor: 'rgba(25, 118, 210, 0.5)',
  },
  matchFilterButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(25,118,210,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(25,118,210,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  matchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  activeMatchBanner: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(25, 118, 210, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  bannerCompetition: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 4,
  },
  bannerTeam: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  bannerTeamLogo: {
    width: 44,
    height: 44,
    borderRadius: 7,
    resizeMode: 'contain',
  },
  bannerTeamName: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  bannerVsContainer: {
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 4,
  },
  bannerVs: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9,
    fontWeight: '700',
  },
  bannerTime: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 11,
    fontWeight: '700',
  },
  bannerCloseButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
  },
  centerButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'rgba(26,35,50,0.92)',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  teamButtonEmoji: {
    fontSize: 22,
  },
  navigationInstructionPanel: {
    position: 'absolute',
    top: 130,
    left: 16,
    right: 16,
    backgroundColor: '#1C2A3A',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  instructionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.4)',
  },
  instructionTextContainer: {
    flex: 1,
  },
  instructionText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 5,
    lineHeight: 22,
  },
  instructionDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  navigationBottomPanel: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    backgroundColor: '#1C2A3A',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  navigationPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navigationTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  cancelNavigationButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  navigationContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navigationStatsLeft: {
    flexDirection: 'row',
    gap: 20,
  },
  navigationStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navigationStatText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  travelModeCompact: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentButtonCompact: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  segmentButtonActive: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationLoading: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  startNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565C0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 12,
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  startNavigationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  activeNavigationPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  endNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  endNavigationButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  activeNavStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  activeNavTime: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '700',
  },
  activeNavDistance: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default Map;
