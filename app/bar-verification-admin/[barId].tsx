import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import ImageViewing from 'react-native-image-viewing';

type VerificationStatus = 'pending' | 'approved' | 'rejected';

type BarDetail = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  verification_status: VerificationStatus;
  verification_notes?: string | null;
};

type ImgRow = { image_url: string; image_order?: number | null };

// Defensive clipboard loader (requires native rebuild in dev-client/bare)
type ClipboardModuleShape = { setStringAsync?: (text: string) => Promise<void> };
let ClipboardModule: ClipboardModuleShape | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClipboardModule = require('expo-clipboard') as ClipboardModuleShape;
} catch (e) {
  ClipboardModule = null;
}

export default function BarVerificationDetailScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();

  const [loading, setLoading] = useState(true);
  const [bar, setBar] = useState<BarDetail | null>(null);
  const [barImages, setBarImages] = useState<ImgRow[]>([]);
  const [menuImages, setMenuImages] = useState<ImgRow[]>([]);

  const [actionLoading, setActionLoading] = useState<null | 'approve' | 'reject'>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<Array<{ uri: string }>>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const quickRejectPresets = useMemo(
    () => [
      'El bar no existe en esta dirección.',
      'La información del bar es insuficiente/incompleta.',
      'Faltan fotos del bar o no son claras.',
      'Faltan fotos de la carta/menú.',
      'Las fotos no corresponden al bar.',
    ],
    [],
  );

  const load = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const { data: barData, error: barErr } = await supabase
        .from('bars')
        .select('id, name, address, city, phone, website, latitude, longitude, created_at, verification_status, verification_notes')
        .eq('id', barId)
        .single();
      if (barErr) throw barErr;
      setBar(barData as any);

      const { data: imgs } = await supabase
        .from('bar_images')
        .select('image_url, image_order')
        .eq('bar_id', barId)
        .order('image_order', { ascending: true });
      setBarImages(((imgs as any) || []) as ImgRow[]);

      const { data: menus } = await supabase
        .from('bar_menus')
        .select('image_url, image_order')
        .eq('bar_id', barId)
        .order('image_order', { ascending: true });
      setMenuImages(((menus as any) || []) as ImgRow[]);
    } catch (e: any) {
      console.error('❌ Error loading bar detail:', e);
      Alert.alert('Error', e?.message || 'No se pudo cargar el bar.');
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    load();
  }, [load]);

  const copyToClipboard = useCallback(async (label: string, value: string) => {
    try {
      if (!ClipboardModule?.setStringAsync) {
        Alert.alert('Copiar no disponible', 'Necesitas recompilar la app (dev build) para habilitar copiar.');
        return;
      }
      await ClipboardModule.setStringAsync(value);
      Alert.alert('Copiado', `${label} copiado al portapapeles`);
    } catch {
      Alert.alert('Error', 'No se pudo copiar al portapapeles');
    }
  }, []);

  const openViewer = useCallback((urls: string[], startIndex: number) => {
    const safe = urls.filter(Boolean);
    if (safe.length === 0) return;
    const idx = Math.min(Math.max(startIndex, 0), safe.length - 1);
    setViewerImages(safe.map((u) => ({ uri: u })));
    setViewerIndex(idx);
    setViewerVisible(true);
  }, []);

  const approve = useCallback(async () => {
    if (!bar) return;
    Alert.alert('Aprobar bar', `¿Confirmas aprobar "${bar.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar',
        style: 'default',
        onPress: async () => {
          try {
            setActionLoading('approve');
            const { data: authData } = await supabase.auth.getUser();
            const user = authData?.user;
            if (!user) throw new Error('No auth user');
            const { error } = await supabase
              .from('bars')
              .update({
                verification_status: 'approved',
                verified_at: new Date().toISOString(),
                verified_by: user.id,
                verification_notes: null,
              })
              .eq('id', bar.id);
            if (error) throw error;
            Alert.alert('Aprobado', 'El bar ya es visible para los usuarios.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (e: any) {
            console.error('❌ approve error:', e);
            Alert.alert('Error', e?.message || 'No se pudo aprobar el bar.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }, [bar, router]);

  const reject = useCallback(async () => {
    if (!bar) return;
    const notes = rejectNotes.trim();
    if (!notes) {
      Alert.alert('Falta motivo', 'Escribe un motivo para rechazar el bar.');
      return;
    }
    Alert.alert('Rechazar bar', '¿Confirmas rechazar este bar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rechazar',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading('reject');
            const { data: authData } = await supabase.auth.getUser();
            const user = authData?.user;
            if (!user) throw new Error('No auth user');
            const { error } = await supabase
              .from('bars')
              .update({
                verification_status: 'rejected',
                verified_at: new Date().toISOString(),
                verified_by: user.id,
                verification_notes: notes,
              })
              .eq('id', bar.id);
            if (error) throw error;
            Alert.alert('Rechazado', 'El owner verá el motivo y podrá corregirlo.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (e: any) {
            console.error('❌ reject error:', e);
            Alert.alert('Error', e?.message || 'No se pudo rechazar el bar.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }, [bar, rejectNotes, router]);

  const mainImageUrl = useMemo(() => {
    const preferred = barImages.find((i) => i.image_order === 1)?.image_url;
    return preferred || barImages[0]?.image_url || null;
  }, [barImages]);

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

  if (!bar) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Verificación</AppText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={34} color="#A3B3CC" />
          <AppText style={styles.emptyTitle}>No encontrado</AppText>
          <AppText style={styles.emptySub}>No se pudo cargar este bar.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const barUrls = barImages.map((i) => i.image_url);
  const menuUrls = menuImages.map((i) => i.image_url);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle} numberOfLines={1}>
          {bar.name}
        </AppText>
        <TouchableOpacity onPress={load} style={styles.iconBtn} disabled={actionLoading !== null}>
          <Ionicons name="refresh" size={20} color="#A3B3CC" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {mainImageUrl ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(barUrls, Math.max(0, barUrls.indexOf(mainImageUrl)))}>
            <Image source={{ uri: mainImageUrl }} style={styles.heroImage} />
          </TouchableOpacity>
        ) : (
          <View style={styles.heroFallback}>
            <Ionicons name="image-outline" size={28} color="#A3B3CC" />
          </View>
        )}

        <View style={styles.gallerySection}>
          <View style={styles.galleryHeader}>
            <AppText style={styles.galleryTitle}>Imágenes del bar</AppText>
            <AppText style={styles.galleryCount}>{barImages.length}</AppText>
          </View>
          {barImages.length > 0 ? (
            <FlatList
              data={barImages}
              keyExtractor={(it, idx) => `bar-${idx}-${it.image_url}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryList}
              renderItem={({ item }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(barUrls, barUrls.indexOf(item.image_url))}>
                  <Image source={{ uri: item.image_url }} style={styles.galleryThumb} />
                </TouchableOpacity>
              )}
            />
          ) : (
            <AppText style={styles.galleryEmpty}>Sin imágenes del bar</AppText>
          )}
        </View>

        <View style={styles.gallerySection}>
          <View style={styles.galleryHeader}>
            <AppText style={styles.galleryTitle}>Imágenes de la carta</AppText>
            <AppText style={styles.galleryCount}>{menuImages.length}</AppText>
          </View>
          {menuImages.length > 0 ? (
            <FlatList
              data={menuImages}
              keyExtractor={(it, idx) => `menu-${idx}-${it.image_url}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryList}
              renderItem={({ item }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(menuUrls, menuUrls.indexOf(item.image_url))}>
                  <Image source={{ uri: item.image_url }} style={styles.galleryThumb} />
                </TouchableOpacity>
              )}
            />
          ) : (
            <AppText style={styles.galleryEmpty}>Sin imágenes de la carta</AppText>
          )}
        </View>

        <View style={styles.infoCard}>
          <InfoRow
            label="Dirección"
            value={(bar.address || '—') + (bar.city ? `, ${bar.city}` : '')}
            onCopy={() => copyToClipboard('Dirección', (bar.address || '') + (bar.city ? `, ${bar.city}` : ''))}
            disabled={!bar.address && !bar.city}
          />
          <InfoRow label="Teléfono" value={bar.phone || '—'} onCopy={() => copyToClipboard('Teléfono', bar.phone || '')} disabled={!bar.phone} />
          <InfoRow label="Web" value={bar.website || '—'} onCopy={() => copyToClipboard('Web', bar.website || '')} disabled={!bar.website} />
          <InfoRow
            label="Coordenadas"
            value={bar.latitude && bar.longitude ? `${bar.latitude.toFixed(5)}, ${bar.longitude.toFixed(5)}` : '—'}
            onCopy={() => copyToClipboard('Coordenadas', bar.latitude && bar.longitude ? `${bar.latitude}, ${bar.longitude}` : '')}
            disabled={!bar.latitude || !bar.longitude}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity activeOpacity={0.85} style={[styles.approveBtn, actionLoading && styles.btnDisabled]} disabled={!!actionLoading} onPress={approve}>
            {actionLoading === 'approve' ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <AppText style={styles.approveText}>Aprobar</AppText>
            </>}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.rejectBtn, actionLoading && styles.btnDisabled]}
            disabled={!!actionLoading}
            onPress={() => setShowReject((v) => !v)}
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
            <AppText style={styles.rejectText}>Rechazar</AppText>
          </TouchableOpacity>
        </View>

        {showReject ? (
          <View style={styles.rejectCard}>
            <AppText style={styles.rejectTitle}>Motivo de rechazo</AppText>
            <View style={styles.presetRow}>
              {quickRejectPresets.map((p) => (
                <TouchableOpacity key={p} activeOpacity={0.85} style={styles.presetChip} onPress={() => setRejectNotes(p)}>
                  <AppText style={styles.presetChipText}>{p}</AppText>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              placeholder="Escribe el motivo…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={rejectNotes}
              onChangeText={setRejectNotes}
              style={styles.rejectInput}
              multiline
            />
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.rejectConfirmBtn, actionLoading && styles.btnDisabled]}
              disabled={!!actionLoading}
              onPress={reject}
            >
              {actionLoading === 'reject' ? <ActivityIndicator color="#FFFFFF" /> : <>
                <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                <AppText style={styles.rejectConfirmText}>Confirmar rechazo</AppText>
              </>}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <ImageViewing
        images={viewerImages}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
      />
    </SafeAreaView>
  );
}

function InfoRow(props: { label: string; value: string; onCopy: () => void; disabled?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoTextWrap}>
        <AppText style={styles.infoLabel}>{props.label}</AppText>
        <AppText style={styles.infoValue}>{props.value}</AppText>
      </View>
      <TouchableOpacity style={[styles.copyBtn, props.disabled && { opacity: 0.4 }]} onPress={props.onCopy} disabled={props.disabled}>
        <Ionicons name="copy-outline" size={18} color="#A3B3CC" />
      </TouchableOpacity>
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
  iconBtn: { padding: 6 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  emptySub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' },

  content: { paddingHorizontal: 16, paddingBottom: 18 },
  heroImage: { width: '100%', height: 190, borderRadius: 18, backgroundColor: '#2A3A4A', marginBottom: 14 },
  heroFallback: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    backgroundColor: '#2A3A4A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  gallerySection: { marginBottom: 14 },
  galleryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  galleryTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  galleryCount: {
    color: '#A3B3CC',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  galleryList: { gap: 10, paddingRight: 2 },
  galleryThumb: { width: 78, height: 78, borderRadius: 14, backgroundColor: '#2A3A4A' },
  galleryEmpty: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },

  infoCard: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  infoTextWrap: { flex: 1, gap: 2 },
  infoLabel: { color: '#A3B3CC', fontWeight: '900', fontSize: 12 },
  infoValue: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 16 },
  copyBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  approveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  approveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  rejectBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rejectText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  btnDisabled: { opacity: 0.6 },

  rejectCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(239,68,68,0.06)',
    gap: 10,
  },
  rejectTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  presetChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  rejectInput: {
    minHeight: 70,
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
  rejectConfirmBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rejectConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});


