import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import { Ionicons } from '@expo/vector-icons';
import { AppText, colors, spacing, radius } from '~/components/ds';
import { useBoostOfferings } from '~/hooks/useBoostOfferings';
import Gradient from '~/components/ui/Gradient';

interface BoostPaywallSheetProps {
  isVisible: boolean;
  onClose: () => void;
  barId: string;
  userId: string;
  onPurchaseComplete?: () => void;
}

const SNAP_POINTS = ['95%'];

const BENEFITS = [
  { icon: 'arrow-up-circle' as const, label: 'Primero en\nbúsquedas', color: '#4ADE80' },
  { icon: 'star' as const, label: 'Badge\ndestacado', color: '#FFD700' },
  { icon: 'people' as const, label: 'Más\nclientes', color: '#60A5FA' },
  { icon: 'bar-chart' as const, label: 'Mayor\nvisibilidad', color: '#A78BFA' },
];

const PLAN_FEATURES: Record<string, string[]> = {
  flash: ['Posición prioritaria en el mapa', 'Badge "Destacado" visible', 'Apareces antes en búsquedas'],
  'trending-up': ['Todo lo del plan semanal', 'Mayor prioridad en resultados', 'Ideal para eventos y partidos', 'Mejor relación calidad-precio'],
  sparkles: ['Todo lo del plan mensual', 'Prioridad máxima todo el año', 'Ideal para bares de temporada', 'Ahorro del 44% vs mensual'],
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
    async (pkgInfo: typeof packages[number]) => {
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
        <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
          <Ionicons name="close" size={20} color={colors.text.secondary} />
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Gradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIconGradient}
            >
              <Ionicons name="flash" size={32} color="#fff" />
            </Gradient>
          </View>
          <AppText variant="h1" color={colors.text.primary} align="center" maxScale={1.1} style={styles.heroTitle}>
            Impulsa tu bar
          </AppText>
          <AppText variant="body" color={colors.text.secondary} align="center" maxScale={1.1} style={styles.heroSubtitle}>
            Aparece primero cuando los usuarios buscan dónde ver el partido
          </AppText>
        </View>

        {/* Benefits strip */}
        <View style={styles.benefitsRow}>
          {BENEFITS.map((b) => (
            <View key={b.label} style={styles.benefitPill}>
              <Ionicons name={b.icon} size={20} color={b.color} />
              <AppText maxScale={1.0} style={[styles.benefitLabel, { color: b.color }]}>
                {b.label}
              </AppText>
            </View>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Plans */}
        <AppText variant="subtitle" color={colors.text.primary} style={styles.sectionTitle} maxScale={1.1}>
          Elige tu plan
        </AppText>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <AppText variant="caption" color={colors.text.muted} style={styles.loadingText}>
              Cargando productos...
            </AppText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.status.error} />
            <AppText variant="body" color={colors.text.secondary} style={styles.errorText}>
              No se han podido cargar los productos. Comprueba la conexión.
            </AppText>
          </View>
        ) : (
          packages.map((item) => {
            const isThisPurchasing = isPurchasing && purchasingId === item.pkg.identifier;
            const isOtherPurchasing = isPurchasing && purchasingId !== item.pkg.identifier;
            const accentColor = item.isPopular ? '#A78BFA' : colors.brand.primary;
            const features = PLAN_FEATURES[item.icon] ?? [];

            return (
              <View
                key={item.pkg.identifier}
                style={[styles.card, item.isPopular && styles.cardPopular]}
              >
                {item.isPopular && (
                  <View style={styles.popularBadge}>
                    <Ionicons name="star" size={11} color="#fff" />
                    <AppText maxScale={1.0} style={styles.popularText}>
                      MÁS POPULAR
                    </AppText>
                  </View>
                )}

                {/* Card header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: `${accentColor}18` }]}>
                    <Ionicons
                      name={`${item.icon}-outline` as any}
                      size={20}
                      color={accentColor}
                    />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <AppText variant="subtitle" color={colors.text.primary} maxScale={1.1}>
                      {item.title}
                    </AppText>
                    <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                      {item.duration}
                    </AppText>
                  </View>
                  {item.savingsBadge && (
                    <View style={styles.savingsBadge}>
                      <AppText maxScale={1.0} style={styles.savingsText}>
                        {item.savingsBadge}
                      </AppText>
                    </View>
                  )}
                </View>

                {/* Price */}
                <View style={styles.priceRow}>
                  <AppText style={[styles.price, { color: accentColor }]} maxScale={1.0}>
                    {item.price}
                  </AppText>
                  <View style={styles.roiPill}>
                    <Ionicons name="trending-up-outline" size={13} color="#4ADE80" />
                    <AppText maxScale={1.0} style={styles.roiText}>
                      {item.amortization}
                    </AppText>
                  </View>
                </View>

                {/* Features list */}
                <View style={styles.featuresList}>
                  {features.map((feat) => (
                    <View key={feat} style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={15} color={accentColor} />
                      <AppText variant="caption" color={colors.text.secondary} maxScale={1.0} style={styles.featureText}>
                        {feat}
                      </AppText>
                    </View>
                  ))}
                </View>

                {/* Buy button */}
                <TouchableOpacity
                  onPress={() => handlePurchase(item)}
                  disabled={isPurchasing}
                  activeOpacity={0.85}
                  style={[styles.buyButton, isOtherPurchasing && styles.buyButtonDisabled]}
                >
                  {isThisPurchasing ? (
                    <View style={[styles.buyButtonLoading, { backgroundColor: item.buttonColors[0] }]}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : (
                    <Gradient
                      colors={item.buttonColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buyButtonGradient}
                    >
                      <Ionicons name="flash-outline" size={16} color="#fff" />
                      <AppText maxScale={1.0} style={styles.buyButtonText}>
                        Activar Boost
                      </AppText>
                    </Gradient>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* ROI note */}
        <View style={styles.roiNote}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.muted} />
          <AppText variant="caption" color={colors.text.muted} style={styles.roiNoteText} maxScale={1.0}>
            Cada cliente nuevo genera ~13€ de beneficio medio. El Boost se amortiza rápidamente.
          </AppText>
        </View>

        {/* Trust row */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.text.muted} />
            <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>Sin suscripción</AppText>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.text.muted} />
            <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>Pago seguro</AppText>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="flash-outline" size={16} color={colors.text.muted} />
            <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>Activo al instante</AppText>
          </View>
        </View>

        <AppText variant="caption" color={colors.text.muted} style={styles.legalText} maxScale={1.0}>
          El pago se cargará en tu cuenta de Apple / Google. Sin renovación automática.
        </AppText>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  heroIconWrap: {
    marginBottom: spacing.md,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  heroIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    lineHeight: 22,
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
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },

  // Loading / Error
  loadingContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    marginTop: spacing.sm,
  },
  errorContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    position: 'relative',
  },
  cardPopular: {
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167, 139, 250, 0.05)',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    marginTop: spacing.sm,
  },
  popularBadge: {
    position: 'absolute',
    top: -13,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: '#8B5CF6',
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  popularText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  savingsBadge: {
    backgroundColor: colors.status.success,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  savingsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  price: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  roiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  roiText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 130,
  },

  // Features
  featuresList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
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
    lineHeight: 18,
  },

  // Buy button
  buyButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 50,
  },
  buyButtonDisabled: {
    opacity: 0.4,
  },
  buyButtonLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  buyButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    lineHeight: 18,
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
    borderRadius: 2,
    backgroundColor: colors.border.medium,
  },
  legalText: {
    textAlign: 'center',
    lineHeight: 16,
  },
});
