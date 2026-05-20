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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import { useFavoritesStore } from '~/stores/favoritesStore';
import {
  AppText,
  AppCard,
  AppChip,
  EmptyState,
  SkeletonCard,
  toast,
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

interface FavoriteBarCardProps {
  bar: FavoriteBar;
  userLocation: Location.LocationObject | null;
  onPress: (barId: string) => void;
  onRemove: (barId: string, barName: string) => void;
  onViewOnMap: (bar: FavoriteBar) => void;
}

function FavoriteBarCard({ bar, userLocation, onPress, onRemove, onViewOnMap }: FavoriteBarCardProps) {
  let distance: number | null = null;
  if (userLocation?.coords && bar.latitude && bar.longitude) {
    const R = 6371;
    const lat1 = userLocation.coords.latitude;
    const lon1 = userLocation.coords.longitude;
    const dLat = (bar.latitude - lat1) * Math.PI / 180;
    const dLon = (bar.longitude - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(bar.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return (
    <AppCard style={styles.barCard}>
      <TouchableOpacity style={styles.imageContainer} onPress={() => onPress(bar.id)} activeOpacity={0.9}>
        <Image
          source={{ uri: bar.image_url || 'https://via.placeholder.com/300x200/2A3A4A/A3B3CC?text=Bar' }}
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
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={colors.text.muted} />
              <AppText variant="caption" color={colors.text.secondary} style={styles.addressText}>
                {bar.address}, {bar.city}
              </AppText>
            </View>
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

        <TouchableOpacity style={styles.viewOnMapButton} onPress={() => onViewOnMap(bar)} activeOpacity={0.7}>
          <Ionicons name="map-outline" size={13} color={colors.brand.link} />
          <AppText variant="caption" color={colors.brand.link}>Ver en el Mapa</AppText>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
}

export default function MyFavoritesScreen() {
  const router = useRouter();
  const getFavoriteBars = useFavoritesStore(state => state.getFavoriteBars);
  const removeFavorite = useFavoritesStore(state => state.removeFavorite);
  const favorites = useFavoritesStore(state => state.favorites);

  const [favoriteBars, setFavoriteBars] = useState<FavoriteBar[]>([]);
  const [filteredBars, setFilteredBars] = useState<FavoriteBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [activeFilter, setActiveFilter] = useState<'recommended' | 'nearby' | 'top_rated'>('recommended');

  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    } catch {}
  }, []);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const loadFavoriteBars = useCallback(async () => {
    setLoading(true);
    try {
      const bars = await getFavoriteBars();
      setFavoriteBars(bars as unknown as FavoriteBar[]);
      setFilteredBars(bars as unknown as FavoriteBar[]);
    } catch {}
    finally { setLoading(false); }
  }, [getFavoriteBars]);

  const applyFilters = useCallback(() => {
    let current = [...favoriteBars];
    if (searchText.trim()) {
      current = current.filter(b => b.name.toLowerCase().includes(searchText.toLowerCase()));
    }
    if (activeFilter === 'nearby' && userLocation?.coords) {
      current.sort((a, b) => {
        if (!a.latitude || !b.latitude) return 0;
        return calculateDistance(userLocation.coords.latitude, userLocation.coords.longitude, a.latitude, a.longitude!) -
          calculateDistance(userLocation.coords.latitude, userLocation.coords.longitude, b.latitude, b.longitude!);
      });
    } else if (activeFilter === 'top_rated') {
      current.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    setFilteredBars(current);
  }, [favoriteBars, searchText, activeFilter, userLocation, calculateDistance]);

  useEffect(() => { loadFavoriteBars(); getUserLocation(); }, [loadFavoriteBars, getUserLocation]);
  useEffect(() => { loadFavoriteBars(); }, [favorites, loadFavoriteBars]);
  useEffect(() => { applyFilters(); }, [applyFilters]);

  const handleBarPress = useCallback((barId: string) => {
    router.push(`/bar-profile/${barId}` as any);
  }, [router]);

  const handleRemove = useCallback(async (barId: string, barName: string) => {
    Alert.alert('Eliminar de favoritos', `¿Eliminar "${barName}" de tus favoritos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const ok = await removeFavorite(barId);
          ok ? toast.success('Eliminado de favoritos') : toast.error('No se pudo eliminar');
        },
      },
    ]);
  }, [removeFavorite]);

  const handleViewOnMap = useCallback((bar: FavoriteBar) => {
    router.push({ pathname: '/(protected)/map', params: { selectedBarId: bar.id, selectedBarLat: bar.latitude, selectedBarLng: bar.longitude, selectedBarName: bar.name } });
  }, [router]);

  const renderBar = useCallback(({ item }: { item: FavoriteBar }) => (
    <FavoriteBarCard
      bar={item}
      userLocation={userLocation}
      onPress={handleBarPress}
      onRemove={handleRemove}
      onViewOnMap={handleViewOnMap}
    />
  ), [handleBarPress, handleRemove, handleViewOnMap, userLocation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title">Mis Favoritos</AppText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">Mis Favoritos</AppText>
        <TouchableOpacity style={styles.searchButton} onPress={() => setSearchVisible(v => !v)} activeOpacity={0.7}>
          <Ionicons name="search" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {searchVisible && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color={colors.text.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar bares..."
              placeholderTextColor={colors.text.muted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.sortContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScrollContent}>
          <AppChip label="Recomendados" selected={activeFilter === 'recommended'} onPress={() => setActiveFilter('recommended')} />
          <AppChip label="Cercanos" selected={activeFilter === 'nearby'} onPress={() => setActiveFilter('nearby')} />
          <AppChip label="Mejor valorado" selected={activeFilter === 'top_rated'} onPress={() => setActiveFilter('top_rated')} />
        </ScrollView>
      </View>

      <View style={styles.content}>
        {filteredBars.length > 0 ? (
          <FlatList
            data={filteredBars}
            renderItem={renderBar}
            keyExtractor={item => item.id}
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
                onAction={() => setSearchText('')}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backButton: { padding: spacing.xs },
  searchButton: { padding: spacing.xs },
  searchContainer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.element,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
  },
  searchIcon: { marginRight: spacing.md },
  searchInput: { flex: 1, fontSize: 16, color: colors.text.primary, paddingVertical: 0 },
  clearButton: { marginLeft: spacing.sm, padding: spacing.xs },
  sortContainer: { paddingBottom: spacing.lg },
  sortScrollContent: { paddingHorizontal: spacing.xl },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  emptyContainer: { flex: 1 },
  barsList: { paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  barCard: { marginBottom: spacing.lg },
  imageContainer: { width: '100%', height: 200 },
  barImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  barInfo: { padding: spacing.lg },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  barTextContainer: { flex: 1, marginRight: spacing.md },
  barNameSpacing: { marginBottom: spacing.xs },
  barDescriptionSpacing: { marginBottom: spacing.xs },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  addressText: { flex: 1 },
  barDetails: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap', gap: spacing.lg },
  ratingContainer: { flexDirection: 'row', alignItems: 'center' },
  ratingTextSpacing: { marginLeft: spacing.xs },
  reviewCountSpacing: { marginLeft: spacing.xs },
  distanceContainer: { flexDirection: 'row', alignItems: 'center' },
  distanceTextSpacing: { marginLeft: spacing.xs },
  removeButton: { padding: spacing.sm, backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: radius.md },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.alpha.brandLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.alpha.brandBorder,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
});
