import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import BottomTabBar from '~/components/ui/BottomTabBar';
import { useFavorites } from '~/hooks/useFavorites';
import {
  AppText,
  AppCard,
  AppChip,
  AppInput,
  AppButton,
  EmptyState,
  SkeletonCard,
  colors,
  spacing,
  radius,
} from '~/components/ds';

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

// Component for individual favorite bar card
interface FavoriteBarCardProps {
  bar: FavoriteBar;
  userLocation: Location.LocationObject | null;
  onPress: (barId: string) => void;
  onRemove: (barId: string, barName: string) => void;
  onViewOnMap: (bar: FavoriteBar) => void;
}

function FavoriteBarCard({ bar, userLocation, onPress, onRemove, onViewOnMap }: FavoriteBarCardProps) {
  // Calculate distance if user location is available
  let distance: number | null = null;
  if (userLocation && userLocation.coords && bar.latitude && bar.longitude) {
    const R = 6371; // Earth's radius in kilometers
    const lat1 = userLocation.coords.latitude;
    const lon1 = userLocation.coords.longitude;
    const lat2 = bar.latitude;
    const lon2 = bar.longitude;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    distance = R * c;
  }

  return (
    <AppCard style={styles.barCard}>
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => onPress(bar.id)}
        activeOpacity={0.9}
      >
        <Image
          source={{
            uri: bar.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar'
          }}
          style={styles.barImage}
        />
      </TouchableOpacity>

      <View style={styles.barInfo}>
        <View style={styles.barHeader}>
          <View style={styles.barTextContainer}>
            <AppText variant="subtitle" style={styles.barNameSpacing}>{bar.name}</AppText>
            {bar.description && (
              <AppText variant="body" color={colors.text.secondary} style={styles.barDescriptionSpacing}>
                {bar.description}
              </AppText>
            )}
            <AppText variant="caption" color={colors.text.secondary}>
              {bar.address}, {bar.city}
            </AppText>

            {/* Rating and Distance Info */}
            <View style={styles.barDetails}>
              {typeof bar.rating === 'number' && (
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color={colors.status.boost} />
                  <AppText variant="caption" color={colors.status.boost} style={styles.ratingTextSpacing}>
                    {bar.rating.toFixed(1)}
                  </AppText>
                  {typeof bar.review_count === 'number' && (
                    <AppText variant="caption" color={colors.text.muted} style={styles.reviewCountSpacing}>
                      ({bar.review_count} reseñas)
                    </AppText>
                  )}
                </View>
              )}

              {distance !== null && (
                <View style={styles.distanceContainer}>
                  <Ionicons name="location-outline" size={14} color={colors.status.success} />
                  <AppText variant="caption" color={colors.status.success} style={styles.distanceTextSpacing}>
                    {distance.toFixed(1)} km
                  </AppText>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(bar.id, bar.name)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={colors.status.destructive} />
          </TouchableOpacity>
        </View>

        {/* View on Map Button */}
        <TouchableOpacity
          style={styles.viewOnMapButton}
          onPress={() => onViewOnMap(bar)}
          activeOpacity={0.7}
        >
          <Ionicons name="map-outline" size={16} color={colors.brand.link} />
          <AppText variant="label" color={colors.brand.link} style={styles.viewOnMapTextSpacing}>
            Ver en el Mapa
          </AppText>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
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

  // Handle view on map
  const handleViewOnMap = useCallback((bar: FavoriteBar) => {
    router.push({
      pathname: '/(protected)/map',
      params: {
        selectedBarId: bar.id,
        selectedBarLat: bar.latitude,
        selectedBarLng: bar.longitude,
        selectedBarName: bar.name,
      },
    });
  }, [router]);

  // Render favorite bar card
  const renderFavoriteBar = useCallback(({ item }: { item: FavoriteBar }) => {
    return (
      <FavoriteBarCard
        bar={item}
        userLocation={userLocation}
        onPress={handleBarPress}
        onRemove={handleRemoveFromFavorites}
        onViewOnMap={handleViewOnMap}
      />
    );
  }, [handleBarPress, handleRemoveFromFavorites, handleViewOnMap, userLocation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <AppText variant="title">Favoritos</AppText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
        <BottomTabBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <AppText variant="title">Favoritos</AppText>
        <TouchableOpacity style={styles.searchButton} onPress={toggleSearch} activeOpacity={0.7}>
          <Ionicons name="search" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <AppInput
            placeholder="Buscar bares..."
            value={searchText}
            onChangeText={handleSearchTextChange}
            autoFocus={true}
          />
        </View>
      )}

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortScrollContent}
        >
          <AppChip
            label="Recomendados"
            selected={activeFilter === 'recommended'}
            onPress={() => setActiveFilter('recommended')}
          />
          <AppChip
            label="Cercanos"
            selected={activeFilter === 'nearby'}
            onPress={() => setActiveFilter('nearby')}
          />
          <AppChip
            label="Mejor valorado"
            selected={activeFilter === 'top_rated'}
            onPress={() => setActiveFilter('top_rated')}
          />
        </ScrollView>
      </View>

      {/* Favorite Bars List */}
      <View style={styles.content}>
        {filteredBars.length > 0 ? (
          <FlatList
            data={filteredBars}
            renderItem={renderFavoriteBar}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.barsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            {searchText.length > 0 ? (
              <EmptyState
                icon="search-outline"
                title="No se encontraron resultados"
                subtitle={`No hay bares favoritos que coincidan con "${searchText}"`}
                actionLabel="Limpiar búsqueda"
                onAction={() => handleSearchTextChange('')}
              />
            ) : (
              <EmptyState
                icon="heart-outline"
                title="No tienes favoritos"
                subtitle="Explora bares y añádelos a tus favoritos para verlos aquí"
                actionLabel="Explorar Bares"
                onAction={() => router.push('/search' as any)}
              />
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
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  searchButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  sortContainer: {
    paddingBottom: spacing.lg,
  },
  sortScrollContent: {
    paddingHorizontal: spacing.xl,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
  },
  barsList: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  barCard: {
    marginBottom: spacing.lg,
  },
  imageContainer: {
    width: '100%',
    height: 200,
  },
  barImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  barInfo: {
    padding: spacing.lg,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  barTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  barNameSpacing: {
    marginBottom: spacing.xs,
  },
  barDescriptionSpacing: {
    marginBottom: spacing.xs,
  },
  barDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingTextSpacing: {
    marginLeft: spacing.xs,
  },
  reviewCountSpacing: {
    marginLeft: spacing.xs,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceTextSpacing: {
    marginLeft: spacing.xs,
  },
  removeButton: {
    padding: spacing.sm,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: radius.md,
  },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.alpha.brandLight,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.alpha.brandBorder,
    marginTop: spacing.md,
  },
  viewOnMapTextSpacing: {
    marginLeft: spacing.xs,
  },
}); 