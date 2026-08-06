import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import { useFavoritesStore } from '~/stores/favoritesStore';
import BottomTabBar from '~/components/ui/BottomTabBar';
import AdBanner from '~/components/ads/AdBanner';
import { interleaveWithAds } from '~/utils/adListInterleave';
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

  const handleRemove = (e: any) => {
    e.stopPropagation();
    onRemove(bar.id, bar.name);
  };

  const handleViewOnMap = (e: any) => {
    e.stopPropagation();
    onViewOnMap(bar);
  };

  return (
    <AppCard onPress={() => onPress(bar.id)}>
      <View style={styles.imageContainer}>
        {bar.image_url ? (
          <Image
            source={{ uri: bar.image_url }}
            style={[styles.barImage, { backgroundColor: '#1A2332' }]}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={bar.id}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="image-outline" size={32} color={colors.text.muted} />
            <AppText variant="caption" color={colors.text.muted}>
              Sin imagen
            </AppText>
          </View>
        )}

        <TouchableOpacity style={styles.favoritesButton} onPress={handleRemove}>
          <Ionicons name="heart" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.barInfo}>
        <AppText variant="title" style={styles.barName}>{bar.name}</AppText>

        <View style={styles.barMeta}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color={colors.status.warning} />
            <AppText variant="body">
              {(typeof bar.rating === 'number' ? bar.rating.toFixed(1) : 'N/A')} ({bar.review_count || 0} reseñas)
            </AppText>
          </View>

          {distance !== null && (
            <AppText variant="body" color={colors.brand.accent} style={styles.distanceText}>
              {distance.toFixed(1)} km
            </AppText>
          )}
        </View>

        {bar.address && bar.city && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={colors.text.muted} />
            <AppText variant="caption" color={colors.text.secondary} style={styles.barAddress}>
              {bar.address}, {bar.city}
            </AppText>
          </View>
        )}

        <TouchableOpacity style={styles.viewOnMapButton} onPress={handleViewOnMap}>
          <Ionicons name="map-outline" size={16} color={colors.brand.link} />
          <AppText variant="label" color={colors.brand.link}>Ver en el Mapa</AppText>
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

  const listRows = useMemo(
    () => interleaveWithAds(filteredBars, (bar) => bar.id, 3),
    [filteredBars]
  );

  const renderRow = useCallback(({ item }: { item: (typeof listRows)[number] }) => {
    if (item.kind === 'ad') {
      return <AdBanner placement="favorites-inline" />;
    }
    return renderBar({ item: item.data });
  }, [renderBar]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={18} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title">Mis Favoritos</AppText>
          <View style={{ width: 36 }} />
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

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">Mis Favoritos</AppText>
        <TouchableOpacity style={styles.searchButton} onPress={() => setSearchVisible(v => !v)} activeOpacity={0.7}>
          <Ionicons name="search" size={18} color={colors.text.primary} />
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
            data={listRows}
            renderItem={renderRow}
            keyExtractor={row => row.key}
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

      <BottomTabBar />
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.element,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.element,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  barsList: { paddingBottom: Platform.OS === 'ios' ? 100 : 80 },
  imageContainer: { position: 'relative', width: '100%', height: 180 },
  barImage: { width: '100%', height: '100%' },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  favoritesButton: {
    position: 'absolute',
    top: spacing.lg - 6,
    right: spacing.lg - 6,
    backgroundColor: colors.status.error,
    borderRadius: radius.round,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  barInfo: { padding: spacing.lg },
  barName: { marginBottom: spacing.sm },
  barMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  distanceText: { fontWeight: '500' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  barAddress: { flex: 1 },
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
});
