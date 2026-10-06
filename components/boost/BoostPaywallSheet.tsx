import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import type { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText, ErrorState, SkeletonBox, colors, spacing, radius, toast } from '~/components/ds';
import { BoostPackageInfo, BoostPurchaseResult, useBoostOfferings } from '~/hooks/useBoostOfferings';
import type { BoostPlan } from '~/utils/boostPlans';

interface BoostPaywallSheetProps {
  isVisible: boolean;
  onClose: () => void;
  barId: string;
  userId: string;
  /** Fin del boost activo, si lo hay: el nuevo se suma a continuación. */
  activeUntil?: string | null;
  onPurchaseComplete?: () => void;
}

const SNAP_POINTS = ['92%'];

const BLUE = colors.brand.primary;
const GOLD = colors.status.boost;
const GOLD_DEEP = colors.status.warning;
const GO = colors.status.success;

const PLAN_COPY: Record<BoostPlan, { title: string; duration: string; hint: string }> = {
  '7d': { title: '1 semana', duration: '7 días', hint: 'Para un partido gordo' },
  '1m': { title: '1 mes', duration: '30 días', hint: 'Toda una jornada de liga' },
  '1y': { title: 'Temporada', duration: '12 meses', hint: 'Arriba todo el año' },
};

const POPULAR_PLAN: BoostPlan = '1m';

const BENEFITS = [
  { icon: 'arrow-up-circle' as const, title: 'Sales arriba', text: 'Antes que el resto en el mapa y en la búsqueda.' },
  { icon: 'star' as const, title: 'Insignia «Destacado»', text: 'Tu ficha se ve distinta y llama más la atención.' },
  { icon: 'football' as const, title: 'Más gente los días de partido', text: 'Te encuentran quienes buscan bar en ese momento.' },
];

const STORE_NAME = Platform.OS === 'ios' ? 'Apple' : 'Google Play';

type Result = Exclude<BoostPurchaseResult, { outcome: 'cancelled' } | { outcome: 'failed' }>;

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const ERROR_COPY: Record<string, [string, string]> = {
  network: ['Sin conexión', 'Revisa tu conexión y vuelve a intentarlo.'],
  not_allowed: ['Compras desactivadas', 'Este dispositivo no permite compras dentro de apps.'],
  store: ['La tienda no responde', `No se pudo completar con ${STORE_NAME}. Prueba en un momento.`],
  unknown: ['No se pudo completar la compra', 'No se te ha cobrado. Vuelve a intentarlo.'],
};

export default function BoostPaywallSheet({
  isVisible,
  onClose,
  barId,
  userId,
  activeUntil,
  onPurchaseComplete,
}: BoostPaywallSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { packages, isLoading, error, reload, purchaseBoost, isPurchasing } = useBoostOfferings();
  const [selectedPlan, setSelectedPlan] = useState<BoostPlan>(POPULAR_PLAN);
  const [result, setResult] = useState<Result | null>(null);

  const selected = useMemo<BoostPackageInfo | undefined>(
    () => packages.find((p) => p.plan === selectedPlan) ?? packages[0],
    [packages, selectedPlan],
  );

  useEffect(() => {
    if (isVisible) {
      setResult(null);
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
        opacity={0.65}
        pressBehavior={isPurchasing ? 'none' : 'close'}
      />
    ),
    [isPurchasing],
  );

  const handleSelect = useCallback((plan: BoostPlan) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedPlan(plan);
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!selected || isPurchasing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const res = await purchaseBoost(selected.pkg, barId, userId);
    switch (res.outcome) {
      case 'cancelled':
        return;
      case 'failed': {
        const [title, message] = ERROR_COPY[res.errorKind] ?? ERROR_COPY.unknown;
        toast.error(title, message);
        return;
      }
      default:
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setResult(res);
        onPurchaseComplete?.();
    }
  }, [selected, isPurchasing, purchaseBoost, barId, userId, onPurchaseComplete]);

  const handleClose = useCallback(() => {
    if (isPurchasing) return;
    sheetRef.current?.dismiss();
  }, [isPurchasing]);

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      if (result || error || (!isLoading && !selected)) return null;
      return (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <TouchableOpacity
              onPress={handlePurchase}
              disabled={isLoading || isPurchasing || !selected}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={selected ? `Activar boost de ${PLAN_COPY[selected.plan].title} por ${selected.priceString}` : 'Activar boost'}
              style={[styles.cta, (isLoading || !selected) && styles.ctaDisabled]}
            >
              <LinearGradient
                colors={[GOLD, GOLD_DEEP]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                {isPurchasing ? (
                  <>
                    <ActivityIndicator size="small" color={colors.bg.primary} />
                    <AppText maxScale={1.0} style={styles.ctaText}>Procesando pago…</AppText>
                  </>
                ) : (
                  <>
                    <Ionicons name="flash" size={18} color={colors.bg.primary} />
                    <AppText maxScale={1.0} style={styles.ctaText} numberOfLines={1}>
                      {selected ? `Activar · ${selected.priceString}` : 'Activar Boost'}
                    </AppText>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <AppText variant="caption" color={colors.text.muted} align="center" maxScale={1.0} style={styles.legal}>
              Pago único con tu cuenta de {STORE_NAME}. Sin suscripción ni renovación automática.
            </AppText>
          </View>
        </BottomSheetFooter>
      );
    },
    [result, error, isLoading, selected, isPurchasing, insets.bottom, handlePurchase],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose={!isPurchasing}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(25,118,210,0.22)', 'rgba(25,118,210,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.5 }}
        style={styles.glow}
      />

      <TouchableOpacity
        onPress={handleClose}
        style={styles.closeButton}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        disabled={isPurchasing}
      >
        <Ionicons name="close" size={18} color={colors.text.secondary} />
      </TouchableOpacity>

      {result ? (
        <SuccessView result={result} onDone={handleClose} bottomInset={insets.bottom} />
      ) : (
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroIconShadow}>
              <LinearGradient colors={[GOLD, GOLD_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
                <Ionicons name="flash" size={30} color={colors.bg.primary} />
              </LinearGradient>
            </View>
            <AppText maxScale={1.0} style={styles.eyebrow}>BOOST DE VISIBILIDAD</AppText>
            <AppText variant="h1" align="center" maxScale={1.1} style={styles.heroTitle}>
              Pon tu bar <AppText variant="h1" maxScale={1.1} style={styles.heroTitleAccent}>primero</AppText>
            </AppText>
            <AppText variant="body" align="center" maxScale={1.2} style={styles.heroSubtitle}>
              Cuando alguien busque dónde ver el partido cerca, tu bar sale arriba.
            </AppText>
          </View>

          {activeUntil && (
            <View style={styles.activeBanner}>
              <Ionicons name="flash" size={16} color={GOLD} />
              <AppText variant="caption" color={colors.text.light} maxScale={1.2} style={styles.flex}>
                Tienes un boost activo hasta el <AppText variant="caption" color={GOLD} style={styles.bold}>{formatDate(activeUntil)}</AppText>. Si compras otro, se suma a continuación.
              </AppText>
            </View>
          )}

          {/* Benefits */}
          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={18} color={GOLD} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="label" color={colors.text.primary} maxScale={1.2}>{b.title}</AppText>
                  <AppText variant="caption" color={colors.text.secondary} maxScale={1.2}>{b.text}</AppText>
                </View>
              </View>
            ))}
          </View>

          {/* Plans */}
          <AppText maxScale={1.0} style={styles.sectionLabel}>ELIGE CUÁNTO TIEMPO</AppText>

          {isLoading ? (
            <View style={styles.plans}>
              {[0, 1, 2].map((i) => (
                <SkeletonBox key={i} width="100%" height={76} borderRadius={radius.xxl} />
              ))}
            </View>
          ) : error || packages.length === 0 ? (
            <ErrorState
              title="No hemos podido cargar los planes"
              subtitle="Comprueba tu conexión y vuelve a intentarlo."
              onRetry={reload}
            />
          ) : (
            <View style={styles.plans} accessibilityRole="radiogroup">
              {packages.map((item) => (
                <PlanCard
                  key={item.pkg.identifier}
                  item={item}
                  selected={selected?.plan === item.plan}
                  popular={item.plan === POPULAR_PLAN}
                  disabled={isPurchasing}
                  onPress={() => handleSelect(item.plan)}
                />
              ))}
            </View>
          )}

          <View style={styles.trustRow}>
            {[
              { icon: 'lock-closed-outline' as const, label: 'Pago seguro' },
              { icon: 'refresh-circle-outline' as const, label: 'Sin renovación' },
              { icon: 'flash-outline' as const, label: 'Activo en segundos' },
            ].map((t) => (
              <View key={t.label} style={styles.trustItem}>
                <Ionicons name={t.icon} size={14} color={colors.text.muted} />
                <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>{t.label}</AppText>
              </View>
            ))}
          </View>
        </BottomSheetScrollView>
      )}
    </BottomSheetModal>
  );
}

function PlanCard({
  item,
  selected,
  popular,
  disabled,
  onPress,
}: {
  item: BoostPackageInfo;
  selected: boolean;
  popular: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const copy = PLAN_COPY[item.plan];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${copy.title}, ${item.priceString}${item.savingsPct ? `, ahorras un ${item.savingsPct} por ciento` : ''}`}
      style={[styles.planCard, selected && styles.planCardSelected]}
    >
      {popular && (
        <View style={styles.sticker}>
          <AppText maxScale={1.0} style={styles.stickerText}>EL MÁS ELEGIDO</AppText>
        </View>
      )}

      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>

      <View style={styles.flex}>
        <View style={styles.planTitleRow}>
          <AppText variant="subtitle" color={colors.text.primary} maxScale={1.1}>{copy.title}</AppText>
          {item.savingsPct !== null && (
            <View style={styles.savingsChip}>
              <AppText maxScale={1.0} style={styles.savingsText}>−{item.savingsPct}%</AppText>
            </View>
          )}
        </View>
        <AppText variant="caption" color={colors.text.secondary} maxScale={1.1}>
          {copy.duration} · {copy.hint}
        </AppText>
      </View>

      <View style={styles.priceCol}>
        <AppText maxScale={1.0} style={styles.price}>{item.priceString}</AppText>
        {item.weeklyPriceString && (
          <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
            {item.weeklyPriceString}/sem
          </AppText>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SuccessView({ result, onDone, bottomInset }: { result: Result; onDone: () => void; bottomInset: number }) {
  const content =
    result.outcome === 'active'
      ? {
          icon: 'checkmark' as const,
          tint: GO,
          title: '¡Tu bar ya está arriba!',
          text: result.endAt
            ? `El boost está activo hasta el ${formatDate(result.endAt)}. A por el próximo partido.`
            : 'El boost ya está activo. A por el próximo partido.',
        }
      : result.outcome === 'processing'
        ? {
            icon: 'checkmark' as const,
            tint: GO,
            title: 'Pago recibido',
            text: 'Estamos activando tu boost. Tardará unos segundos en verse en el mapa.',
          }
        : {
            icon: 'time-outline' as const,
            tint: GOLD,
            title: 'Pago pendiente',
            text: `${STORE_NAME} tiene que aprobar el pago. Lo activamos solo en cuanto llegue; no tienes que hacer nada.`,
          };

  return (
    <View style={[styles.success, { paddingBottom: Math.max(bottomInset, spacing.lg) }]}>
      <View style={styles.successBody}>
        <View style={[styles.successIcon, { backgroundColor: `${content.tint}22`, borderColor: `${content.tint}55` }]}>
          <Ionicons name={content.icon} size={44} color={content.tint} />
        </View>
        <AppText variant="h2" align="center" maxScale={1.1}>{content.title}</AppText>
        <AppText variant="body" align="center" maxScale={1.2} style={styles.successText}>{content.text}</AppText>
      </View>
      <TouchableOpacity onPress={onDone} activeOpacity={0.85} style={styles.doneButton} accessibilityRole="button">
        <AppText maxScale={1.0} style={styles.doneText}>Listo</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  sheetBackground: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    backgroundColor: colors.border.medium,
    width: 36,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.lg,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: radius.round,
    backgroundColor: colors.bg.element,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 150, // hueco para el footer fijo
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroIconShadow: {
    marginBottom: spacing.lg,
    shadowColor: GOLD_DEEP,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  eyebrow: {
    color: colors.text.soft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroTitleAccent: {
    color: GOLD,
    fontStyle: 'italic',
  },
  heroSubtitle: {
    paddingHorizontal: spacing.lg,
  },

  // Active boost
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  // Benefits
  benefits: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Plans
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: spacing.md,
  },
  plans: {
    gap: spacing.md,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xxl,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  planCardSelected: {
    borderColor: BLUE,
    backgroundColor: 'rgba(25, 118, 210, 0.12)',
  },
  sticker: {
    position: 'absolute',
    top: -11,
    right: spacing.lg,
    backgroundColor: GOLD_DEEP,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    transform: [{ rotate: '-3deg' }],
  },
  stickerText: {
    color: colors.bg.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: BLUE,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BLUE,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  savingsChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  savingsText: {
    color: GO,
    fontSize: 11,
    fontWeight: '700',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Trust
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  // Footer
  footer: {
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cta: {
    height: 54,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    shadowColor: GOLD_DEEP,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ctaText: {
    color: colors.bg.primary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  legal: {
    marginTop: spacing.sm,
    lineHeight: 17,
  },

  // Success
  success: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  successText: {
    paddingHorizontal: spacing.lg,
  },
  doneButton: {
    height: 54,
    borderRadius: radius.xxl,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
});
