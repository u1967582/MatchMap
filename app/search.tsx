import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  Alert,
  Dimensions,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '~/utils/supabase';
import BottomTabBar from '~/components/ui/BottomTabBar';
import Dropdown from '~/components/ui/Dropdown';
import FilterModal from '~/components/ui/FilterModal';
import { useFilterData } from '~/hooks/useFilterData';
import { useFavorites } from '~/hooks/useFavorites';
import { searchTeams, type TeamSearchResult } from '~/services/teams';
import { fetchBarIdsByTeam } from '~/services/bars';

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
  bar_languages?: { language_id: number }[];
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
  const [favoriteStates, setFavoriteStates] = useState<{ [key: string]: boolean }>({});
  
  // Filters state
  const [selectedSort, setSelectedSort] = useState('proximity');
  const [selectedBarCategories, setSelectedBarCategories] = useState<number[]>([]);
  const [selectedFoodTypes, setSelectedFoodTypes] = useState<number[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<number[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<number[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Team filter state
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(null);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [tempSelectedTeam, setTempSelectedTeam] = useState<TeamSearchResult | null>(null);

  // Load filter data
  const { barCategories, foodTypes, barFeatures, languages, loading: filtersLoading } = useFilterData();

  // Load favorites functionality
  const { toggleFavorite, isFavorite } = useFavorites();

  // Debug logs
  console.log('Filter data loaded:', {
    barCategories: barCategories.length,
    foodTypes: foodTypes.length,
    barFeatures: barFeatures.length,
    languages: languages.length,
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
        selectedLanguages,
        selectedSort
      });

      // Paso 1. Si hay filtro por equipo, obtener barIds con eventos de ese equipo
      let barIdsFilter: string[] | null = null;
      if (selectedTeamId) {
        try {
          barIdsFilter = await fetchBarIdsByTeam(selectedTeamId, true);
        } catch (e) {
          console.error('❌ Error fetching barIds by team:', e);
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

      // Aplicar filtro por equipo (IDs)
      if (barIdsFilter) {
        barsQuery = barsQuery.in('id', barIdsFilter);
        console.log('🔍 Applied team filter (bar ids):', barIdsFilter.length);
      }

      // Aplicar filtro de categorías (esto se puede hacer a nivel de DB)
      if (selectedBarCategories.length > 0) {
        barsQuery = barsQuery.in('category_id', selectedBarCategories);
        console.log('🔍 Applied category filter at DB level:', selectedBarCategories);
      }

      const { data: barsData, error } = await barsQuery;

      if (error) {
        console.error('❌ Error fetching bars:', error);
        Alert.alert('Error', 'No se pudieron cargar los bares');
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

      const { data: languages } = await supabase
        .from('bar_languages')
        .select('*')
        .in('bar_id', barIds);

      console.log('📊 N:N relationships loaded:', {
        foodTypes: foodTypes?.length || 0,
        features: features?.length || 0,
        languages: languages?.length || 0
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

      const languagesMap = new Map();
      languages?.forEach(({ bar_id, language_id }) => {
        if (!languagesMap.has(bar_id)) languagesMap.set(bar_id, []);
        languagesMap.get(bar_id).push({ language_id });
      });

      console.log('🗺️ Maps created:', {
        foodTypesMapSize: foodTypesMap.size,
        featuresMapSize: featuresMap.size,
        languagesMapSize: languagesMap.size
      });

      // Paso 4. Fusionar la información por bar
      const enrichedBars = barsData.map(bar => {
        const enrichedBar = {
          ...bar,
          bar_food_types: foodTypesMap.get(bar.id) || [],
          bar_selected_features: featuresMap.get(bar.id) || [],
          bar_languages: languagesMap.get(bar.id) || [],
        };

        // Log explícito para verificar que los datos se asignan correctamente
        console.log('✅ Bar enriched:', bar.name, {
          foods: enrichedBar.bar_food_types,
          features: enrichedBar.bar_selected_features,
          languages: enrichedBar.bar_languages
        });

        return enrichedBar;
      });

      console.log('🔍 Enriched bars data:');
      enrichedBars.forEach(bar => {
        console.log(`📋 ${bar.name}:`, {
          category_id: bar.category_id,
          foodTypes: bar.bar_food_types,
          features: bar.bar_selected_features,
          languages: bar.bar_languages
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

      // Apply languages filter (client-side)
      if (selectedLanguages.length > 0) {
        const beforeCount = filteredBars.length;
        console.log('🌍 Starting languages filter with:', selectedLanguages);
        
        filteredBars = filteredBars.filter(bar => {
          const languageIds = bar.bar_languages?.map((l: { language_id: number }) => l.language_id) || [];
          
          // Check if bar has ALL selected languages (AND logic)
          const matchesLanguages = selectedLanguages.every(selectedId => {
            const hasLanguage = languageIds.includes(selectedId);
            console.log(`  🌍 Bar "${bar.name}": checking language_id ${selectedId} -> ${hasLanguage ? '✅' : '❌'}`);
            return hasLanguage;
          });
          
          console.log(`🧪 Bar "${bar.name}":`, {
            languageIds,
            selectedLanguages,
            matchesLanguages: matchesLanguages ? '✅' : '❌'
          });
          
          return matchesLanguages;
        });
        console.log('🌍 Applied languages filter (client-side):', selectedLanguages, `(${beforeCount} -> ${filteredBars.length} bars)`);
      }

      // Apply sorting
      let sortedBars = [...filteredBars];
      switch (selectedSort) {
        case 'proximity':
          sortedBars.sort((a, b) => {
            if (a.distance_km && b.distance_km) {
              return a.distance_km - b.distance_km;
            }
            return 0;
          });
          console.log('📍 Sorted by proximity');
          break;
        case 'rating':
          sortedBars.sort((a, b) => ((b.rating || 0) - (a.rating || 0)));
          console.log('⭐ Sorted by rating');
          break;
      }

      console.log('✅ Final bars after filtering and sorting:', sortedBars.length);
      console.log('📋 Bars found:', sortedBars.map(bar => bar.name));

      setBars(sortedBars);
    } catch (error) {
      console.error('❌ Error in searchBars:', error);
      Alert.alert('Error', 'Ocurrió un error al buscar bares');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSort, selectedBarCategories, selectedFoodTypes, selectedFeatures, selectedLanguages, userLocation, getUserLocation, selectedTeamId]);

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
    setSelectedLanguages([]);
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

  // Check favorite status for all bars
  useEffect(() => {
    const checkFavorites = async () => {
      const newFavoriteStates: { [key: string]: boolean } = {};
      
      for (const bar of bars) {
        const isFav = await isFavorite(bar.id);
        newFavoriteStates[bar.id] = isFav;
      }
      
      setFavoriteStates(newFavoriteStates);
    };
    
    if (bars.length > 0) {
      checkFavorites();
    }
  }, [bars, isFavorite]);

  // Render bar card
  const renderBarCard = useCallback(({ item }: { item: Bar }) => {
    console.log("Rendering bar card for:", item.name);
  
    const handleFavoriteToggle = async (e: any) => {
      e.stopPropagation(); // Prevent triggering the card press
      const success = await toggleFavorite(item.id);
      if (success) {
        setFavoriteStates(prev => ({
          ...prev,
          [item.id]: !prev[item.id]
        }));
        console.log(favoriteStates[item.id] ? '🗑️ Removed from favorites:' : '❤️ Added to favorites:', item.name);
      }
    };
  
    return (
      <TouchableOpacity 
        style={styles.barCard}
        onPress={() => handleBarPress(item.id)}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: item.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar'
            }}
            style={styles.barImage}
          />
          
          {/* Favorites Button */}
          <TouchableOpacity 
            style={[styles.favoritesButton, favoriteStates[item.id] && styles.favoritesButtonActive]}
            onPress={handleFavoriteToggle}
          >
            <Ionicons 
              name={favoriteStates[item.id] ? "heart" : "heart-outline"} 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>
    
        <View style={styles.barInfo}>
          <Text style={styles.barName}>{item.name}</Text>
    
          <View style={styles.barMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {(typeof item.rating === 'number' ? item.rating.toFixed(1) : 'N/A')} ({item.review_count || 0} reseñas)
              </Text>
            </View>
    
            {typeof item.distance_km === 'number' && !isNaN(item.distance_km) && (
              <Text style={styles.distanceText}>
                {item.distance_km.toFixed(1)} km
              </Text>
            )}
          </View>
    
          {item.next_match?.date && item.next_match?.time && (
            <View style={styles.nextMatchContainer}>
              <Ionicons name="calendar" size={14} color="#10B981" />
              <Text style={styles.nextMatchText}>
                Próximo partido: {new Date(item.next_match.date).toLocaleDateString('es-ES')} {item.next_match.time}
              </Text>
            </View>
          )}
    
          {item.address && item.city && (
            <Text style={styles.barAddress}>{item.address}, {item.city}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
    
  }, [handleBarPress, toggleFavorite, favoriteStates]);

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
  }, [selectedSort, selectedBarCategories, selectedFoodTypes, selectedFeatures, selectedLanguages, selectedTeamId, userLocation, searchBars]);

  // Team search effect (debounced by simple length check)
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setTeamLoading(true);
        if (teamSearchQuery.trim().length < 2) {
          setTeamResults([]);
          return;
        }
        const results = await searchTeams(teamSearchQuery.trim());
        if (active) setTeamResults(results);
      } catch (e) {
        console.error('❌ Error searching teams:', e);
      } finally {
        if (active) setTeamLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [teamSearchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
  
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Buscar Bares</Text>
      </View>
  
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { flex: 1 }]}>
            <Ionicons name="search" size={20} color="#A3B3CC" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar nombre de bar..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#A3B3CC" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.filterIconButton,
              (selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedLanguages.length > 0) && styles.filterIconButtonActive
            ]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="filter" size={18} color="#A3B3CC" />
            {(selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedLanguages.length > 0) && (
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
            <Text style={styles.filterLabel}>Ordenar por</Text>
            <Dropdown
              label="Ordenar"
              options={SORT_OPTIONS}
              selectedValue={selectedSort}
              onSelect={setSelectedSort}
              placeholder="Ordenar"
            />
          </View>

          {/* Equipo */}
          <View style={styles.filterColumn}>
            <Text style={styles.filterLabel}>Equipo</Text>
            <TouchableOpacity
              style={[styles.filterButton, selectedTeamId && styles.filterButtonActive]}
              onPress={() => {
                setTempSelectedTeam(null);
                setTeamSearchQuery('');
                setTeamPickerOpen(true);
              }}
            >
              <Text style={[styles.iconEmoji]}>⚽</Text>
              <Text style={[
                styles.filterButtonText,
                selectedTeamId && styles.filterButtonTextActive
              ]}>
                {selectedTeamName ? selectedTeamName : 'Equipo'}
              </Text>
              {selectedTeamId && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTeamId(null);
                    setSelectedTeamName(null);
                  }}
                  style={{ position: 'absolute', right: 10, padding: 6 }}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
  
      {/* 🔽 Resultados */}
      <View style={styles.resultsContainer}>
        {/* Team selector chip moved to top controls */}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Buscando bares...</Text>
          </View>
        ) : bars.length > 0 ? (
          <FlatList
            data={bars}
            renderItem={renderBarCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.barsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={64} color="#A3B3CC" />
            <Text style={styles.emptyTitle}>No se encontraron bares</Text>
            <Text style={styles.emptySubtitle}>
              {selectedTeamId
                ? 'No hay bares con eventos de este equipo'
                : searchQuery 
                ? `No hay bares que coincidan con "${searchQuery}"`
                : (selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedLanguages.length > 0)
                  ? `No hay bares que cumplan con los filtros seleccionados${
                      selectedBarCategories.length > 0 ? ` (${selectedBarCategories.length} categorías)` : ''
                    }${
                      selectedFoodTypes.length > 0 ? ` (${selectedFoodTypes.length} tipos de comida)` : ''
                    }${
                      selectedFeatures.length > 0 ? ` (${selectedFeatures.length} características)` : ''
                    }${
                      selectedLanguages.length > 0 ? ` (${selectedLanguages.length} idiomas)` : ''
                    }`
                  : 'No hay bares disponibles en tu área'
              }
            </Text>
            {(selectedBarCategories.length > 0 || selectedFoodTypes.length > 0 || selectedFeatures.length > 0 || selectedLanguages.length > 0) && (
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={handleClearAllFilters}
              >
                <Text style={styles.clearFiltersButtonText}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
            {searchQuery && (
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearFiltersButtonText}>Limpiar búsqueda</Text>
              </TouchableOpacity>
            )}
            {selectedTeamId && (
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => {
                  setSelectedTeamId(null);
                  setSelectedTeamName(null);
                }}
              >
                <Text style={styles.clearFiltersButtonText}>Quitar equipo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <BottomTabBar />

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

      {/* Team Picker Modal */}
      <Modal
        visible={teamPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTeamPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Seleccionar equipo</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#A3B3CC" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar equipo..."
                placeholderTextColor="#8E8E93"
                value={teamSearchQuery}
                onChangeText={setTeamSearchQuery}
                returnKeyType="search"
              />
              {teamSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setTeamSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#A3B3CC" />
                </TouchableOpacity>
              )}
            </View>

            {teamLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <FlatList
                data={teamResults}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.teamRow, tempSelectedTeam?.id === item.id && styles.teamRowSelected]}
                    onPress={() => setTempSelectedTeam(item)}
                  >
                    <Image source={{ uri: item.logo_url || undefined }} style={styles.teamLogo} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{item.name}</Text>
                      {item.short_name ? (
                        <Text style={styles.teamShortName}>{item.short_name}</Text>
                      ) : null}
                    </View>
                    {tempSelectedTeam?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptySubtitle}>
                      {teamSearchQuery.trim().length < 2 ? 'Empieza a escribir para buscar equipos' : 'No se encontraron equipos'}
                    </Text>
                  </View>
                )}
              />
            )}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setTempSelectedTeam(null);
                  setSelectedTeamId(null);
                  setSelectedTeamName(null);
                  setTeamPickerOpen(false);
                }}
              >
                <Text style={styles.modalButtonText}>Quitar selección</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  setSelectedTeamId(tempSelectedTeam ? tempSelectedTeam.id : null);
                  setSelectedTeamName(tempSelectedTeam ? tempSelectedTeam.name : null);
                  setTeamPickerOpen(false);
                }}
                disabled={teamLoading}
              >
                <Text style={styles.modalButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterIconButton: {
    backgroundColor: '#243243',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    position: 'relative',
  },
  filterIconButtonActive: {
    backgroundColor: '#1976D2',
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
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  filterColumn: {
    flex: 1,
  },
  filterLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243243',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 8,
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#1976D2',
  },
  filterButtonText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  iconEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#A3B3CC',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  barsList: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Space for footer
  },
  barCard: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  barImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoritesButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  favoritesButtonActive: {
    backgroundColor: '#EF4444',
  },
  barInfo: {
    padding: 16,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  barMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  distanceText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  nextMatchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  nextMatchText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  barAddress: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  clearFiltersButton: {
    marginTop: 20,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#1C2A3A',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2332',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  teamRowSelected: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  teamLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: '#2A3A4A',
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  teamShortName: {
    color: '#A3B3CC',
    fontSize: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#1976D2',
  },
  modalButtonSecondary: {
    backgroundColor: '#2A3A4A',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});