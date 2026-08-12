import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';

type ClaimDetail = {
  id: string;
  bar_id: string;
  contact_name: string;
  contact_phone: string;
  message: string;
  document_path: string | null;
  status: string;
  created_at: string;
  bars: { name: string; address?: string | null; city?: string | null; phone?: string | null; owner_id: string | null } | null;
};

export default function BarClaimDetailScreen() {
  const router = useRouter();
  const { claimId } = useLocalSearchParams<{ claimId: string }>();

  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<null | 'approve' | 'reject'>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    if (!claimId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bar_claims')
        .select('id, bar_id, contact_name, contact_phone, message, document_path, status, created_at, bars(name, address, city, phone, owner_id)')
        .eq('id', claimId)
        .single();
      if (error) throw error;
      setClaim(data as any);

      if (data?.document_path) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('bar-claim-documents')
          .createSignedUrl(data.document_path, 3600);
        if (signedError) {
          console.error('❌ Error signing document url:', signedError);
        } else {
          setDocumentUrl(signedData.signedUrl);
        }
      } else {
        setDocumentUrl(null);
      }
    } catch (e: any) {
      console.error('❌ Error loading claim:', e);
      Alert.alert('Error', e?.message || 'No se pudo cargar la solicitud.');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    load();
  }, [load]);

  const phoneMatches = useMemo(() => {
    if (!claim?.bars?.phone) return null;
    const normalize = (v: string) => v.replace(/\D/g, '');
    return normalize(claim.bars.phone) === normalize(claim.contact_phone);
  }, [claim]);

  const approve = useCallback(async () => {
    if (!claim) return;
    Alert.alert('Aprobar reclamo', `¿Confirmas que "${claim.contact_name}" es el propietario de "${claim.bars?.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar',
        style: 'default',
        onPress: async () => {
          try {
            setActionLoading('approve');
            const { error } = await supabase.rpc('approve_bar_claim', { p_claim_id: claim.id });
            if (error) throw error;
            Alert.alert('Aprobado', 'El bar ha quedado vinculado a este propietario.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (e: any) {
            console.error('❌ approve claim error:', e);
            Alert.alert('Error', e?.message || 'No se pudo aprobar el reclamo.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }, [claim, router]);

  const reject = useCallback(async () => {
    if (!claim) return;
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Falta motivo', 'Escribe un motivo para rechazar la solicitud.');
      return;
    }
    Alert.alert('Rechazar reclamo', '¿Confirmas rechazar esta solicitud?', [
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
              .from('bar_claims')
              .update({
                status: 'rejected',
                rejection_reason: reason,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
              })
              .eq('id', claim.id);
            if (error) throw error;
            Alert.alert('Rechazado', 'La solicitud ha sido rechazada.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (e: any) {
            console.error('❌ reject claim error:', e);
            Alert.alert('Error', e?.message || 'No se pudo rechazar el reclamo.');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }, [claim, rejectReason, router]);

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

  if (!claim) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Reclamo</AppText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={34} color="#A3B3CC" />
          <AppText style={styles.emptyTitle}>No encontrado</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const alreadyOwned = !!claim.bars?.owner_id && claim.status === 'pending';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle} numberOfLines={1}>
          {claim.bars?.name || 'Bar desconocido'}
        </AppText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <AppText style={styles.sectionTitle}>Solicitante</AppText>
          <InfoRow label="Nombre" value={claim.contact_name} />
          <InfoRow
            label="Teléfono"
            value={claim.contact_phone}
            hint={phoneMatches === true ? 'Coincide con el teléfono guardado' : phoneMatches === false ? 'No coincide con el teléfono guardado' : undefined}
            hintColor={phoneMatches === true ? '#10B981' : phoneMatches === false ? '#F59E0B' : undefined}
          />
          <InfoRow label="Mensaje" value={claim.message || '—'} />
          <InfoRow label="Enviado" value={new Date(claim.created_at).toLocaleString('es-ES')} />

          <View style={styles.infoRow}>
            <AppText style={styles.infoLabel}>Documento de verificación</AppText>
            {documentUrl ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(documentUrl)}>
                <Image source={{ uri: documentUrl }} style={styles.documentThumbnail} />
              </TouchableOpacity>
            ) : (
              <AppText style={styles.infoValue}>Sin documento adjunto</AppText>
            )}
          </View>
        </View>

        <View style={styles.infoCard}>
          <AppText style={styles.sectionTitle}>Datos actuales del bar</AppText>
          <InfoRow label="Dirección" value={(claim.bars?.address || '—') + (claim.bars?.city ? `, ${claim.bars.city}` : '')} />
          <InfoRow label="Teléfono guardado" value={claim.bars?.phone || '—'} />
        </View>

        {alreadyOwned ? (
          <View style={styles.warningBox}>
            <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
            <AppText style={styles.warningText}>
              Este bar ya tiene un propietario asignado. Aprobar esta solicitud no hará nada.
            </AppText>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.approveBtn, (actionLoading || alreadyOwned) && styles.btnDisabled]}
            disabled={!!actionLoading || alreadyOwned}
            onPress={approve}
          >
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
            <TextInput
              placeholder="Escribe el motivo…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={rejectReason}
              onChangeText={setRejectReason}
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
    </SafeAreaView>
  );
}

function InfoRow(props: { label: string; value: string; hint?: string; hintColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText style={styles.infoLabel}>{props.label}</AppText>
      <AppText style={styles.infoValue}>{props.value}</AppText>
      {props.hint ? (
        <AppText style={[styles.infoHint, props.hintColor ? { color: props.hintColor } : null]}>{props.hint}</AppText>
      ) : null}
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
  sectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginBottom: 2 },
  infoRow: { gap: 2 },
  infoLabel: { color: '#A3B3CC', fontWeight: '900', fontSize: 12 },
  infoValue: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },
  infoHint: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  documentThumbnail: {
    width: 160,
    height: 160,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginBottom: 14,
  },
  warningText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, flex: 1, lineHeight: 17 },

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
