import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { supabase } from '~/utils/supabase';
import {
  AppText,
  AppButton,
  EmptyState,
  SkeletonBox,
  colors,
  spacing,
  radius,
  shadows,
  toast,
} from '~/components/ds';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ClaimStatus = 'pending' | 'approved' | 'rejected';
type FilterTab = 'pending' | 'approved' | 'rejected';

interface TicketClaim {
  id: string;
  user_id: string;
  status: ClaimStatus;
  ticket_image_url: string;
  location_verified: boolean;
  match_day_verified: boolean;
  people_count?: number;
  rejection_reason: string | null;
  created_at: string;
  bar: { name: string } | null;
  team: { id: string; name: string; logo_url: string | null } | null;
  user_display?: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// ─── Tarjeta de claim ─────────────────────────────────────────────────────────

interface ClaimCardProps {
  claim: TicketClaim;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function ClaimCard({ claim, onApprove, onReject }: ClaimCardProps) {
  const logoUrl =
    claim.team?.logo_url ||
    `${SUPABASE_URL}/storage/v1/object/public/logo_teams/${claim.team?.id}.png`;

  const createdAt = new Date(claim.created_at).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isPending = claim.status === 'pending';

  return (
    <View style={styles.card}>
      {/* Header: equipo + bar */}
      <View style={styles.cardHeader}>
        <Image
          source={{ uri: logoUrl }}
          style={styles.teamLogo}
          resizeMode="contain"
          defaultSource={require('~/assets/icon.png')}
        />
        <View style={styles.cardHeaderInfo}>
          <AppText variant="label" maxScale={1.1} numberOfLines={1}>
            {claim.team?.name ?? '—'}
          </AppText>
          <AppText variant="caption" color={colors.text.muted} numberOfLines={1} maxScale={1.0}>
            {claim.bar?.name ?? '—'}
          </AppText>
          <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
            {claim.user_display ?? 'Usuario'} · {createdAt}
          </AppText>
        </View>
        <StatusBadge status={claim.status} />
      </View>

      {/* Foto del ticket */}
      <Image
        source={{ uri: claim.ticket_image_url }}
        style={styles.ticketImage}
        resizeMode="cover"
      />

      {/* Validaciones */}
      <View style={styles.validationRow}>
        <ValidationChip
          icon="location"
          label="Ubicación"
          verified={claim.location_verified}
        />
        <ValidationChip
          icon="football"
          label="Partido"
          verified={claim.match_day_verified}
        />
        <View style={styles.peopleChip}>
          <Ionicons name="people-outline" size={13} color={colors.text.muted} />
          <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
            {claim.people_count} {claim.people_count === 1 ? 'persona' : 'personas'}
          </AppText>
        </View>
      </View>

      {claim.rejection_reason ? (
        <View style={styles.rejectionBox}>
          <AppText variant="caption" color={colors.status.error} maxScale={1.0}>
            Motivo: {claim.rejection_reason}
          </AppText>
        </View>
      ) : null}

      {/* Acciones (solo pendientes) */}
      {isPending && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => onApprove(claim.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <AppText variant="label" color="#fff" maxScale={1.0}>Aprobar</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => onReject(claim.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={18} color="#fff" />
            <AppText variant="label" color="#fff" maxScale={1.0}>Rechazar</AppText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: ClaimStatus }) {
  const map = {
    pending: { label: 'Pendiente', color: colors.status.warning, bg: 'rgba(245,158,11,0.12)' },
    approved: { label: 'Aprobado', color: colors.status.success, bg: 'rgba(16,185,129,0.12)' },
    rejected: { label: 'Rechazado', color: colors.status.error, bg: 'rgba(239,68,68,0.12)' },
  };
  const s = map[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <AppText variant="caption" color={s.color} maxScale={1.0}>{s.label}</AppText>
    </View>
  );
}

function ValidationChip({ icon, label, verified }: { icon: string; label: string; verified: boolean }) {
  const color = verified ? colors.status.success : colors.status.warning;
  const bg = verified ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)';
  return (
    <View style={[styles.validationChip, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={12} color={color} />
      <AppText variant="caption" color={color} maxScale={1.0}>{label}</AppText>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function AdminTicketClaimsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<TicketClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchClaims = useCallback(async (status: FilterTab) => {
    const { data, error } = await supabase
      .from('ticket_claims')
      .select(`
        id, user_id, status, ticket_image_url,
        location_verified, match_day_verified,
        rejection_reason, created_at,
        bar:bars!ticket_claims_bar_id_fkey(name),
        team:teams!ticket_claims_team_id_fkey(id, name, logo_url)
      `)
      .eq('status', status)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rawClaims = (data ?? []) as unknown as TicketClaim[];

    // Query secundaria a public.users para obtener nombres (no se puede hacer join directo
    // porque ticket_claims.user_id referencia auth.users, no public.users)
    const userIds = [...new Set(rawClaims.map(c => c.user_id))];
    const { data: usersData } = userIds.length
      ? await supabase.from('users').select('id, full_name, username').in('id', userIds)
      : { data: [] };

    const userMap = new Map(
      (usersData ?? []).map((u: any) => [u.id, u.full_name ?? u.username ?? 'Usuario'])
    );

    setClaims(rawClaims.map(c => ({ ...c, user_display: userMap.get(c.user_id) ?? 'Usuario' })));
  }, []);

  const load = useCallback(async (status: FilterTab = activeTab) => {
    setLoading(true);
    try {
      await fetchClaims(status);
    } catch (e) {
      console.error('❌ Error loading ticket claims:', e);
      toast.error('Error al cargar los tickets');
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchClaims]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchClaims(activeTab);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, fetchClaims]);

  useFocusEffect(useCallback(() => { load(activeTab); }, [activeTab]));

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    load(tab);
  };

  // ─── Aprobar ──────────────────────────────────────────────────────────────

  const handleApprove = useCallback(async (claimId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { error } = await supabase
      .from('ticket_claims')
      .update({ status: 'approved' })
      .eq('id', claimId);

    if (error) {
      toast.error('Error al aprobar el ticket');
      return;
    }
    toast.success('Ticket aprobado');
    setClaims(prev => prev.filter(c => c.id !== claimId));
  }, []);

  // ─── Rechazar ─────────────────────────────────────────────────────────────

  const handleRejectPress = useCallback((claimId: string) => {
    setRejectTargetId(claimId);
    setRejectReason('');
    setRejectModalVisible(true);
  }, []);

  const handleConfirmReject = useCallback(async () => {
    if (!rejectTargetId) return;
    const reason = rejectReason.trim() || 'Ticket inválido';
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    const { error } = await supabase
      .from('ticket_claims')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', rejectTargetId);

    setRejectModalVisible(false);
    setRejectTargetId(null);
    setRejectReason('');

    if (error) {
      toast.error('Error al rechazar el ticket');
      return;
    }
    toast.success('Ticket rechazado');
    setClaims(prev => prev.filter(c => c.id !== rejectTargetId));
  }, [rejectTargetId, rejectReason]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const pendingCount = activeTab === 'pending' ? claims.length : 0;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">Revisión de Tickets</AppText>
        {pendingCount > 0 ? (
          <View style={styles.pendingBadge}>
            <AppText variant="caption" color={colors.status.warning} maxScale={1.0}>
              {pendingCount}
            </AppText>
          </View>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['pending', 'approved', 'rejected'] as FilterTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
            activeOpacity={0.7}
          >
            <AppText
              variant="label"
              color={activeTab === tab ? colors.text.primary : colors.text.muted}
              maxScale={1.0}
            >
              {tab === 'pending' ? 'Pendientes' : tab === 'approved' ? 'Aprobados' : 'Rechazados'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3].map(i => (
            <SkeletonBox key={i} width="100%" height={280} borderRadius={radius.xl} style={styles.skeletonItem} />
          ))}
        </View>
      ) : claims.length === 0 ? (
        <EmptyState
          icon={activeTab === 'pending' ? 'receipt-outline' : activeTab === 'approved' ? 'checkmark-circle-outline' : 'close-circle-outline'}
          title={
            activeTab === 'pending'
              ? 'Sin tickets pendientes'
              : activeTab === 'approved'
                ? 'Sin tickets aprobados'
                : 'Sin tickets rechazados'
          }
          subtitle={activeTab === 'pending' ? 'Los usuarios aún no han enviado tickets para revisar' : ''}
        />
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClaimCard
              claim={item}
              onApprove={handleApprove}
              onReject={handleRejectPress}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text.muted} />
          }
        />
      )}

      {/* Modal de rechazo */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <AppText variant="title" style={{ marginBottom: spacing.sm }}>
              Rechazar ticket
            </AppText>
            <AppText variant="body" color={colors.text.secondary} style={{ marginBottom: spacing.lg }}>
              Indica el motivo del rechazo (opcional)
            </AppText>
            <TextInput
              style={styles.reasonInput}
              placeholder="Ej: Foto ilegible, ticket incorrecto..."
              placeholderTextColor={colors.text.muted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              maxLength={200}
            />
            {/* Motivos rápidos */}
            <View style={styles.quickReasons}>
              {['Ticket no válido', 'Foto ilegible', 'No corresponde al partido'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.quickReasonChip, rejectReason === r && styles.quickReasonSelected]}
                  onPress={() => setRejectReason(r)}
                  activeOpacity={0.7}
                >
                  <AppText
                    variant="caption"
                    color={rejectReason === r ? colors.text.primary : colors.text.secondary}
                    maxScale={1.0}
                  >
                    {r}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalVisible(false)}
                activeOpacity={0.7}
              >
                <AppText variant="label" color={colors.text.secondary}>Cancelar</AppText>
              </TouchableOpacity>
              <View style={styles.modalConfirmBtn}>
                <AppButton
                  text="Rechazar"
                  onPress={handleConfirmReject}
                  variant="primary"
                  fullWidth
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

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
  pendingBadge: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.bg.elevated,
  },
  // Lista
  skeletonList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  skeletonItem: {
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    gap: spacing.lg,
  },
  // Tarjeta
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  teamLogo: {
    width: 40,
    height: 40,
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs ?? 2,
  },
  ticketImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.bg.elevated,
  },
  validationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    flexWrap: 'wrap',
  },
  validationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  peopleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bg.elevated,
  },
  rejectionBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 0,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  approveBtn: {
    backgroundColor: colors.status.success,
  },
  rejectBtn: {
    backgroundColor: colors.status.error,
  },
  // Modal de rechazo
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xxl,
  },
  reasonInput: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickReasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickReasonSelected: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: colors.status.error,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  modalCancelBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  modalConfirmBtn: {
    flex: 1,
  },
});
