import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';

const REASON_LABELS: Record<string, string> = {
  info_incorrecta: 'Información incorrecta',
  cerrado: 'Ha cerrado',
  ubicacion_incorrecta: 'Ubicación incorrecta',
  fotos_incorrectas: 'Fotos incorrectas',
  otro: 'Otro',
};

type ReportDetail = {
  id: string;
  bar_id: string;
  reason: string;
  message: string | null;
  status: string;
  created_at: string;
  bars: { name: string; address?: string | null; city?: string | null; phone?: string | null } | null;
};

export default function BarReportDetailScreen() {
  const router = useRouter();
  const { reportId } = useLocalSearchParams<{ reportId: string }>();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<null | 'reviewed' | 'dismissed'>(null);

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bar_reports')
        .select('id, bar_id, reason, message, status, created_at, bars(name, address, city, phone)')
        .eq('id', reportId)
        .single();
      if (error) throw error;
      setReport(data as any);
    } catch (e: any) {
      console.error('❌ Error loading report:', e);
      Alert.alert('Error', e?.message || 'No se pudo cargar el reporte.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback(
    async (status: 'reviewed' | 'dismissed') => {
      if (!report) return;
      setActionLoading(status);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) throw new Error('No auth user');

        const { error } = await supabase
          .from('bar_reports')
          .update({
            status,
            admin_notes: adminNotes.trim() || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', report.id);
        if (error) throw error;

        router.back();
      } catch (e: any) {
        console.error('❌ Error resolving report:', e);
        Alert.alert('Error', e?.message || 'No se pudo actualizar el reporte.');
      } finally {
        setActionLoading(null);
      }
    },
    [report, adminNotes, router],
  );

  if (loading) {
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

  if (!report) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Reporte</AppText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={34} color="#A3B3CC" />
          <AppText style={styles.emptyTitle}>No encontrado</AppText>
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
        <AppText style={styles.headerTitle} numberOfLines={1}>
          {report.bars?.name || 'Bar desconocido'}
        </AppText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <InfoRow label="Motivo" value={REASON_LABELS[report.reason] || report.reason} />
          <InfoRow label="Mensaje" value={report.message || 'Sin mensaje adicional'} />
          <InfoRow label="Reportado" value={new Date(report.created_at).toLocaleString('es-ES')} />
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Dirección" value={(report.bars?.address || '—') + (report.bars?.city ? `, ${report.bars.city}` : '')} />
          <InfoRow label="Teléfono guardado" value={report.bars?.phone || '—'} />
        </View>

        <TouchableOpacity
          style={styles.editBarLink}
          onPress={() => router.push(`/bar-verification-admin/${report.bar_id}` as any)}
        >
          <Ionicons name="open-outline" size={16} color="#A3B3CC" />
          <AppText style={styles.editBarLinkText}>Ver ficha completa del bar</AppText>
        </TouchableOpacity>

        <View style={styles.notesCard}>
          <AppText style={styles.notesTitle}>Notas internas (opcional)</AppText>
          <TextInput
            placeholder="Notas para el equipo…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={adminNotes}
            onChangeText={setAdminNotes}
            style={styles.notesInput}
            multiline
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.reviewedBtn, actionLoading && styles.btnDisabled]}
            disabled={!!actionLoading}
            onPress={() => resolve('reviewed')}
          >
            {actionLoading === 'reviewed' ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <AppText style={styles.reviewedText}>Marcar revisado</AppText>
            </>}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.dismissBtn, actionLoading && styles.btnDisabled]}
            disabled={!!actionLoading}
            onPress={() => resolve('dismissed')}
          >
            {actionLoading === 'dismissed' ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Ionicons name="close" size={18} color="#FFFFFF" />
              <AppText style={styles.dismissText}>Descartar</AppText>
            </>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText style={styles.infoLabel}>{props.label}</AppText>
      <AppText style={styles.infoValue}>{props.value}</AppText>
    </View>
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
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', flex: 1 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  content: { paddingHorizontal: 16, paddingBottom: 18 },

  infoCard: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  infoRow: { gap: 2 },
  infoLabel: { color: '#A3B3CC', fontWeight: '900', fontSize: 12 },
  infoValue: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },

  editBarLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 6,
  },
  editBarLinkText: { color: '#A3B3CC', fontSize: 13, fontWeight: '700' },

  notesCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 10,
    marginBottom: 14,
  },
  notesTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  notesInput: {
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  reviewedBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reviewedText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  dismissBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#5B6B85',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dismissText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  btnDisabled: { opacity: 0.6 },
});
