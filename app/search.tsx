import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { supabase } from '~/utils/supabase';
import BottomTabBar from '~/components/ui/BottomTabBar';
import Dropdown from '~/components/ui/Dropdown';
import FilterModal from '~/components/ui/FilterModal';
import MatchPickerModal, { type Match } from '~/components/ui/MatchPickerModal';
import { useFilterData } from '~/hooks/useFilterData';
import { useFavorites } from '~/hooks/useFavorites';
import { fetchBarIdsByMatch } from '~/services/bars';
import { useBoostBars } from '~/hooks/useBoostBars';
import { useBoostSelection } from '~/context/BoostSelectionContext';
import { useFavoritesStore } from '~/stores/favoritesStore';
import {
  AppText,
  AppCard,
  AppButton,
  SkeletonList,
  EmptyState,
  toast,
  colors,
  spacing,
  radius,
} from '~/components/ds';

interface Bar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  category_id?: number;
  rating?: number | null;
  review_count?: number | null;
  image_url?: string;
  distance_km?: number | null;
  bar_food_types?: { food_type_id: number }[];
  bar_selected_features?: { feature_id: number }[];
  bar_selected_tv_features?: { tv_feature_id: number }[];
  next_match?: {
    date: string;
    time: string;
  };
}

interface FilterOption {
  id: string;
  label: string;
  value: string;
}

const SORT_OPTIONS: FilterOption[] = [
  { id: 'proximity', label: '📍 Proximidad', value: 'proximity' },
  { id: 'rating', label: '⭐ Mejor valorados', value: 'rating' },
];

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Filters state
  const [selectedSort, setSelectedSort] = useState('proximity'); // Default to "Proximidad"
  const [selectedBarCategories, setSelectedBarCategories] = useState<number[]>([]);
  const [selectedFoodTypes, setSelectedFoodTypes] = useState<number[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<number[]>([]);
  const [selectedTvFeatures, setSelectedTvFeatures] = useState<number[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Match filter state
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);

  // Load filter data
  const { barCategories, foodTypes, barFeatures, tvFeatures, loading: filtersLoading } = useFilterData();

  // Load favorites functionality from store (optimistic updates)
  const isFavorite = useFavoritesStore(state => state.isFavorite);
  const toggleFavorite = useFavoritesStore(state => state.toggleFavorite);

  // Boost selection context
  const { setSelectedBoostBarIds, setCenterLatLng } = useBoostSelection();

  // Get boost bars based on current user location
  const { selected3Stable } = useBoostBars({
    centerLatLng: userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null,
    enabled: !!userLocation,
  });

  // Update context when selection changes - with stabilized reference
  useEffect(() => {
    if (selected3Stable.length > 0 || userLocation) {
      setSelectedBoostBarIds(selected3Stable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected3Stable.join(','), setSelectedBoostBarIds]); // Use join to create stable dependency

  // Update center when user location changes - debounced
  useEffect(() => {
    if (!userLocation) return;

    const timeoutId = setTimeout(() => {
      setCenterLatLng({ lat: userLocation.latitude, lng: userLocation.longitude });
    }, 100); // Small delay to batch updates

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.latitude, userLocation?.longitude, setCenterLatLng]); // Only depend on coordinates

  // Debug logs
  console.log('Filter data loaded:', {
    barCategories: barCategories.length,
    foodTypes: foodTypes.length,
    barFeatures: barFeatures.length,
    tvFeatures: tvFeatures.length,
    loading: filtersLoading
  });

  // Get user location
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso de ubicación',
          'Necesitamos acceso a tu ubicación para mostrar bares cercanos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  }, []);

  // Search bars
  const searchBars = useCallback(async () => {
    if (!userLocation) {
      await getUserLocation();
      return;
    }

    setLoading(true);

    try {
      console.log('🔍 Starting bar search with filters:', {
        searchQuery,
        selectedBarCategories,
        selectedFoodTypes,
        selectedFeatures,
        selectedTvFeatures,
        selectedSort
      });

      // Paso 1. Si hay filtro por partido, obtener barIds con eventos de ese partido
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
          return;
        }
      }

      // Paso 2. Cargar los bares activos
      let barsQuery = supabase
        .from('bars')
        .select(`
          id,
          name,
          description,
          address,
          city,
          latitude,
          longitude,
          category_id,
          rating,
          review_count,
          bar_images(image_url, image_order)
        `)
        .eq('is_active', true);

      // Aplicar filtro de búsqueda
      if (searchQuery.trim()) {
        barsQuery = barsQuery.ilike('name', `%${searchQuery.trim()}%`);
        console.log('🔍 Applied search filter:', searchQuery.trim());
      }

      // Aplicar filtro por partido (IDs)
      if (barIdsFilter) {
        barsQuery = barsQuery.in('id', barIdsFilter);
        console.log('🔍 Applied match filter (bar ids):', barIdsFilter.length);
      }

      // Aplicar filtro de categorías (esto se puede hacer a nivel de DB)
      if (selectedBarCategories.length > 0) {
        barsQuery = barsQuery.in('category_id', selectedBarCategories);
        console.log('🔍 Applied category filter at DB level:', selectedBarCategories);
      }

      const { data: barsData, error } = await barsQuery;

      if (error) {
        console.error('❌ Error fetching bars:', error);
        toast.error('Error', 'No se pudieron cargar los bares');
        return;
      }

      console.log('📊 Initial bars fetched:', barsData?.length || 0);

      if (!barsData || barsData.length === 0) {
        setBars([]);
        return;
      }

      // Paso 2. Cargar relaciones N:N por separado
      const barIds = barsData.map(bar => bar.id);
      console.log('🔍 Loading N:N relationships for bar IDs:', barIds);

      // Cargar todos los datos N:N
      const { data: foodTypes } = await supabase
        .from('bar_food_types')
        .select('*')
        .in('bar_id', barIds);

      const { data: features } = await supabase
        .from('bar_selected_features')
        .select('*')
        .in('bar_id', barIds);

      const { data: tvFeatures } = await supabase
        .from('bar_selected_tv_features')
        .select('*')
        .in('bar_id', barIds);

      console.log('📊 N:N relationships loaded:', {
        foodTypes: foodTypes?.length || 0,
        features: features?.length || 0,
        tvFeatures: tvFeatures?.length || 0
      });

      // Paso 3. Crear mapas para todos los tipos de datos
      const foodTypesMap = new Map();
      foodTypes?.forEach(({ bar_id, food_type_id }) => {
        if (!foodTypesMap.has(bar_id)) foodTypesMap.set(bar_id, []);
        foodTypesMap.get(bar_id).push({ food_type_id });
      });

      const featuresMap = new Map();
      features?.forEach(({ bar_id, feature_id }) => {
        if (!featuresMap.has(bar_id)) featuresMap.set(bar_id, []);
        featuresMap.get(bar_id).push({ feature_id });
      });

      const tvFeaturesMap = new Map();
      tvFeatures?.forEach(({ bar_id, tv_feature_id }) => {
        if (!tvFeaturesMap.has(bar_id)) tvFeaturesMap.set(bar_id, []);
        tvFeaturesMap.get(bar_id).push({ tv_feature_id });
      });

      console.log('🗺️ Maps created:', {
        foodTypesMapSize: foodTypesMap.size,
        featuresMapSize: featuresMap.size,
        tvFeaturesMapSize: tvFeaturesMap.size
      });

      // Paso 4. Fusionar la información por bar
      const enrichedBars = barsData.map(bar => {
        const enrichedBar = {
          ...bar,
          bar_food_types: foodTypesMap.get(bar.id) || [],
          bar_selected_features: featuresMap.get(bar.id) || [],
          bar_selected_tv_features: tvFeaturesMap.get(bar.id) || [],
        };

        // Log explícito para verificar que los datos se asignan correctamente
        console.log('✅ Bar enriched:', bar.name, {
          foods: enrichedBar.bar_food_types,
          features: enrichedBar.bar_selected_features,
          tvFeatures: enrichedBar.bar_selected_tv_features
        });

        return enrichedBar;
      });

      console.log('🔍 Enriched bars data:');
      enrichedBars.forEach(bar => {
        console.log(`📋 ${bar.name}:`, {
          category_id: bar.category_id,
          foodTypes: bar.bar_food_types,
          features: bar.bar_selected_features,
          tvFeatures: bar.bar_selected_tv_features
        });
      });

      // Debug: Log complete example bar
      if (enrichedBars.length > 0) {
        console.log('🧪 Bar ejemplo completo:', JSON.stringify(enrichedBars[0], null, 2));
      }

      // Calculate distances and add next match info
      const barsWithDistance = await Promise.all(
        (enrichedBars || []).map(async (bar) => {
          let distance = null;
          if (bar.latitude && bar.longitude) {
            distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              bar.latitude,
              bar.longitude
            );
          }

          // Get next match for this bar
          const { data: nextMatch } = await supabase
            .from('bar_posts')
            .select('start_date, end_date')
            .eq('bar_id', bar.id)
            .eq('post_type', 'evento')
            .eq('is_active', true)
            .gte('start_date', new Date().toISOString().split('T')[0])
            .order('start_date', { ascending: true })
            .limit(1)
            .single();

          // Find image with image_order = 1
          const mainImage = bar.bar_images
            ?.find((img: any) => img.image_order === 1)?.image_url || 
            bar.bar_images?.[0]?.image_url || null;

          console.log(`🖼️ Bar "${bar.name}":`, {
            totalImages: bar.bar_images?.length || 0,
            imageOrder1: bar.bar_images?.find((img: any) => img.image_order === 1)?.image_url,
            fallbackImage: bar.bar_images?.[0]?.image_url,
            selectedImage: mainImage
          });

          return {
            ...bar,
            distance_km: distance,
            image_url: mainImage,
            rating: bar.rating || 0, // Use real rating from database
            review_count: bar.review_count || 0, // Use real review count from database
            next_match: nextMatch ? {
              date: nextMatch.start_date,
              time: '18:00', // Default time, you might want to store this in your posts
            } : undefined,
          };
        })
      );

      // Apply client-side filtering for N:N relationships
      let filteredBars = barsWithDistance;

      // Apply food types filter (client-side)
      if (selectedFoodTypes.length > 0) {
        const beforeCount = filteredBars.length;
        console.log('🍕 Starting food types filter with:', selectedFoodTypes);
        
        filteredBars = filteredBars.filter(bar => {
          const foodIds = bar.bar_food_types?.map((ft: { food_type_id: number }) => ft.food_type_id) || [];
          
          // Check if bar has ALL selected food types (AND logic)
          const matchesFood = selectedFoodTypes.every(selectedId => {
            const hasFoodType = foodIds.includes(selectedId);
            console.log(`  🍕 Bar "${bar.name}": checking food_type_id ${selectedId} -> ${hasFoodType ? '✅' : '❌'}`);
            return hasFoodType;
          });
          
          console.log(`🧪 Bar "${bar.name}":`, {
            foodIds,
            selectedFoodTypes,
            matchesFood: matchesFood ? '✅' : '❌'
          });
          
          return matchesFood;
        });
        console.log('🍕 Applied food types filter (client-side):', selectedFoodTypes, `(${beforeCount} -> ${filteredBars.length} bars)`);
      }

      // Apply features filter (client-side)
      if (selectedFeatures.length > 0) {
        const beforeCount = filteredBars.length;
        console.log('✨ Starting features filter with:', selectedFeatures);
        
        filteredBars = filteredBars.filter(bar => {
          const featureIds = bar.bar_selected_features?.map((f: { feature_id: number }) => f.feature_id) || [];
          
          // Check if bar has ALL selected features (AND logic)
          const matchesFeatures = selectedFeatures.every(selectedId => {
            const hasFeature = featureIds.includes(selectedId);
            console.log(`  ✨ Bar "${bar.name}": checking feature_id ${selectedId} -> ${hasFeature ? '✅' : '❌'}`);
            return hasFeature;
          });
          
          console.log(`🧪 Bar "${bar.name}":`, {
            featureIds,
            selectedFeatures,
            matchesFeatures: matchesFeatures ? '✅' : '❌'
          });
          
          return matchesFeatures;
        });
        console.log('✨ Applied features filter (client-side):', selectedFeatures, `(${beforeCount} -> ${filteredBars.length} bars)`);
      }

      // Apply TV features filter (client-side)
      if (selectedTvFeatures.length > 0) {
        const beforeCount = filteredBars.length;
        console.log('📺 Starting TV features filter with:', selectedTvFeatures);
        
        filteredBars = filteredBars.filter(bar => {
          const tvFeatureIds = bar.bar_selected_tv_features?.map((tf: { tv_feature_id: number }) => tf.tv_feature_id) || [];
          
          // Check if bar has ALL selected TV features (AND logic)
          const matchesTvFeatures = selectedTvFeatures.every(selectedId => {
            const hasTvFeature = tvFeatureIds.includes(selectedId);
            console.log(`  📺 Bar "${bar.name}": checking tv_feature_id ${selectedId} -> ${hasTvFeature ? '✅' : '❌'}`);
            return hasTvFeature;
          });
          
          console.log(`🧪 Bar "${bar.name}":`, {
            tvFeatureIds,
            selectedTvFeatures,
            matchesTvFeatures: matchesTvFeatures ? '✅' : '❌'
          });
          
          return matchesTvFeatures;
        });
        console.log('📺 Applied TV features filter (client-side):', selectedTvFeatures, `(${beforeCount} -> ${filteredBars.length} bars)`);
      }

      // Fetch active boost bars directly for immediate sorting
      let boostBarIds: string[] = [];
      try {
        const now = new Date().toISOString();
        const { data: boostData } = await supabase
          .from('bar_boosts')
          .select('bar_id, end_at')
          .eq('status', 'active')
          .gt('end_at', now);

        if (boostData && boostData.length > 0) {
          // Get unique bar IDs that have active boosts
          boostBarIds = [...new Set(boostData.map(b => b.bar_id))];
          console.log('🚀 Found active boost bars:', boostBarIds.length);
        }
      } catch (error) {
        console.error('❌ Error fetching boost bars:', error);
      }

      // Apply sorting with BOOST PRIORITY
      let sortedBars = [...filteredBars];

      // Primary sort: Boosted bars always come first
      sortedBars.sort((a, b) => {
        const aIsBoosted = boostBarIds.includes(a.id);
        const bIsBoosted = boostBarIds.includes(b.id);

        // If one is boosted and the other isn't, boosted comes first
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;

        // Both boosted or both not boosted: apply secondary sort
        switch (selectedSort) {
          case 'proximity':
            if (a.distance_km && b.distance_km) {
              return a.distance_km - b.distance_km;
            }
            return 0;
          case 'rating':
            return (b.rating || 0) - (a.rating || 0);
          default:
            return 0;
        }
      });

      console.log('✅ Final bars after filtering and sorting:', sortedBars.length);
      console.log('🚀 Boosted bars on top:', boostBarIds.length);
      console.log('📋 Bars found:', sortedBars.map(bar => bar.name));

      setBars(sortedBars);
    } catch (error) {
      console.error('❌ Error in searchBars:', error);
      toast.error('Error', 'Ocurrió un error al buscar bares');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSort, selectedBarCategories, selectedFoodTypes, selectedFeatures, selectedTvFeatures, userLocation, getUserLocation, selectedMatch]);

  // Update highlighting when boost selection changes (for visual sync with map)
  // Note: Initial sorting is now handled inside searchBars()
  useEffect(() => {
    if (bars.length === 0 || selected3Stable.length === 0) return;

    // Just trigger a re-render to update golden borders
    // The bars are already sorted correctly from searchBars()
    console.log('✨ Boost selection updated for visual sync:', selected3Stable.length);
  }, [selected3Stable, bars.length]);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Handle search
  const handleSearch = useCallback(() => {
    searchBars();
  }, [searchBars]);

  // Handle apply filters
  const handleApplyFilters = useCallback(() => {
    console.log('🎉 Applying filters and searching bars...');
    searchBars();
    setFilterModalVisible(false);
  }, [searchBars]);

  // Handle clear all filters
  const handleClearAllFilters = useCallback(() => {
    console.log('🧹 Clearing all filters...');
    setSelectedBarCategories([]);
    setSelectedFoodTypes([]);
    setSelectedFeatures([]);
    setSelectedTvFeatures([]);
    setSearchQuery('');
    // The search will be triggered automatically by the useEffect
  }, []);

  // Check and create sample data for N:N relationships
  const checkAndCreateSampleData = useCallback(async () => {
    try {
      console.log('🔍 Checking N:N relationship data...');
      
      // Check if we have any data in the N:N tables
      const { data: foodTypesData } = await supabase
        .from('bar_food_types')
        .select('*')
        .limit(5);
      
      const { data: featuresData } = await supabase
        .from('bar_selected_features')
        .select('*')
        .limit(5);
      
      const { data: languagesData } = await supabase
        .from('bar_languages')
        .select('*')
        .limit(5);
      
      console.log('📊 N:N data check:', {
        hasFoodTypes: foodTypesData && foodTypesData.length > 0,
        hasFeatures: featuresData && featuresData.length > 0,
        hasLanguages: languagesData && languagesData.length > 0,
        foodTypesCount: foodTypesData?.length || 0,
        featuresCount: featuresData?.length || 0,
        languagesCount: languagesData?.length || 0
      });
      
      // Show sample data if available
      if (foodTypesData && foodTypesData.length > 0) {
        console.log('🍕 Sample food types data:', foodTypesData);
      }
      
      if (featuresData && featuresData.length > 0) {
        console.log('✨ Sample features data:', featuresData);
      }
      
      if (languagesData && languagesData.length > 0) {
        console.log('🌍 Sample languages data:', languagesData);
      }
      
      // If no data exists, we might need to create some sample data
      if (!foodTypesData || foodTypesData.length === 0) {
        console.log('⚠️ No food types data found in bar_food_types table');
      }
      
      if (!featuresData || featuresData.length === 0) {
        console.log('⚠️ No features data found in bar_selected_features table');
      }
      
      if (!languagesData || languagesData.length === 0) {
        console.log('⚠️ No languages data found in bar_languages table');
      }
      
    } catch (error) {
      console.error('❌ Error checking N:N data:', error);
    }
  }, []);

  // Handle bar selection
  const handleBarPress = useCallback((barId: string) => {
    router.push(`/bar-profile/${barId}` as any);
  }, [router]);

  // Render bar card
  const renderBarCard = useCallback(({ item }: { item: Bar }) => {
    console.log("Rendering bar card for:", item.name);

    const handleFavoriteToggle = async (e: any) => {
      e.stopPropagation(); // Prevent triggering the card press
      const wasFavorite = isFavorite(item.id);
      const success = await toggleFavorite(item.id);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log(wasFavorite ? '🗑️ Removed from favorites:' : '❤️ Added to favorites:', item.name);
      }
    };

    // Check if this bar is boosted
    const isBoosted = selected3Stable.includes(item.id);

    const handleViewOnMap = (e: any) => {
      e.stopPropagation(); // Prevent triggering the card press
      // Navigate to map with bar pre-selected
      router.push({
        pathname: '/(protected)/map',
        params: {
          selectedBarId: item.id,
          selectedBarLat: item.latitude,
          selectedBarLng: item.longitude,
          selectedBarName: item.name,
        },
      });
    };

    return (
      <AppCard
        style={isBoosted ? styles.barCardBoosted : undefined}
        onPress={() => handleBarPress(item.id)}
      >
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.barImage}
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="image-outline" size={32} color={colors.text.muted} />
              <AppText variant="caption" color={colors.text.muted}>
                Sin imagen
              </AppText>
            </View>
          )}

          {/* Top Sticker for Boosted Bars */}
          {isBoosted && (
            <View style={styles.topSticker}>
              <Ionicons name="flash" size={14} color={colors.status.boost} />
              <AppText variant="caption" color={colors.status.boost} style={styles.topStickerText}>DESTACADO</AppText>
            </View>
          )}

          {/* Favorites Button */}
          <TouchableOpacity
            style={[styles.favoritesButton, isFavorite(item.id) && styles.favoritesButtonActive]}
            onPress={handleFavoriteToggle}
          >
            <Ionicons
              name={isFavorite(item.id) ? "heart" : "heart-outline"}
              size={20}
              color={colors.text.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.barInfo}>
          <AppText variant="title" style={styles.barName}>{item.name}</AppText>

          <View style={styles.barMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color={colors.status.warning} />
              <AppText variant="body">
                {(typeof item.rating === 'number' ? item.rating.toFixed(1) : 'N/A')} ({item.review_count || 0} reseñas)
              </AppText>
            </View>

            {typeof item.distance_km === 'number' && !isNaN(item.distance_km) && (
              <AppText variant="body" color={colors.brand.accent} style={styles.distanceText}>
                {item.distance_km.toFixed(1)} km
              </AppText>
            )}
          </View>

          {item.next_match?.date && item.next_match?.time && (
            <View style={styles.nextMatchContainer}>
              <Ionicons name="calendar" size={14} color={colors.brand.accent} />
              <AppText variant="body" color={colors.brand.accent} style={styles.nextMatchText}>
                Próximo partido: {new Date(item.next_match.date).toLocaleDateString('es-ES')} {item.next_match.time}
              </AppText>
            </View>
          )}

          {item.address && item.city && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={colors.text.muted} />
              <AppText variant="caption" color={colors.text.secondary} style={styles.barAddress}>
                {item.address}, {item.city}
              </AppText>
            </View>
          )}

          {/* View on Map Button */}
          <TouchableOpacity
            style={styles.viewOnMapButton}
            onPress={handleViewOnMap}
          >
            <Ionicons name="map-outline" size={16} color={colors.brand.link} />
            <AppText variant="label" color={colors.brand.link}>Ver en el Mapa</AppText>
          </TouchableOpacity>
        </View>
      </AppCard>
    );

  }, [handleBarPress, toggleFavorite, isFavorite, selected3Stable]);

  // Load initial data
  useEffect(() => {
    getUserLocation();
    checkAndCreateSampleData(); // Check N:N relationship data
  }, [getUserLocation, checkAndCreateSampleData]);

  // Search when filters change
  useEffect(() => {
    if (userLocation) {
      console.log('🔄 Filters changed, triggering search...');
      searchBars();
    }
  }, [selectedSort, selectedBarCategories, selectedFoodTypes, selectedFeatures, selectedTvFeatures, selectedMatch, userLocation, searchBars]);


  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
  
      {/* Removed header for minimalist design */}
  
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { flex: 1 }]}>
            <Ionicons name="search" size={18} color={colors.text.secondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar nombre de bar..."
              placeholderTextColor={colors.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.filterIconButton,
              (selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedTvFeatures.length > 0) && styles.filterIconButtonActive
            ]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="filter" size={18} color={colors.text.secondary} />
            {(selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedTvFeatures.length > 0) && (
              <View style={styles.filterDot} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <View style={styles.filtersRow}>
          {/* Ordenar */}
          <View style={styles.filterColumn}>
            <AppText variant="label" style={styles.filterLabelSpacing}>Ordenar por</AppText>
            <Dropdown
              label="Ordenar"
              options={SORT_OPTIONS}
              selectedValue={selectedSort}
              onSelect={setSelectedSort}
              placeholder="Ordenar"
            />
          </View>

          {/* Partido */}
          <View style={styles.filterColumn}>
            <AppText variant="label" style={styles.filterLabelSpacing}>Partido</AppText>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setMatchPickerOpen(true)}
            >
              <AppText style={styles.iconEmoji}>⚽</AppText>
              <AppText variant="caption" color={colors.text.secondary}>
                {selectedMatch ? 'Cambiar partido' : 'Seleccionar partido'}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
  
      {/* 🔽 Resultados */}
      <View style={styles.resultsContainer}>
        {/* Team selector chip moved to top controls */}

        {loading ? (
          <SkeletonList count={3} />
        ) : bars.length > 0 ? (
          <FlashList
            data={bars}
            renderItem={renderBarCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.barsList}
            estimatedItemSize={300}
          />
        ) : (
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="search"
              title="No se encontraron bares"
              subtitle={
                selectedMatch
                  ? 'No hay bares transmitiendo este partido'
                  : searchQuery
                  ? `No hay bares que coincidan con "${searchQuery}"`
                  : (selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedTvFeatures.length > 0)
                    ? 'No hay bares que cumplan con los filtros seleccionados'
                    : 'No hay bares disponibles en tu área'
              }
            />
            <View style={styles.emptyActions}>
              {(selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedTvFeatures.length > 0) && (
                <AppButton text="Limpiar filtros" variant="dark" onPress={handleClearAllFilters} />
              )}
              {searchQuery ? (
                <AppButton text="Limpiar búsqueda" variant="dark" onPress={() => setSearchQuery('')} />
              ) : null}
              {selectedMatch ? (
                <AppButton text="Quitar partido" variant="dark" onPress={() => setSelectedMatch(null)} />
              ) : null}
            </View>
          </View>
        )}
      </View>

      {/* Floating Match Banner - Above BottomTabBar */}
      {selectedMatch && (
        <View style={styles.floatingMatchBanner}>
          <View style={styles.matchBannerContent}>
            <View style={styles.matchTeam}>
              {selectedMatch.home_team?.logo_url ? (
                <Image
                  source={{ uri: selectedMatch.home_team.logo_url }}
                  style={styles.matchTeamLogo}
                />
              ) : (
                <Ionicons name="shield-outline" size={14} color="#FFFFFF" />
              )}
              <AppText variant="caption" color="#FFFFFF" numberOfLines={1} style={styles.matchTeamName}>
                {selectedMatch.home_team?.name || 'Local'}
              </AppText>
            </View>
            <AppText variant="caption" color="rgba(255,255,255,0.7)" style={styles.matchVsBanner}>vs</AppText>
            <View style={styles.matchTeam}>
              {selectedMatch.away_team?.logo_url ? (
                <Image
                  source={{ uri: selectedMatch.away_team.logo_url }}
                  style={styles.matchTeamLogo}
                />
              ) : (
                <Ionicons name="shield-outline" size={14} color="#FFFFFF" />
              )}
              <AppText variant="caption" color="#FFFFFF" numberOfLines={1} style={styles.matchTeamName}>
                {selectedMatch.away_team?.name || 'Visitante'}
              </AppText>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setSelectedMatch(null)}
            style={styles.matchBannerClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>
      )}

      <BottomTabBar />

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg - 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'android' ? spacing.sm : spacing.lg - 6,
    ...(Platform.OS === 'android' && {
      minHeight: 44,
    }),
  },
  filterIconButton: {
    backgroundColor: colors.bg.element,
    borderRadius: radius.lg,
    padding: spacing.lg - 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    position: 'relative',
  },
  filterIconButtonActive: {
    backgroundColor: colors.brand.primary,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: radius.xs,
    backgroundColor: colors.status.error,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    ...(Platform.OS === 'android' && {
      textAlignVertical: 'center',
      includeFontPadding: false,
    }),
  },
  filtersContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.lg - 6,
  },
  filterColumn: {
    flex: 1,
  },
  filterLabelSpacing: {
    marginBottom: spacing.sm - 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.element,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.sm - 2,
    position: 'relative',
    minHeight: 38,
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.brand.primary,
  },
  iconEmoji: {
    fontSize: 15,
    marginRight: spacing.xs,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  barsList: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  barCardBoosted: {
    borderWidth: 2,
    borderColor: colors.status.boost,
    shadowColor: colors.status.boost,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  barImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topSticker: {
    position: 'absolute',
    top: spacing.lg - 6,
    left: spacing.lg - 6,
    backgroundColor: 'rgba(26, 35, 50, 0.95)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.status.boost,
    shadowColor: colors.status.boost,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 2,
  },
  topStickerText: {
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  favoritesButton: {
    position: 'absolute',
    top: spacing.lg - 6,
    right: spacing.lg - 6,
    backgroundColor: colors.overlay.dark,
    borderRadius: radius.round,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  favoritesButtonActive: {
    backgroundColor: colors.status.error,
  },
  barInfo: {
    padding: spacing.lg,
  },
  barName: {
    marginBottom: spacing.sm,
  },
  barMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  distanceText: {
    fontWeight: '500',
  },
  nextMatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    marginBottom: spacing.sm,
  },
  nextMatchText: {
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  barAddress: {
    flex: 1,
  },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    backgroundColor: colors.alpha.brandLight,
    paddingVertical: spacing.lg - 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.alpha.brandBorder,
    marginTop: spacing.xs,
  },
  emptyWrapper: {
    flex: 1,
  },
  emptyActions: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  floatingMatchBanner: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 75,
    left: '5%',
    right: '5%',
    backgroundColor: 'rgba(25, 118, 210, 0.6)', // Transparent blue like map
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  matchBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingRight: 10,
  },
  matchTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  matchTeamLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  matchTeamName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  matchVsBanner: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  matchBannerClose: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});