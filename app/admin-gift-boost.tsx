import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '~/utils/supabase';
import {
  AppText,
  AppCard,
  EmptyState,
  colors,
  spacing,
  radius,
} from '~/components/ds';
import { useIsAdmin } from '~/hooks/useIsAdmin';
import { useTestBarsVisibilityStore } from '~/stores/testBarsVisibilityStore';
import { TestBarsFlagButton } from '~/components/admin/TestBarsFlagButton';

interface Bar {
  id: string;
  name: string;
  address: string;
  city: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  has_active_boost?: boolean;
  is_test?: boolean;
}

export default function AdminGiftBoostScreen() {
  const router = useRouter();
  const { isAdmin } = useIsAdmin();
  const showTestBars = useTestBarsVisibilityStore((state) => state.showTestBars);
  const includeTestBars = isAdmin && showTestBars;
  const [bars, setBars] = useState<Bar[]>([]);
  const [filteredBars, setFilteredBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    } catch (error) {
      console.error('❌ Error getting user location:', error);
    }
  }, []);

  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    []
  );

  const loadBars = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('bars')
        .select(
          'id, name, address, city, latitude, longitude, is_test, bar_images(image_url, image_order), bar_boosts(id, status, end_at)'
        )
        .order('name');

      if (error) {
        console.error('❌ Error loading bars:', error);
        return;
      }

      let barsWithData = (data || []).map((bar: any) => ({
        ...bar,
        image_url: bar.bar_images?.[0]?.image_url || null,
        has_active_boost: bar.bar_boosts?.some(
          (b: any) => b.status === 'active' && b.end_at > now
        ),
      }));

      if (userLocation?.coords) {
        barsWithData = barsWithData.map((bar) => {
          if (bar.latitude && bar.longitude) {
            const distance = calculateDistance(
              userLocation.coords.latitude,
              userLocation.coords.longitude,
              bar.latitude,
              bar.longitude
            );
            return { ...bar, distance_km: distance };
          }
          return bar;
        });

        barsWithData.sort((a, b) => {
          if (!a.distance_km) return 1;
          if (!b.distance_km) return -1;
          return a.distance_km - b.distance_km;
        });
      }

      setBars(barsWithData);
    } catch (error) {
      console.error('❌ Error in loadBars:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, calculateDistance]);

  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      const next = !open;
      if (!next) setSearchText('');
      return next;
    });
  }, []);

  const handleBarPress = useCallback(
    (barId: string) => {
      router.push(`/admin-gift-boost/${barId}` as any);
    },
    [router]
  );

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  useEffect(() => {
    loadBars();
  }, [loadBars]);

  // Recalculate visible bars when the source list, search text or test-bars visibility changes
  useEffect(() => {
    let result = includeTestBars ? bars : bars.filter((bar) => !bar.is_test);

    if (searchText.trim()) {
      const text = searchText.toLowerCase();
      result = result.filter(
        (bar) =>
          bar.name.toLowerCase().includes(text) ||
          bar.city.toLowerCase().includes(text)
      );
    }

    setFilteredBars(result);
  }, [bars, searchText, includeTestBars]);

  const renderBarCard = useCallback(
    ({ item }: { item: Bar }) => (
      <AppCard style={styles.barCard} onPress={() => handleBarPress(item.id)}>
        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.barImage} />
        )}
        <View style={styles.barInfo}>
          <View style={styles.barHeader}>
            <AppText variant="subtitle" style={styles.barName}>
              {item.name}
            </AppText>
            {item.has_active_boost && (
              <View style={styles.boostBadge}>
                <Ionicons name="flash" size={12} color={colors.status.boost} />
                <AppText
                  variant="caption"
                  color={colors.status.boost}
                  style={styles.boostBadgeText}>
                  Boost activo
                </AppText>
              </View>
            )}
          </View>
          <AppText variant="caption" color={colors.text.secondary}>
            {item.address}, {item.city}
          </AppText>
          {item.distance_km !== undefined && (
            <View style={styles.distanceContainer}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.status.success}
              />
              <AppText
                variant="caption"
                color={colors.status.success}
                style={styles.distanceText}>
                {item.distance_km.toFixed(1)} km
              </AppText>
            </View>
          )}
        </View>
      </AppCard>
    ),
    [handleBarPress]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title">Regalar Boost</AppText>
          <View style={styles.headerActions}>
            {isAdmin && <TestBarsFlagButton />}
            <TouchableOpacity onPress={handleToggleSearch} style={styles.headerIconButton}>
              <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <AppText
            variant="body"
            color={colors.text.secondary}
            style={{ marginTop: spacing.lg }}>
            Cargando bares...
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">Regalar Boost</AppText>
        <View style={styles.headerActions}>
          {isAdmin && <TestBarsFlagButton />}
          <TouchableOpacity onPress={handleToggleSearch} style={styles.headerIconButton}>
            <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {searchOpen && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons
              name="search"
              size={20}
              color={colors.text.muted}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre o ciudad..."
              placeholderTextColor={colors.text.muted}
              value={searchText}
              onChangeText={handleSearchTextChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchTextChange('')}
                style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoContainer}>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={colors.text.muted}
        />
        <AppText
          variant="caption"
          color={colors.text.muted}
          style={{ marginLeft: spacing.xs }}>
          {filteredBars.length} bar{filteredBars.length !== 1 ? 'es' : ''}
          {userLocation ? ' · Ordenados por proximidad' : ''}
        </AppText>
      </View>

      {/* Bars List */}
      <View style={styles.content}>
        {filteredBars.length > 0 ? (
          <FlatList
            data={filteredBars}
            renderItem={renderBarCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.barsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="search-outline"
              title="No se encontraron bares"
              subtitle={
                searchText
                  ? `No hay bares que coincidan con "${searchText}"`
                  : 'No hay bares registrados'
              }
              actionLabel={searchText ? 'Limpiar búsqueda' : undefined}
              onAction={searchText ? () => handleSearchTextChange('') : undefined}
            />
          </View>
        )}
      </View>
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
  backButton: {
    padding: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.element,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
  },
  searchIcon: {
    marginRight: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
  },
  barsList: {
    paddingBottom: spacing.xxl,
  },
  barCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  barImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  barInfo: {
    padding: spacing.lg,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  barName: {
    flex: 1,
    marginRight: spacing.sm,
  },
  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    gap: spacing.xxs,
  },
  boostBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  distanceText: {
    marginLeft: spacing.xs,
  },
});
