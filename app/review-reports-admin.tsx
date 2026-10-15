import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AppText,
  AppButton,
  EmptyState,
  ErrorState,
  SkeletonList,
  toast,
  colors,
  spacing,
  radius,
} from '~/components/ds';
import {
  fetchPendingReviewReports,
  removeResolvedReports,
  resolveReviewReport,
  reviewReportReasonLabel,
  type PendingReviewReport,
  type ReviewReportAction,
} from '~/services/moderation';
import { formatRelativeDate } from '~/utils/dateFormat';

/**
 * Cola de reseñas reportadas (App Store 1.2: actuar sobre los reportes).
 * Solo la ven los super admin: la RLS de review_reports devuelve a cualquier
 * otro usuario únicamente sus propios reportes, y la RPC
 * admin_resolve_review_report rechaza a quien no sea super admin.
 */
export default function ReviewReportsAdminScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<PendingReviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchPendingReviewReports();
      setReports(data);
      setLoadError(false);
    } catch (error) {
      console.error('❌ Error cargando reportes de reseñas:', error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const resolve = useCallback(async (report: PendingReviewReport, action: ReviewReportAction) => {
    setBusyId(report.id);
    const result = await resolveReviewReport(report.id, action);
    setBusyId(null);

    if (!result.ok) {
      toast.supabaseError(result.error, 'No se pudo resolver el reporte');
      return;
    }

    // Al eliminar la reseña se cierran también los demás reportes de esa reseña
    setReports((prev) => removeResolvedReports(prev, report, action));
    toast.success(action === 'remove_review' ? 'Reseña eliminada' : 'Reporte descartado');
  }, []);

  const confirmRemove = useCallback(
    (report: PendingReviewReport) => {
      Alert.alert(
        'Eliminar reseña',
        'La reseña se borrará para todos los usuarios y se recalculará la valoración del bar.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => resolve(report, 'remove_review'),
          },
        ]
      );
    },
    [resolve]
  );

  const renderItem = ({ item }: { item: PendingReviewReport }) => {
    const busy = busyId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="flag-outline" size={18} color={colors.status.error} />
          <AppText variant="label" style={styles.flex}>
            {reviewReportReasonLabel(item.reason)}
          </AppText>
          <AppText variant="caption" color={colors.text.secondary}>
            {formatRelativeDate(item.created_at)}
          </AppText>
        </View>

        {item.bar?.name ? (
          <AppText variant="caption" color={colors.text.secondary}>
            {item.bar.name}
          </AppText>
        ) : null}

        <View style={styles.quote}>
          <AppText variant="body">
            {item.review_comment ? `“${item.review_comment}”` : 'Reseña sin texto'}
          </AppText>
        </View>

        {item.message ? (
          <AppText variant="caption" color={colors.text.secondary}>
            Comentario del usuario: {item.message}
          </AppText>
        ) : null}

        {item.review_id ? (
          <View style={styles.actions}>
            <View style={styles.flex}>
              <AppButton
                text="Descartar"
                variant="outline"
                disabled={busy}
                onPress={() => resolve(item, 'dismiss')}
              />
            </View>
            <View style={styles.flex}>
              <AppButton
                text="Eliminar reseña"
                variant="primary"
                loading={busy}
                disabled={busy}
                onPress={() => confirmRemove(item)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <AppText variant="caption" color={colors.text.secondary} style={styles.flex}>
              La reseña ya no existe.
            </AppText>
            <AppButton
              text="Cerrar reporte"
              variant="outline"
              fullWidth={false}
              disabled={busy}
              onPress={() => resolve(item, 'dismiss')}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="h2">Reseñas reportadas</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <SkeletonList count={3} />
      ) : loadError ? (
        <ErrorState
          title="No se pudieron cargar los reportes"
          subtitle="Comprueba tu conexión e inténtalo de nuevo."
          onRetry={() => {
            setLoading(true);
            load().finally(() => setLoading(false));
          }}
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={reports.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-outline"
              title="No hay reseñas reportadas"
              subtitle="Cuando un usuario reporte una reseña aparecerá aquí."
            />
          }
        />
      )}
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
  headerSpacer: {
    width: 28,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.elevated,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quote: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
