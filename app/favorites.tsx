import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  Dimensions,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import BottomTabBar from '~/components/ui/BottomTabBar';
import AdBanner from '~/components/AdBanner';
import { useUserSubscription } from '~/hooks/useUserSubscription';
import { supabase } from '~/utils/supabase';
import { useFavorites } from '~/hooks/useFavorites';

interface FavoriteBar {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  review_count?: number;
}

const { width } = Dimensions.get('window');

export default function FavoritesScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { hasActiveSubscription, planType } = useUserSubscription(userId);
  const adFree = !!(hasActiveSubscription && (planType?.includes('pro') || planType?.includes('elite')));
  const { getFavoriteBars, removeFromFavorites } = useFavorites();
  
  const [favoriteBars, setFavoriteBars] = useState<FavoriteBar[]>([]);
  const [filteredBars, setFilteredBars] = useState<FavoriteBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [activeFilter, setActiveFilter] = useState<'recommended' | 'nearby' | 'top_rated'>('recommended');

  // Get user location
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('📍 Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
      console.log('📍 User location obtained:', location.coords);
    } catch (error) {
      console.error('❌ Error getting user location:', error);
    }
  }, []);

  // Calculate distance between two points
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  }, []);

  // Load favorite bars
  const loadFavoriteBars = useCallback(async () => {
    setLoading(true);
    try {
      const bars = await getFavoriteBars();
      setFavoriteBars(bars as unknown as FavoriteBar[]);
      setFilteredBars(bars as unknown as FavoriteBar[]);
    } catch (error) {
      console.error('❌ Error loading favorite bars:', error);
    } finally {
      setLoading(false);
    }
  }, [getFavoriteBars]);

  // Filter bars based on search text
  const filterBars = useCallback((text: string) => {
    if (!text.trim()) {
      setFilteredBars(favoriteBars);
      return;
    }
    
    const filtered = favoriteBars.filter(bar => 
      bar.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredBars(filtered);
  }, [favoriteBars]);

  // Handle search text change
  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  // Toggle search visibility
  const toggleSearch = useCallback(() => {
    setSearchVisible(!searchVisible);
    if (searchVisible) {
      setSearchText('');
    }
  }, [searchVisible]);

  // Load favorites and user location on mount
  useEffect(() => {
    loadFavoriteBars();
    getUserLocation();
  }, [loadFavoriteBars, getUserLocation]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    })();
  }, []);

  // Handle bar press
  const handleBarPress = useCallback((barId: string) => {
    router.push(`/bar-profile/${barId}` as any);
  }, [router]);

  // Handle remove from favorites
  const handleRemoveFromFavorites = useCallback(async (barId: string, barName: string) => {
    Alert.alert(
      'Eliminar de favoritos',
      `¿Estás seguro de que quieres eliminar "${barName}" de tus favoritos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const success = await removeFromFavorites(barId);
            if (success) {
              // Remove from local state
              setFavoriteBars(prev => prev.filter(bar => bar.id !== barId));
              setFilteredBars(prev => prev.filter(bar => bar.id !== barId));
              console.log('🗑️ Removed from favorites:', barName);
            } else {
              Alert.alert('Error', 'No se pudo eliminar de favoritos');
            }
          },
        },
      ]
    );
  }, [removeFromFavorites]);

  // Apply filters and sorting
  const applyFilters = useCallback(() => {
    let currentBars = [...favoriteBars];

    // Apply search filter first
    if (searchText.trim()) {
      const lowerCaseSearchText = searchText.toLowerCase();
      currentBars = currentBars.filter(bar =>
        bar.name.toLowerCase().includes(lowerCaseSearchText)
      );
    }

    // Apply active filter/sort
    switch (activeFilter) {
      case 'recommended':
        // For now, 'recommended' just means no specific sorting beyond search
        // In a real app, this would involve a recommendation algorithm
        break;
      case 'nearby':
        if (userLocation && userLocation.coords) {
          // Sort by distance (closest first)
          currentBars.sort((a, b) => {
            if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) {
              return 0; // Keep original order if location data is missing
            }
            
            const distanceA = calculateDistance(
              userLocation.coords.latitude,
              userLocation.coords.longitude,
              a.latitude,
              a.longitude
            );
            const distanceB = calculateDistance(
              userLocation.coords.latitude,
              userLocation.coords.longitude,
              b.latitude,
              b.longitude
            );
            
            return distanceA - distanceB; // Ascending order (closest first)
          });
        } else {
          console.log('📍 Cannot sort by nearby - no user location available');
        }
        break;
      case 'top_rated':
        // Sort by rating (descending - highest first)
        currentBars.sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA; // Descending order (highest first)
        });
        break;
      default:
        break;
    }

    setFilteredBars(currentBars);
  }, [favoriteBars, searchText, activeFilter, userLocation, calculateDistance]);

  // Apply filters when dependencies change
  useEffect(() => {
    applyFilters();
  }, [favoriteBars, searchText, activeFilter, userLocation, applyFilters]);

  // Render favorite bar card
  const renderFavoriteBar = useCallback(({ item }: { item: FavoriteBar }) => {
    // Calculate distance if user location is available
    let distance: number | null = null;
    if (userLocation && userLocation.coords && item.latitude && item.longitude) {
      distance = calculateDistance(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        item.latitude,
        item.longitude
      );
    }

    return (
      <View style={styles.barCard}>
        <TouchableOpacity 
          style={styles.imageContainer}
          onPress={() => handleBarPress(item.id)}
        >
          <Image
            source={{
              uri: item.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar'
            }}
            style={styles.barImage}
          />
        </TouchableOpacity>

        <View style={styles.barInfo}>
          <View style={styles.barHeader}>
            <View style={styles.barTextContainer}>
              <Text style={styles.barName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.barDescription}>{item.description}</Text>
              )}
              <Text style={styles.barAddress}>{item.address}, {item.city}</Text>
              
              {/* Rating and Distance Info */}
              <View style={styles.barDetails}>
                {typeof item.rating === 'number' && (
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    {typeof item.review_count === 'number' && (
                      <Text style={styles.reviewCountText}>
                        ({item.review_count} reseñas)
                      </Text>
                    )}
                  </View>
                )}
                
                {distance !== null && (
                  <View style={styles.distanceContainer}>
                    <Ionicons name="location-outline" size={14} color="#4CAF50" />
                    <Text style={styles.distanceText}>{distance.toFixed(1)} km</Text>
                  </View>
                )}
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => handleRemoveFromFavorites(item.id, item.name)}
            >
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [handleBarPress, handleRemoveFromFavorites, userLocation, calculateDistance]);

  // Interleave an AdBanner after every 2 bars
  type FeedItem = { type: 'bar'; bar: FavoriteBar } | { type: 'ad'; id: string };
  const feedItems: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];
    filteredBars.forEach((bar, index) => {
      items.push({ type: 'bar', bar });
      if (!adFree && (index + 1) % 2 === 0) {
        items.push({ type: 'ad', id: `ad-${index}` });
      }
    });
    return items;
  }, [filteredBars, adFree]);

  const renderFeedItem = useCallback(({ item }: { item: FeedItem }) => {
    if (item.type === 'ad') {
      return (
        <View style={styles.adCard}>
          <AdBanner />
        </View>
      );
    }
    return renderFavoriteBar({ item: item.bar });
  }, [renderFavoriteBar]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando favoritos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
  
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favoritos</Text>
        <TouchableOpacity style={styles.searchButton} onPress={toggleSearch}>
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#A3B3CC" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar bares..."
              placeholderTextColor="#A3B3CC"
              value={searchText}
              onChangeText={handleSearchTextChange}
              autoFocus={true}
            />
            {searchText.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => handleSearchTextChange('')}
              >
                <Ionicons name="close-circle" size={20} color="#A3B3CC" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.sortButton, activeFilter === 'recommended' && styles.sortButtonActive]}
            onPress={() => setActiveFilter('recommended')}
          >
            <Text style={styles.sortButtonText}>Recomendados</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortButton, activeFilter === 'nearby' && styles.sortButtonActive]}
            onPress={() => setActiveFilter('nearby')}
          >
            <Text style={styles.sortButtonText}>Cercanos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortButton, activeFilter === 'top_rated' && styles.sortButtonActive]}
            onPress={() => setActiveFilter('top_rated')}
          >
            <Text style={styles.sortButtonText}>Mejor valorado</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Favorite Bars List */}
      <View style={styles.content}>
        {feedItems.length > 0 ? (
          <FlatList
            data={feedItems}
            renderItem={renderFeedItem}
            keyExtractor={(item, idx) => item.type === 'ad' ? `${item.id}-${idx}` : item.bar.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.barsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            {searchText.length > 0 ? (
              <>
                <Ionicons name="search-outline" size={64} color="#A3B3CC" />
                <Text style={styles.emptyTitle}>No se encontraron resultados</Text>
                <Text style={styles.emptySubtitle}>
                  No hay bares favoritos que coincidan con "{searchText}"
                </Text>
                <TouchableOpacity 
                  style={styles.exploreButton}
                  onPress={() => handleSearchTextChange('')}
                >
                  <Text style={styles.exploreButtonText}>Limpiar búsqueda</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="heart-outline" size={64} color="#A3B3CC" />
                <Text style={styles.emptyTitle}>No tienes favoritos</Text>
                <Text style={styles.emptySubtitle}>
                  Explora bares y añádelos a tus favoritos para verlos aquí
                </Text>
                <TouchableOpacity 
                  style={styles.exploreButton}
                  onPress={() => router.push('/search' as any)}
                >
                  <Text style={styles.exploreButtonText}>Explorar Bares</Text>
                </TouchableOpacity>
              </>
            )}
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
    backgroundColor: '#1C2A3A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2332',
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
  clearButton: {
    padding: 4,
  },
  sortContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sortButton: {
    backgroundColor: '#2A3A4A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  sortButtonActive: {
    backgroundColor: '#1976D2',
  },
  sortButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
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
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  barsList: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Space for footer
  },
  adCard: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignItems: 'center',
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
  barInfo: {
    padding: 16,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  barTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  barDescription: {
    color: '#A3B3CC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  barAddress: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  barDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  reviewCountText: {
    color: '#A3B3CC',
    fontSize: 10,
    marginLeft: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  removeButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
  },
}); 