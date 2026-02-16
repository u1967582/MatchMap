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

interface Bar {
  id: string;
  name: string;
  address: string;
  city: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  verification_status?: string;
}

export default function AdminSelectBarAutoBroadcastsScreen() {
  const router = useRouter();
  const [bars, setBars] = useState<Bar[]>([]);
  const [filteredBars, setFilteredBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

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
      console.log('📍 User location obtained');
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
    return R * c;
  }, []);

  // Load all bars
  const loadBars = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bars')
        .select('id, name, address, city, image_url, latitude, longitude, verification_status')
        .order('name');

      if (error) {
        console.error('❌ Error loading bars:', error);
        return;
      }

      let barsWithDistance = data || [];

      // Add distance if user location is available
      if (userLocation && userLocation.coords) {
        barsWithDistance = barsWithDistance.map(bar => {
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

        // Sort by distance (closest first)
        barsWithDistance.sort((a, b) => {
          if (!a.distance_km) return 1;
          if (!b.distance_km) return -1;
          return a.distance_km - b.distance_km;
        });
      }

      setBars(barsWithDistance);
      setFilteredBars(barsWithDistance);
      console.log('✅ Loaded', barsWithDistance.length, 'bars');
    } catch (error) {
      console.error('❌ Error in loadBars:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, calculateDistance]);

  // Filter bars based on search text
  const filterBars = useCallback((text: string) => {
    if (!text.trim()) {
      setFilteredBars(bars);
      return;
    }

    const filtered = bars.filter(bar =>
      bar.name.toLowerCase().includes(text.toLowerCase()) ||
      bar.city.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredBars(filtered);
  }, [bars]);

  // Handle search text change
  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text);
    filterBars(text);
  }, [filterBars]);

  // Handle bar selection
  const handleBarPress = useCallback((barId: string) => {
    router.push(`/auto-broadcasts/${barId}` as any);
  }, [router]);

  // Load data on mount
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  useEffect(() => {
    loadBars();
  }, [loadBars]);

  // Render bar card
  const renderBarCard = useCallback(({ item }: { item: Bar }) => {
    const isPending = item.verification_status === 'pending';
    const isRejected = item.verification_status === 'rejected';

    return (
      <AppCard style={styles.barCard} onPress={() => handleBarPress(item.id)}>
        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={styles.barImage}
          />
        )}
        <View style={styles.barInfo}>
          <View style={styles.barHeader}>
            <AppText variant="subtitle" style={styles.barName}>{item.name}</AppText>
            {isPending && (
              <View style={styles.statusBadge}>
                <AppText variant="caption" color={colors.status.warning} style={styles.statusText}>
                  Pendiente
                </AppText>
              </View>
            )}
            {isRejected && (
              <View style={[styles.statusBadge, styles.statusBadgeRejected]}>
                <AppText variant="caption" color={colors.status.error} style={styles.statusText}>
                  Rechazado
                </AppText>
              </View>
            )}
          </View>
          <AppText variant="caption" color={colors.text.secondary}>
            {item.address}, {item.city}
          </AppText>
          {item.distance_km !== undefined && (
            <View style={styles.distanceContainer}>
              <Ionicons name="location-outline" size={14} color={colors.status.success} />
              <AppText variant="caption" color={colors.status.success} style={styles.distanceText}>
                {item.distance_km.toFixed(1)} km
              </AppText>
            </View>
          )}
        </View>
      </AppCard>
    );
  }, [handleBarPress]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title">Seleccionar Bar</AppText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <AppText variant="body" color={colors.text.secondary} style={{ marginTop: spacing.lg }}>
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
        <AppText variant="title">Seleccionar Bar</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={colors.text.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o ciudad..."
            placeholderTextColor={colors.text.muted}
            value={searchText}
            onChangeText={handleSearchTextChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchTextChange('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
        <AppText variant="caption" color={colors.text.muted} style={{ marginLeft: spacing.xs }}>
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
              subtitle={searchText ? `No hay bares que coincidan con "${searchText}"` : 'No hay bares registrados'}
              actionLabel={searchText ? "Limpiar búsqueda" : undefined}
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
  statusBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  statusBadgeRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusText: {
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
