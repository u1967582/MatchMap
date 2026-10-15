import React, { useEffect, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '~/utils/supabase';
import { getIsGuest, showGuestLoginAlert } from '~/utils/auth';
import {
  REVIEW_REPORT_REASONS,
  reportReview,
  type ReviewReportReason,
} from '~/services/moderation';
import { AppText, AppButton, toast, colors, spacing, radius } from '~/components/ds';

interface ReviewSummary {
  id: string;
  comment: string | null;
  rating: number;
}

/**
 * Reportar una reseña ofensiva (App Store 1.2). Mismo patrón que
 * app/report-bar/[barId].tsx. Los reportes van a la tabla review_reports y
 * solo los ven los super admin.
 */
export default function ReportReviewScreen() {
  const router = useRouter();
  const { reviewId } = useLocalSearchParams<{ reviewId: string }>();

  const [review, setReview] = useState<ReviewSummary | null>(null);
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reviewId) return;
    (async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id, comment, rating')
        .eq('id', reviewId)
        .maybeSingle();
      if (data) setReview(data as ReviewSummary);
    })();
  }, [reviewId]);

  const handleSubmit = async () => {
    if (!reason) {
      toast.warning('Selecciona un motivo');
      return;
    }
    if (!reviewId) return;

    setLoading(true);
    try {
      if (await getIsGuest()) {
        showGuestLoginAlert(router);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Debes iniciar sesión');
        return;
      }

      const result = await reportReview({
        reviewId,
        reporterId: user.id,
        reason,
        message,
      });

      if (!result.ok && !result.duplicate) {
        toast.supabaseError(result.error, 'No se pudo enviar el reporte');
        return;
      }

      toast.success(
        result.ok ? 'Gracias, revisaremos la reseña' : 'Ya habías reportado esta reseña',
        'Nuestro equipo revisa los reportes en menos de 24 horas'
      );
      router.back();
    } catch (error) {
      console.error('❌ Error reporting review:', error);
      toast.error('No se pudo enviar el reporte', 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="h2">Reportar reseña</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {review?.comment ? (
          <View style={styles.reviewQuote}>
            <AppText variant="caption" color={colors.text.secondary} numberOfLines={4}>
              “{review.comment}”
            </AppText>
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="subtitle" style={styles.sectionTitle}>
            ¿Qué problema tiene esta reseña?
          </AppText>
          <View style={styles.chipsRow}>
            {REVIEW_REPORT_REASONS.map((option) => {
              const isActive = reason === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.reasonChip, isActive && styles.reasonChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReason(option.value);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}>
                  <AppText
                    variant="label"
                    color={isActive ? colors.text.primary : colors.brand.link}>
                    {option.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={styles.sectionTitle}>
            Cuéntanos más (opcional)
          </AppText>
          <View style={styles.textInputWrapper}>
            <TextInput
              placeholder="Explica por qué debemos revisar esta reseña..."
              placeholderTextColor={colors.text.muted}
              value={message}
              onChangeText={setMessage}
              multiline
              style={styles.textInput}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <AppButton
          text={loading ? 'Enviando...' : 'Enviar reporte'}
          onPress={handleSubmit}
          variant="primary"
          loading={loading}
          disabled={!reason || loading}
        />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerSpacer: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  reviewQuote: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.elevated,
  },
  section: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.alpha.brandLight,
  },
  reasonChipActive: {
    backgroundColor: colors.brand.link,
  },
  textInputWrapper: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  textInput: {
    minHeight: 100,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});
