import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '~/utils/supabase';
import BottomTabBar from '~/components/ui/BottomTabBar';
import {
  AppText,
  AppChip,
  EmptyState,
  SkeletonBox,
  colors,
  spacing,
  radius,
  shadows,
} from '~/components/ds';
import { useScarves, type UserScarf, type ScarveRarity } from '~/hooks/useScarves';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const RARITY_LABELS: Record<ScarveRarity, string> = {
  common: 'Común',
  rare: 'Rara',
  legendary: 'Legendaria',
};

const RARITY_COLORS: Record<ScarveRarity, string> = {
  common: colors.text.muted,
  rare: colors.status.boost,
  legendary: colors.status.success,
};

const RARITY_BG: Record<ScarveRarity, string> = {
  common: 'rgba(142,142,147,0.12)',
  rare: 'rgba(255,215,0,0.12)',
  legendary: 'rgba(16,185,129,0.12)',
};

type RarityFilter = 'all' | ScarveRarity;

// ─── Tarjeta de bufanda ──────────────────────────────────────────────────────

interface ScarfCardProps {
  scarf: UserScarf;
}

function ScarfCard({ scarf }: ScarfCardProps) {
  const rarityColor = RARITY_COLORS[scarf.rarity];
  const rarityBg = RARITY_BG[scarf.rarity];

  const logoUrl =
    scarf.team.logo_url ||
    `${SUPABASE_URL}/storage/v1/object/public/logo_teams/${scarf.team.id}.png`;

  const firstDate = new Date(scarf.first_claimed_at);
  const formattedDate = firstDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.scarfCard}>
      {/* Badge rareza */}
      <View style={[styles.rarityBadge, { backgroundColor: rarityBg }]}>
        <AppText variant="caption" color={rarityColor} maxScale={1.0}>
          {RARITY_LABELS[scarf.rarity]}
        </AppText>
      </View>

      {/* Escudo del equipo */}
      <Image
        source={{ uri: logoUrl }}
        style={styles.teamLogo}
        resizeMode="contain"
        defaultSource={require('~/assets/icon.png')}
      />

      {/* Nombre equipo */}
      <AppText
        variant="label"
        align="center"
        maxScale={1.1}
        numberOfLines={2}
        style={styles.teamName}
      >
        {scarf.team.name}
      </AppText>

      {/* Contador visitas */}
      <View style={styles.claimRow}>
        <Ionicons name="football-outline" size={12} color={colors.text.muted} />
        <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
          {scarf.claim_count === 1 ? '1 visita' : `${scarf.claim_count} visitas`}
        </AppText>
      </View>

      {/* Fecha primer claim */}
      <AppText variant="caption" color={colors.text.muted} align="center" maxScale={1.0}>
        {formattedDate}
      </AppText>

      {/* Indicador rareza (borde inferior) */}
      <View style={[styles.rarityBar, { backgroundColor: rarityColor }]} />
    </View>
  );
}

// ─── Skeleton grid ────────────────────────────────────────────────────────────

function ScarvesSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonBox
          key={i}
          width="48%"
          height={180}
          borderRadius={radius.xl}
          style={styles.skeletonItem}
        />
      ))}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ScarvesScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<RarityFilter>('all');

  const { scarves, loading, refetch } = useScarves(userId);

  // Obtener userId al montar
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Cargar bufandas cuando tengamos userId
  useEffect(() => {
    if (userId) refetch();
  }, [userId, refetch]);

  const filteredScarves =
    activeFilter === 'all'
      ? scarves
      : scarves.filter((s) => s.rarity === activeFilter);

  const renderScarf = useCallback(
    ({ item }: { item: UserScarf }) => <ScarfCard scarf={item} />,
    []
  );

  const keyExtractor = useCallback((item: UserScarf) => item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title">Mi Colección</AppText>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.content}>
          <ScarvesSkeleton />
        </View>
        <BottomTabBar />
      </SafeAreaView>
    );
  }

  const common = scarves.filter((s) => s.rarity === 'common').length;
  const rare = scarves.filter((s) => s.rarity === 'rare').length;
  const legendary = scarves.filter((s) => s.rarity === 'legendary').length;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">Mi Colección</AppText>
        <View style={styles.headerBadge}>
          <AppText variant="caption" color={colors.status.boost} maxScale={1.0}>
            {scarves.length} 🧣
          </AppText>
        </View>
      </View>

      {/* Resumen de rareza */}
      {scarves.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <AppText variant="h2" color={colors.text.muted} maxScale={1.0}>
              {common}
            </AppText>
            <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
              Común
            </AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="h2" color={colors.status.boost} maxScale={1.0}>
              {rare}
            </AppText>
            <AppText variant="caption" color={colors.status.boost} maxScale={1.0}>
              Rara
            </AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <AppText variant="h2" color={colors.status.success} maxScale={1.0}>
              {legendary}
            </AppText>
            <AppText variant="caption" color={colors.status.success} maxScale={1.0}>
              Legendaria
            </AppText>
          </View>
        </View>
      )}

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          <AppChip
            label="Todas"
            selected={activeFilter === 'all'}
            onPress={() => setActiveFilter('all')}
          />
          <AppChip
            label="Común"
            selected={activeFilter === 'common'}
            onPress={() => setActiveFilter('common')}
          />
          <AppChip
            label="Rara"
            selected={activeFilter === 'rare'}
            onPress={() => setActiveFilter('rare')}
          />
          <AppChip
            label="Legendaria"
            selected={activeFilter === 'legendary'}
            onPress={() => setActiveFilter('legendary')}
          />
        </ScrollView>
      </View>

      {/* Grid de bufandas */}
      <View style={styles.content}>
        {filteredScarves.length > 0 ? (
          <FlatList
            data={filteredScarves}
            renderItem={renderScarf}
            keyExtractor={keyExtractor}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridList}
          />
        ) : scarves.length === 0 ? (
          <EmptyState
            icon="football-outline"
            title="Aún no tienes bufandas"
            subtitle="Ve a un bar a ver un partido de LaLiga y reclama tu primera bufanda"
            actionLabel="Explorar bares"
            onAction={() => router.push('/(protected)/map' as any)}
          />
        ) : (
          <EmptyState
            icon="search-outline"
            title="Sin resultados"
            subtitle={`No tienes bufandas de rareza "${RARITY_LABELS[activeFilter as ScarveRarity]}"`}
            actionLabel="Ver todas"
            onAction={() => setActiveFilter('all')}
          />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerBadge: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 40,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  filtersContainer: {
    marginBottom: spacing.md,
  },
  filtersScroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  skeletonItem: {
    marginBottom: spacing.md,
  },
  gridList: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  // Tarjeta de bufanda
  scarfCard: {
    width: '48%',
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
    overflow: 'hidden',
  },
  rarityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  teamLogo: {
    width: 72,
    height: 72,
    marginBottom: spacing.md,
  },
  teamName: {
    marginBottom: spacing.sm,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  rarityBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
});
