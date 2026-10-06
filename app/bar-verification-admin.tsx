import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { AppText, AppCard, AppButton, EmptyState, colors, spacing, radius, toast } from '~/components/ds';
import { approveBars } from '~/services/bars';

// `source` indica en qué tabla vive la fila (bars_scraped vs bars), no quién
// la originó. Un bar sin dueño de `bars` lleva source:'owner' aunque se
// muestre en la pestaña visual "Scraper" — el tab es solo una etiqueta de UI.
type Source = 'scraped' | 'owner';
type Tab = 'ownerless' | 'scraped' | 'owner' | 'archived';

type PendingBar = {
  id: string;
  source: Source;
  name: string;
  address?: string | null;
  city?: string | null;
  created_at?: string | null;
  thumb_url?: string | null;
  confidence?: string | null;
};

const PAGE_SIZE = 20;

type TabState = {
  bars: PendingBar[];
  page: number;
  // Solo se usan en la pestaña 'scraped', que combina dos fuentes (candidatos
  // de bars_scraped + bares sin dueño de bars) en dos fases secuenciales:
  // primero se agota bars_scraped, luego se continúa con los bares sin dueño.
  ownerlessPage: number;
  scrapedExhausted: boolean;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
};

const emptyTabState = (): TabState => ({
  bars: [],
  page: 0,
  ownerlessPage: 0,
  scrapedExhausted: false,
  hasMore: true,
  loading: true,
  loadingMore: false,
  refreshing: false,
});

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  // Bares reales pendientes sin dueño: ya tienen ficha completa y se pueden
  // aprobar en bloque (mantener pulsado para seleccionar).
  { key: 'ownerless', label: 'Sin dueño', icon: 'storefront-outline' },
  { key: 'scraped', label: 'Scraper', icon: 'globe-outline' },
  { key: 'owner', label: 'Propietarios', icon: 'person-outline' },
  { key: 'archived', label: 'Archivados', icon: 'archive-outline' },
];

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: colors.status.success,
  MEDIUM: colors.status.warning,
  LOW: colors.status.error,
};

export default function BarVerificationAdminScreen() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ownerless');
  const [tabs, setTabs] = useState<Record<Tab, TabState>>({
    ownerless: emptyTabState(),
    scraped: emptyTabState(),
    owner: emptyTabState(),
    archived: emptyTabState(),
  });

  const loadAdminFlag = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase.from('users').select('is_super_user').eq('id', user.id).single();
    if (error) {
      console.error('❌ Error loading admin flag:', error);
      setIsAdmin(false);
      return;
    }
    setIsAdmin(!!data?.is_super_user);
  }, []);

  const mapBarRow = useCallback((r: any, source: Source): PendingBar => {
    const images = (r.bar_images as { image_url: string; image_order: number | null }[] | null) || [];
    const thumb = images.find((i) => i.image_order === 1)?.image_url || images[0]?.image_url || null;
    return {
      id: r.id,
      source,
      name: r.name,
      address: r.address,
      city: r.city,
      created_at: r.created_at,
      thumb_url: thumb,
    };
  }, []);

  const fetchScrapedPage = useCallback(async (page: number): Promise<PendingBar[]> => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('bars_scraped')
      .select('id, name, address, city, created_at, confidence, image_urls')
      .eq('status', 'pending')
      .order('confidence_rank', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ((data as any) || []).map((r: any) => ({
      id: r.id,
      source: 'scraped' as const,
      name: r.name,
      address: r.address,
      city: r.city,
      created_at: r.created_at,
      thumb_url: (r.image_urls as string[] | null)?.[0] || null,
      confidence: r.confidence,
    }));
  }, []);

  // Bares reales pendientes, SIN propietario (convertidos desde el scraper o
  // importados en bloque por el equipo). Se muestran en la pestaña "Scraper"
  // tras agotar los candidatos de bars_scraped.
  const fetchOwnerlessBarsPage = useCallback(async (page: number): Promise<PendingBar[]> => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('bars')
      .select('id, name, address, city, created_at, bar_images(image_url, image_order)')
      .eq('verification_status', 'pending')
      .is('owner_id', null)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ((data as any) || []).map((r: any) => mapBarRow(r, 'owner'));
  }, [mapBarRow]);

  // Bares reales pendientes CON propietario asignado. Única fuente de la
  // pestaña "Propietarios".
  const fetchOwnerPage = useCallback(async (page: number): Promise<PendingBar[]> => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('bars')
      .select('id, name, address, city, created_at, bar_images(image_url, image_order)')
      .eq('verification_status', 'pending')
      .not('owner_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ((data as any) || []).map((r: any) => mapBarRow(r, 'owner'));
  }, [mapBarRow]);

  // Candidatos archivados de bars_scraped. Pestaña "Archivados": aquí no
  // aplica la distinción por owner_id, se muestran todos juntos.
  const fetchArchivedScrapedPage = useCallback(async (page: number): Promise<PendingBar[]> => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('bars_scraped')
      .select('id, name, address, city, created_at, confidence, image_urls')
      .eq('status', 'archived')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ((data as any) || []).map((r: any) => ({
      id: r.id,
      source: 'scraped' as const,
      name: r.name,
      address: r.address,
      city: r.city,
      created_at: r.created_at,
      thumb_url: (r.image_urls as string[] | null)?.[0] || null,
      confidence: r.confidence,
    }));
  }, []);

  // Bares archivados de la tabla bars, sin distinguir owner_id.
  const fetchArchivedBarsPage = useCallback(async (page: number): Promise<PendingBar[]> => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('bars')
      .select('id, name, address, city, created_at, bar_images(image_url, image_order)')
      .eq('verification_status', 'archived')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return ((data as any) || []).map((r: any) => mapBarRow(r, 'owner'));
  }, [mapBarRow]);

  // Combina dos fuentes paginadas en dos fases secuenciales: agota primero
  // `phase1Fetch` y, en cuanto una página no llega a PAGE_SIZE, completa el
  // resto con `phase2Fetch` desde su página 0 y continúa paginando solo por
  // ahí. Evita tener que fusionar/ordenar dos tablas distintas.
  const fetchTwoPhasePage = useCallback(
    async (
      phase1Fetch: (page: number) => Promise<PendingBar[]>,
      phase2Fetch: (page: number) => Promise<PendingBar[]>,
      targetPage: number,
      targetOwnerlessPage: number,
      wasExhausted: boolean,
    ): Promise<{ rows: PendingBar[]; page: number; ownerlessPage: number; scrapedExhausted: boolean; hasMore: boolean }> => {
      if (!wasExhausted) {
        const rows = await phase1Fetch(targetPage);
        if (rows.length === PAGE_SIZE) {
          return { rows, page: targetPage, ownerlessPage: 0, scrapedExhausted: false, hasMore: true };
        }
        const extra = await phase2Fetch(0);
        return { rows: [...rows, ...extra], page: targetPage, ownerlessPage: 0, scrapedExhausted: true, hasMore: extra.length === PAGE_SIZE };
      }
      const rows = await phase2Fetch(targetOwnerlessPage);
      return { rows, page: targetPage, ownerlessPage: targetOwnerlessPage, scrapedExhausted: true, hasMore: rows.length === PAGE_SIZE };
    },
    [],
  );

  // 'owner' y 'ownerless' son paginación simple de una sola tabla; 'scraped'
  // y 'archived' combinan dos fuentes en dos fases (ver fetchTwoPhasePage).
  const singleTableFetcher = useCallback(
    (tab: 'owner' | 'ownerless') => (tab === 'owner' ? fetchOwnerPage : fetchOwnerlessBarsPage),
    [fetchOwnerPage, fetchOwnerlessBarsPage],
  );

  const twoPhaseFetchersForTab = useCallback(
    (tab: 'scraped' | 'archived') =>
      tab === 'scraped'
        ? { phase1: fetchScrapedPage, phase2: fetchOwnerlessBarsPage }
        : { phase1: fetchArchivedScrapedPage, phase2: fetchArchivedBarsPage },
    [fetchScrapedPage, fetchOwnerlessBarsPage, fetchArchivedScrapedPage, fetchArchivedBarsPage],
  );

  const loadFirstPage = useCallback(
    async (tab: Tab) => {
      setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
      try {
        if (tab === 'owner' || tab === 'ownerless') {
          const rows = await singleTableFetcher(tab)(0);
          setTabs((prev) => ({
            ...prev,
            [tab]: { ...prev[tab], bars: rows, page: 0, hasMore: rows.length === PAGE_SIZE, loading: false },
          }));
          return;
        }
        const { phase1, phase2 } = twoPhaseFetchersForTab(tab);
        const result = await fetchTwoPhasePage(phase1, phase2, 0, 0, false);
        setTabs((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            bars: result.rows,
            page: result.page,
            ownerlessPage: result.ownerlessPage,
            scrapedExhausted: result.scrapedExhausted,
            hasMore: result.hasMore,
            loading: false,
          },
        }));
      } catch (e) {
        console.error(`❌ Error loading ${tab} bars:`, e);
        setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
      }
    },
    [singleTableFetcher, fetchTwoPhasePage, twoPhaseFetchersForTab],
  );

  const loadMore = useCallback(
    async (tab: Tab) => {
      const current = tabs[tab];
      if (current.loading || current.loadingMore || current.refreshing || !current.hasMore) return;

      setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], loadingMore: true } }));
      try {
        if (tab === 'owner' || tab === 'ownerless') {
          const nextPage = current.page + 1;
          const rows = await singleTableFetcher(tab)(nextPage);
          setTabs((prev) => ({
            ...prev,
            [tab]: { ...prev[tab], bars: [...prev[tab].bars, ...rows], page: nextPage, hasMore: rows.length === PAGE_SIZE, loadingMore: false },
          }));
          return;
        }
        const { phase1, phase2 } = twoPhaseFetchersForTab(tab);
        const nextPage = current.scrapedExhausted ? current.page : current.page + 1;
        const nextOwnerlessPage = current.scrapedExhausted ? current.ownerlessPage + 1 : 0;
        const result = await fetchTwoPhasePage(phase1, phase2, nextPage, nextOwnerlessPage, current.scrapedExhausted);
        setTabs((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            bars: [...prev[tab].bars, ...result.rows],
            page: result.page,
            ownerlessPage: result.ownerlessPage,
            scrapedExhausted: result.scrapedExhausted,
            hasMore: result.hasMore,
            loadingMore: false,
          },
        }));
      } catch (e) {
        console.error(`❌ Error loading more ${tab} bars:`, e);
        setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], loadingMore: false } }));
      }
    },
    [singleTableFetcher, fetchTwoPhasePage, twoPhaseFetchersForTab, tabs],
  );

  const refresh = useCallback(
    async (tab: Tab) => {
      setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], refreshing: true } }));
      try {
        if (tab === 'owner' || tab === 'ownerless') {
          const rows = await singleTableFetcher(tab)(0);
          setTabs((prev) => ({
            ...prev,
            [tab]: { ...prev[tab], bars: rows, page: 0, hasMore: rows.length === PAGE_SIZE, refreshing: false },
          }));
          return;
        }
        const { phase1, phase2 } = twoPhaseFetchersForTab(tab);
        const result = await fetchTwoPhasePage(phase1, phase2, 0, 0, false);
        setTabs((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            bars: result.rows,
            page: result.page,
            ownerlessPage: result.ownerlessPage,
            scrapedExhausted: result.scrapedExhausted,
            hasMore: result.hasMore,
            refreshing: false,
          },
        }));
      } catch (e) {
        setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], refreshing: false } }));
      }
    },
    [singleTableFetcher, fetchTwoPhasePage, twoPhaseFetchersForTab],
  );

  useEffect(() => {
    (async () => {
      await loadAdminFlag();
    })();
  }, [loadAdminFlag]);

  useEffect(() => {
    if (isAdmin) {
      loadFirstPage('ownerless');
      loadFirstPage('scraped');
      loadFirstPage('owner');
      loadFirstPage('archived');
    }
  }, [isAdmin, loadFirstPage]);

  // Refresh la pestaña activa al volver del detalle
  useFocusEffect(
    useCallback(() => {
      if (isAdmin) refresh(activeTab).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, activeTab]),
  );

  const tabState = tabs[activeTab];

  // ─── Selección múltiple (solo pestaña "Sin dueño") ─────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const canSelect = activeTab === 'ownerless';
  const selectionMode = canSelect && selectedIds.size > 0;

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const changeTab = useCallback((tab: Tab) => {
    setSelectedIds(new Set());
    setActiveTab(tab);
  }, []);

  const selectAllLoaded = useCallback(() => {
    setSelectedIds(new Set(tabs.ownerless.bars.map((b) => b.id)));
  }, [tabs.ownerless.bars]);

  const runBulkApprove = useCallback(async () => {
    const ids = [...selectedIds];
    setApproving(true);
    try {
      const approved = await approveBars(ids);
      const approvedSet = new Set(approved);
      setTabs((prev) => ({
        ...prev,
        ownerless: { ...prev.ownerless, bars: prev.ownerless.bars.filter((b) => !approvedSet.has(b.id)) },
      }));
      setSelectedIds(new Set());

      if (approved.length === ids.length) {
        toast.success(`${approved.length} bares aprobados`, 'Ya son visibles para los usuarios');
      } else {
        toast.warning(
          `${approved.length} de ${ids.length} bares aprobados`,
          'El resto ya no estaba pendiente; refresca la lista'
        );
      }
      // Los bares sin dueño también aparecen al final de la pestaña Scraper
      refresh('scraped').catch(() => {});
    } catch (e: any) {
      toast.supabaseError(e, 'No se pudieron aprobar los bares');
    } finally {
      setApproving(false);
    }
  }, [selectedIds, refresh]);

  const confirmBulkApprove = useCallback(() => {
    const count = selectedIds.size;
    Alert.alert(
      `Aprobar ${count} ${count === 1 ? 'bar' : 'bares'}`,
      'Pasarán a ser visibles para todos los usuarios en el mapa y la búsqueda.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprobar', onPress: runBulkApprove },
      ]
    );
  }, [selectedIds, runBulkApprove]);

  const renderItem = ({ item }: { item: PendingBar }) => {
    const isScraped = item.source === 'scraped';
    const confidenceKey = item.confidence?.toUpperCase();
    const confidenceColor = (confidenceKey && CONFIDENCE_COLOR[confidenceKey]) || colors.text.muted;
    const selected = selectedIds.has(item.id);
    const openDetail = () => router.push(`/bar-verification-admin/${item.id}?source=${item.source}` as any);
    return (
      <AppCard
        style={selected ? { ...styles.card, ...styles.cardSelected } : styles.card}
        onPress={selectionMode ? () => toggleSelected(item.id) : openDetail}
        onLongPress={canSelect ? () => toggleSelected(item.id) : undefined}
      >
        <View style={styles.cardRow}>
          <View style={styles.thumb}>
            {item.thumb_url ? (
              <Image
                source={{ uri: `${item.thumb_url}?width=100&quality=60` }}
                style={styles.thumbImg}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons name="storefront-outline" size={20} color={colors.text.secondary} />
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <AppText variant="label" color={colors.text.primary} style={styles.cardTitle} numberOfLines={1} maxScale={1.1}>
                {item.name}
              </AppText>
              {isScraped && item.confidence ? (
                <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}22`, borderColor: `${confidenceColor}44` }]}>
                  <AppText variant="caption" color={confidenceColor} style={styles.confidenceBadgeText} maxScale={1.0}>
                    {item.confidence}
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.cardMetaRow}>
              <Ionicons name="location-outline" size={12} color={colors.text.muted} />
              <AppText variant="caption" color={colors.text.secondary} numberOfLines={1} style={styles.cardMetaText} maxScale={1.1}>
                {(item.address || 'Sin dirección') + (item.city ? `, ${item.city}` : '')}
              </AppText>
            </View>
            <View style={styles.cardMetaRow}>
              <Ionicons name="time-outline" size={12} color={colors.text.muted} />
              <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString('es-ES') : '—'}
              </AppText>
            </View>
          </View>
          {selectionMode ? (
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={selected ? colors.status.success : colors.text.muted}
            />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          )}
        </View>
      </AppCard>
    );
  };

  if (isAdmin === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.status.boost} />
          <AppText variant="caption" color={colors.text.secondary}>Cargando…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title" color={colors.text.primary} maxScale={1.0}>Verificación de Bares</AppText>
          <View style={{ width: 28 }} />
        </View>

        <EmptyState
          icon="lock-closed-outline"
          title="Acceso restringido"
          subtitle="Esta pantalla solo está disponible para superusuarios."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title" color={colors.text.primary} maxScale={1.0}>Verificación de Bares</AppText>
        <TouchableOpacity onPress={() => refresh(activeTab)} style={styles.iconBtn} disabled={tabState.refreshing}>
          <Ionicons name="refresh" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => changeTab(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={tab.icon} size={15} color={active ? colors.status.boost : colors.text.secondary} />
              <AppText variant="label" color={active ? colors.status.boost : colors.text.secondary} maxScale={1.0}>
                {tab.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {tabState.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.status.boost} />
          <AppText variant="caption" color={colors.text.secondary}>Cargando…</AppText>
        </View>
      ) : (
        <FlatList
          data={tabState.bars}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={tabState.bars.length ? styles.listContent : styles.listEmptyContent}
          refreshControl={
            <RefreshControl refreshing={tabState.refreshing} onRefresh={() => refresh(activeTab)} tintColor={colors.status.boost} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => loadMore(activeTab)}
          ListFooterComponent={
            tabState.loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={colors.status.boost} />
              </View>
            ) : null
          }
          ListHeaderComponent={
            canSelect && !selectionMode && tabState.bars.length > 0 ? (
              <AppText variant="caption" color={colors.text.muted} style={styles.selectHint} maxScale={1.1}>
                Mantén pulsado un bar para seleccionar varios y aprobarlos a la vez.
              </AppText>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'archived' ? 'archive-outline' : 'checkmark-done-outline'}
              title={activeTab === 'archived' ? 'No hay bares archivados' : 'No hay bares pendientes'}
              subtitle={
                activeTab === 'scraped'
                  ? 'Cuando el scraper encuentre candidatos o se importen bares sin dueño, aparecerán aquí.'
                  : activeTab === 'ownerless'
                    ? 'Los bares sin dueño pendientes de revisar aparecerán aquí.'
                    : activeTab === 'owner'
                    ? 'Cuando un propietario registre un bar nuevo, aparecerá aquí.'
                    : 'Los bares archivados aparecerán aquí.'
              }
            />
          }
        />
      )}

      {selectionMode && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionInfo}>
            <AppText variant="label" color={colors.text.primary} maxScale={1.0}>
              {selectedIds.size} {selectedIds.size === 1 ? 'seleccionado' : 'seleccionados'}
            </AppText>
            <View style={styles.selectionLinks}>
              <TouchableOpacity onPress={selectAllLoaded} disabled={approving}>
                <AppText variant="caption" color={colors.brand.link} maxScale={1.0}>
                  Seleccionar los {tabs.ownerless.bars.length} cargados
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedIds(new Set())} disabled={approving}>
                <AppText variant="caption" color={colors.text.secondary} maxScale={1.0}>
                  Cancelar
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
          <AppButton
            text={`Aprobar ${selectedIds.size}`}
            onPress={confirmBulkApprove}
            loading={approving}
            disabled={approving}
            fullWidth={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: spacing.xs },
  iconBtn: { padding: spacing.xs + 2 },

  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.pill,
    padding: spacing.xxs,
    gap: spacing.xxs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.pill,
  },
  tabActive: { backgroundColor: `${colors.status.boost}1f` },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  footerLoading: { paddingVertical: spacing.lg },

  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  listEmptyContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 48, height: 48, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.border.subtle,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cardTitle: { flexShrink: 1, fontSize: 15 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardMetaText: { flexShrink: 1 },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  confidenceBadgeText: { fontWeight: '700' },

  cardSelected: { borderColor: colors.status.success },
  selectHint: { marginBottom: spacing.sm },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  selectionInfo: { flex: 1, gap: spacing.xxs },
  selectionLinks: { flexDirection: 'row', gap: spacing.md },
});
