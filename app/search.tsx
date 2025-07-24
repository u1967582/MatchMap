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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '~/utils/supabase';
import BottomTabBar from '~/components/ui/BottomTabBar';
import Dropdown from '~/components/ui/Dropdown';

interface Bar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  rating?: number | null;
  review_count?: number | null;
  image_url?: string;
  distance_km?: number | null;
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

const CATEGORIES: FilterOption[] = [
  { id: 'all', label: 'Todas', value: 'all' },
  { id: 'sports', label: 'Deportes', value: 'sports' },
  { id: 'pub', label: 'Pub', value: 'pub' },
  { id: 'restaurant', label: 'Restaurante', value: 'restaurant' },
  { id: 'club', label: 'Club', value: 'club' },
];

const DISTANCES: FilterOption[] = [
  { id: '5', label: '5 km', value: '5' },
  { id: '10', label: '10 km', value: '10' },
  { id: '20', label: '20 km', value: '20' },
  { id: '50', label: '50 km', value: '50' },
];

const RATINGS: FilterOption[] = [
  { id: 'desc', label: 'Mejor valorados', value: 'desc' },
  { id: 'asc', label: 'Menos valorados', value: 'asc' },
  { id: 'reviews', label: 'Más reseñas', value: 'reviews' },
];

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Filters state
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDistance, setSelectedDistance] = useState('10');
  const [selectedRating, setSelectedRating] = useState('desc');

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
      let query = supabase
        .from('bars')
        .select(`
          id,
          name,
          description,
          address,
          city,
          latitude,
          longitude,
          bar_images(image_url, image_order)
        `)
        .eq('is_active', true);

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery.trim()}%`);
      }

      // Apply category filter
      if (selectedCategory !== 'all') {
        // Note: You might need to add a category field to your bars table
        // For now, we'll skip category filtering
      }

      const { data: barsData, error } = await query;

      if (error) {
        console.error('Error fetching bars:', error);
        Alert.alert('Error', 'No se pudieron cargar los bares');
        return;
      }

      // Calculate distances and add next match info
      const barsWithDistance = await Promise.all(
        (barsData || []).map(async (bar) => {
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

          return {
            ...bar,
            distance_km: distance,
            image_url: bar.bar_images?.[0]?.image_url,
            rating: 0, // Default rating until we have the actual data
            review_count: 0, // Default review count until we have the actual data
            next_match: nextMatch ? {
              date: nextMatch.start_date,
              time: '18:00', // Default time, you might want to store this in your posts
            } : undefined,
          };
        })
      );

      // Apply distance filter
      const maxDistance = parseInt(selectedDistance);
      const filteredByDistance = barsWithDistance.filter(
        bar => !bar.distance_km || bar.distance_km <= maxDistance
      );

      // Apply rating filter
      let sortedBars = [...filteredByDistance];
      switch (selectedRating) {
        case 'desc':
          sortedBars.sort((a, b) => ((b.rating || 0) - (a.rating || 0)));
          break;
        case 'asc':
          sortedBars.sort((a, b) => ((a.rating || 0) - (b.rating || 0)));
          break;
        case 'reviews':
          sortedBars.sort((a, b) => ((b.review_count || 0) - (a.review_count || 0)));
          break;
      }

      // Sort by distance if available
      sortedBars.sort((a, b) => {
        if (a.distance_km && b.distance_km) {
          return a.distance_km - b.distance_km;
        }
        return 0;
      });

      setBars(sortedBars);
    } catch (error) {
      console.error('Error in searchBars:', error);
      Alert.alert('Error', 'Ocurrió un error al buscar bares');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedDistance, selectedRating, userLocation, getUserLocation]);

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

  // Handle bar selection
  const handleBarPress = useCallback((barId: string) => {
    router.push(`/bar-profile/${barId}` as any);
  }, [router]);

  // Render bar card
  const renderBarCard = useCallback(({ item }: { item: Bar }) => {
    console.log("Rendering bar card for:", item.name);
  
    return (
      <TouchableOpacity 
        style={styles.barCard}
        onPress={() => handleBarPress(item.id)}
      >
        <Image
          source={{
            uri: item.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar'
          }}
          style={styles.barImage}
        />
    
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
    
  }, [handleBarPress]);

  // Load initial data
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Search when filters change
  useEffect(() => {
    if (userLocation) {
      searchBars();
    }
  }, [selectedCategory, selectedDistance, selectedRating, userLocation, searchBars]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
  
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Buscar Bares</Text>
      </View>
  
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
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
      </View>
  
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filtersScrollContent}
        >
          <Dropdown
            label="Categoría"
            options={CATEGORIES}
            selectedValue={selectedCategory}
            onSelect={setSelectedCategory}
            placeholder="Categoría"
          />
          
          <Dropdown
            label="Distancia"
            options={DISTANCES}
            selectedValue={selectedDistance}
            onSelect={setSelectedDistance}
            placeholder="Distancia"
          />
          
          <Dropdown
            label="Ordenar por"
            options={RATINGS}
            selectedValue={selectedRating}
            onSelect={setSelectedRating}
            placeholder="Ordenar"
          />
        </ScrollView>
      </View>
  
      {/* 🔽 Resultados */}
      <View style={styles.resultsContainer}>
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
              {searchQuery ? 'Intenta con otros términos de búsqueda' : 'No hay bares disponibles en tu área'}
            </Text>
          </View>
        )}
      </View>

      <BottomTabBar />
    </SafeAreaView>
  );
  
  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1b2c',
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  filtersScrollContent: {
    paddingRight: 20,
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
    paddingBottom: 20,
  },
  barCard: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  barImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
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
});