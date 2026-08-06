import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { AppText } from '~/components/ds';

const REASON_LABELS: Record<string, string> = {
  info_incorrecta: 'Información incorrecta',
  cerrado: 'Ha cerrado',
  ubicacion_incorrecta: 'Ubicación incorrecta',
  fotos_incorrectas: 'Fotos incorrectas',
  otro: 'Otro',
};

type ReportRow = {
  id: string;
  bar_id: string;
  reason: string;
  message: string | null;
  status: string;
  created_at: string;
  bars: { name: string; address?: string | null; city?: string | null } | null;
};

export default function BarReportsAdminScreen() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchPendingReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('bar_reports')
      .select('id, bar_id, reason, message, status, created_at, bars(name, address, city)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setReports(((data as any) || []) as ReportRow[]);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPendingReports();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [fetchPendingReports]);

  useEffect(() => {
    (async () => {
      try {
        await loadAdminFlag();
        setLoading(true);
        await fetchPendingReports();
      } catch {
        Alert.alert('Error', 'No se pudieron cargar los reportes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPendingReports, loadAdminFlag]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) fetchPendingReports().catch(() => {});
    }, [fetchPendingReports, isAdmin]),
  );

  const renderItem = ({ item }: { item: ReportRow }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => router.push(`/bar-reports-admin/${item.id}` as any)}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="flag-outline" size={20} color="#EF4444" />
        </View>
        <View style={styles.cardInfo}>
          <AppText style={styles.cardTitle} numberOfLines={1}>
            {item.bars?.name || 'Bar desconocido'}
          </AppText>
          <AppText style={styles.cardSub} numberOfLines={1}>
            {REASON_LABELS[item.reason] || item.reason}
          </AppText>
          <AppText style={styles.cardMeta}>
            {new Date(item.created_at).toLocaleDateString('es-ES')}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.35)" />
      </View>
    </TouchableOpacity>
  );

  if (loading || isAdmin === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loading}>
          <ActivityIndicator color="#FFD700" />
          <AppText style={styles.loadingText}>Cargando…</AppText>
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
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Reportes de Bares</AppText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="lock-closed-outline" size={34} color="#A3B3CC" />
          <AppText style={styles.emptyTitle}>Acceso restringido</AppText>
          <AppText style={styles.emptySub}>Esta pantalla solo está disponible para superusuarios.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Reportes de Bares</AppText>
        <TouchableOpacity onPress={refresh} style={styles.iconBtn} disabled={refreshing}>
          <Ionicons name="refresh" size={20} color="#A3B3CC" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={reports.length ? styles.listContent : styles.listEmptyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#FFD700" />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-done-outline" size={34} color="#10B981" />
            <AppText style={styles.emptyTitle}>No hay reportes pendientes</AppText>
            <AppText style={styles.emptySub}>Cuando un usuario reporte un bar, aparecerá aquí.</AppText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C2A3A' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  iconBtn: { padding: 6 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 },
  listEmptyContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 },

  card: {
    backgroundColor: '#1A2332',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  cardSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  cardMeta: { color: 'rgba(163,179,204,0.8)', fontSize: 11 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  emptySub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});
