import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import { Ionicons } from '@expo/vector-icons';
import { AppText, AppButton, colors, spacing, radius, typography } from '~/components/ds';
import {
  useBoostOfferings,
  AVG_PROFIT_PER_CUSTOMER_EUR,
  type BoostPackageInfo,
} from '~/hooks/useBoostOfferings';

interface BoostPaywallSheetProps {
  isVisible: boolean;
  onClose: () => void;
  barId: string;
  userId: string;
  onPurchaseComplete?: () => void;
}

const SNAP_POINTS = ['95%'];

// Tinte suave del oro de boost para fondos (colors.status.boost al ~8%).
const BOOST_TINT = 'rgba(255, 215, 0, 0.08)';
const SUCCESS_TINT = 'rgba(16, 185, 129, 0.12)';

const BENEFITS = [
  { icon: 'arrow-up-circle' as const, label: 'Primero en\nbúsquedas' },
  { icon: 'star' as const, label: 'Badge\ndestacado' },
  { icon: 'people' as const, label: 'Más\nclientes' },
  { icon: 'bar-chart' as const, label: 'Mayor\nvisibilidad' },
];

const PLAN_FEATURES: Record<BoostPackageInfo['plan'], string[]> = {
  '7d': ['Posición prioritaria en el mapa', 'Badge "Destacado" visible', 'Apareces antes en búsquedas'],
  '1m': ['Todo lo del plan semanal', 'Ideal para jornadas y partidos clave', 'Mejor relación calidad-precio'],
  '1y': ['Todo lo del plan mensual', 'Destacado durante toda la temporada', 'El precio por mes más bajo'],
};

export default function BoostPaywallSheet({
  isVisible,
  onClose,
  barId,
  userId,
  onPurchaseComplete,
}: BoostPaywallSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { packages, isLoading, error, purchaseBoost, isPurchasing, purchasingId } =
    useBoostOfferings();

  useEffect(() => {
    if (isVisible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [isVisible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetDefaultBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  const handlePurchase = useCallback(
    async (pkgInfo: BoostPackageInfo) => {
      const success = await purchaseBoost(pkgInfo.pkg, barId, userId);
      if (success) {
        sheetRef.current?.dismiss();
        onPurchaseComplete?.();
      }
    },
    [purchaseBoost, barId, userId, onPurchaseComplete],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Ionicons name="close" size={20} color={colors.text.secondary} />
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="flash" size={32} color={colors.status.boost} />
          </View>
          <AppText variant="h1" align="center" maxScale={1.1} style={styles.heroTitle}>
            Impulsa tu bar
          </AppText>
          <AppText variant="body" align="center" maxScale={1.1} style={styles.heroSubtitle}>
            Aparece primero cuando los usuarios buscan dónde ver el partido
          </AppText>
        </View>

        {/* Benefits strip */}
        <View style={styles.benefitsRow}>
          {BENEFITS.map((b) => (
            <View key={b.label} style={styles.benefitPill}>
              <Ionicons name={b.icon} size={20} color={colors.status.boost} />
              <AppText variant="caption" color={colors.text.light} align="center" maxScale={1.0} style={styles.benefitLabel}>
                {b.label}
              </AppText>
            </View>
          ))}
        </View>

        <AppText variant="subtitle" maxScale={1.1} style={styles.sectionTitle}>
          Elige tu plan
        </AppText>

        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.status.boost} />
            <AppText variant="caption">Cargando productos...</AppText>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.status.error} />
            <AppText variant="body" align="center">
              No se han podido cargar los productos. Comprueba la conexión.
            </AppText>
          </View>
        ) : (
          packages.map((item) => {
            const isThisPurchasing = isPurchasing && purchasingId === item.pkg.identifier;
            const features = PLAN_FEATURES[item.plan] ?? [];

            return (
              <View
                key={item.pkg.identifier}
                style={[styles.card, item.isPopular && styles.cardPopular]}
              >
                {item.isPopular && (
                  <View style={styles.popularBadge}>
                    <Ionicons name="star" size={11} color={colors.text.inverse} />
                    <AppText maxScale={1.0} style={styles.popularText}>
                      MÁS POPULAR
                    </AppText>
                  </View>
                )}

                {/* Card header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconWrap}>
                    <Ionicons
                      name={`${item.icon}-outline` as any}
                      size={20}
                      color={colors.status.boost}
                    />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <AppText variant="subtitle" maxScale={1.1}>
                      {item.title}
                    </AppText>
                    <AppText variant="caption" maxScale={1.0}>
                      {item.duration}
                    </AppText>
                  </View>
                  {item.savingsBadge && (
                    <View style={styles.savingsBadge}>
                      <AppText variant="label" color={colors.status.success} maxScale={1.0}>
                        {item.savingsBadge}
                      </AppText>
                    </View>
                  )}
                </View>

                {/* Price */}
                <View style={styles.priceRow}>
                  <View>
                    <AppText style={styles.price} maxScale={1.0}>
                      {item.price}
                    </AppText>
                    {item.pricePerMonth && (
                      <AppText variant="caption" maxScale={1.0}>
                        Equivale a {item.pricePerMonth}
                      </AppText>
                    )}
                  </View>
                  <View style={styles.roiPill}>
                    <Ionicons name="trending-up-outline" size={13} color={colors.status.success} />
                    <AppText variant="caption" color={colors.status.success} maxScale={1.0} style={styles.roiText}>
                      {item.amortization}
                    </AppText>
                  </View>
                </View>

                {/* Features list */}
                <View style={styles.featuresList}>
                  {features.map((feat) => (
                    <View key={feat} style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={15} color={colors.status.boost} />
                      <AppText variant="caption" color={colors.text.secondary} maxScale={1.0} style={styles.featureText}>
                        {feat}
                      </AppText>
                    </View>
                  ))}
                </View>

                <AppButton
                  text="Activar Boost"
                  variant={item.isPopular ? 'primary' : 'dark'}
                  onPress={() => handlePurchase(item)}
                  loading={isThisPurchasing}
                  disabled={isPurchasing}
                />
              </View>
            );
          })
        )}

        {/* ROI note */}
        <View style={styles.roiNote}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.muted} />
          <AppText variant="caption" maxScale={1.0} style={styles.roiNoteText}>
            Cada cliente nuevo genera ~{AVG_PROFIT_PER_CUSTOMER_EUR}€ de beneficio medio. El Boost se amortiza rápidamente.
          </AppText>
        </View>

        {/* Trust row */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.text.muted} />
            <AppText variant="caption" maxScale={1.0}>Sin suscripción</AppText>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.text.muted} />
            <AppText variant="caption" maxScale={1.0}>Pago seguro</AppText>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="flash-outline" size={16} color={colors.text.muted} />
            <AppText variant="caption" maxScale={1.0}>Se activa en segundos</AppText>
          </View>
        </View>

        <AppText variant="caption" align="center" maxScale={1.0} style={styles.legalText}>
          Pago único con tu cuenta de Apple / Google. Sin renovación automática.
        </AppText>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  handleIndicator: {
    backgroundColor: colors.border.medium,
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.xs,
    marginTop: spacing.xs,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    paddingTop: spacing.xs,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: BOOST_TINT,
    borderWidth: 1,
    borderColor: colors.alpha.boostGlow,
  },
  heroTitle: {
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    paddingHorizontal: spacing.md,
  },

  // Benefits
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  benefitPill: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  benefitLabel: {
    fontSize: typography.size.sm,
  },

  sectionTitle: {
    marginBottom: spacing.md,
  },

  // Loading / Error
  stateContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },

  // Card
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardPopular: {
    borderColor: colors.status.boost,
    backgroundColor: colors.bg.surface,
    marginTop: spacing.sm,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.status.boost,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  popularText: {
    color: colors.text.inverse,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BOOST_TINT,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  savingsBadge: {
    backgroundColor: SUCCESS_TINT,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  price: {
    color: colors.text.primary,
    fontSize: typography.size.h1,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.heading,
  },
  roiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: SUCCESS_TINT,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexShrink: 1,
  },
  roiText: {
    maxWidth: 130,
  },

  // Features
  featuresList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    flex: 1,
    lineHeight: typography.lineHeight.tight,
  },

  // ROI note
  roiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  roiNoteText: {
    flex: 1,
    lineHeight: typography.lineHeight.tight,
  },

  // Trust
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: radius.round,
    backgroundColor: colors.border.medium,
  },
  legalText: {
    lineHeight: typography.lineHeight.tight,
  },
});
