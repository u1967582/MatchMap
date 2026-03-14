import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import {
  AppText,
  AppButton,
  colors,
  spacing,
  radius,
  toast,
} from '~/components/ds';

interface BarInfo {
  id: string;
  name: string;
  address: string;
  city: string;
  image_url?: string;
}

interface ActiveBoost {
  id: string;
  plan: string;
  end_at: string;
}

const PLANS = [
  {
    id: '7d' as const,
    label: '7 Días',
    icon: 'flash-outline' as const,
    description: 'Boost de 7 días',
  },
  {
    id: '1m' as const,
    label: '1 Mes',
    icon: 'flash' as const,
    description: 'Boost de 30 días',
  },
  {
    id: '1y' as const,
    label: '1 Año',
    icon: 'star' as const,
    description: 'Boost de 365 días',
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminGiftBoostDetailScreen() {
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const router = useRouter();

  const [barInfo, setBarInfo] = useState<BarInfo | null>(null);
  const [activeBoost, setActiveBoost] = useState<ActiveBoost | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'7d' | '1m' | '1y' | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { data: bar, error: barError } = await supabase
        .from('bars')
        .select('id, name, address, city, bar_images(image_url, image_order)')
        .eq('id', barId)
        .single();

      if (barError || !bar) {
        toast.error('No se pudo cargar el bar');
        router.back();
        return;
      }

      setBarInfo({
        id: bar.id,
        name: bar.name,
        address: bar.address,
        city: bar.city,
        image_url: bar.bar_images?.[0]?.image_url || null,
      });

      const { data: boosts } = await supabase
        .from('bar_boosts')
        .select('id, plan, end_at')
        .eq('bar_id', barId)
        .eq('status', 'active')
        .gt('end_at', now)
        .order('end_at', { ascending: false })
        .limit(1);

      if (boosts && boosts.length > 0) {
        setActiveBoost(boosts[0]);
      } else {
        setActiveBoost(null);
      }
    } catch (err) {
      console.error('❌ Error loading bar data:', err);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [barId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGiftBoost = useCallback(() => {
    if (!selectedPlan || !barInfo) return;

    const planLabel = PLANS.find((p) => p.id === selectedPlan)?.label ?? selectedPlan;
    const actionText = activeBoost
      ? `Se cancelará el boost actual y se regalará un boost de ${planLabel} a ${barInfo.name}.`
      : `Se regalará un boost de ${planLabel} a ${barInfo.name}.`;

    Alert.alert('Confirmar regalo', actionText, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Regalar',
        style: 'default',
        onPress: async () => {
          setSaving(true);
          try {
            const { error } = await supabase.rpc('fn_admin_gift_boost', {
              _bar_id: barId,
              _plan: selectedPlan,
            });

            if (error) {
              toast.supabaseError(error, 'No se pudo regalar el boost');
              return;
            }

            toast.success('Boost regalado correctamente', `${barInfo.name} · ${planLabel}`);
            router.back();
          } catch (err) {
            console.error('❌ Error gifting boost:', err);
            toast.error('Error al regalar el boost');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [selectedPlan, barInfo, activeBoost, barId, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <AppText variant="title">Regalar Boost</AppText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!barInfo) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">Regalar Boost</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Bar info */}
        <View style={styles.barCard}>
          {barInfo.image_url ? (
            <Image source={{ uri: barInfo.image_url }} style={styles.barImage} />
          ) : (
            <View style={styles.barImagePlaceholder}>
              <Ionicons name="business-outline" size={40} color={colors.text.muted} />
            </View>
          )}
          <View style={styles.barDetails}>
            <AppText variant="subtitle">{barInfo.name}</AppText>
            <AppText variant="caption" color={colors.text.secondary}>
              {barInfo.address}, {barInfo.city}
            </AppText>
          </View>
        </View>

        {/* Current boost status */}
        {activeBoost ? (
          <View style={styles.activeBoostBanner}>
            <Ionicons name="flash" size={18} color={colors.status.boost} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <AppText variant="label" color={colors.status.boost}>
                Boost activo
              </AppText>
              <AppText variant="caption" color={colors.text.secondary}>
                Plan {PLANS.find((p) => p.id === activeBoost.plan)?.label ?? activeBoost.plan} ·
                Hasta el {formatDate(activeBoost.end_at)}
              </AppText>
            </View>
          </View>
        ) : (
          <View style={styles.noBoostBanner}>
            <Ionicons name="flash-off-outline" size={18} color={colors.text.muted} />
            <AppText
              variant="caption"
              color={colors.text.muted}
              style={{ marginLeft: spacing.sm }}>
              Sin boost activo
            </AppText>
          </View>
        )}

        {/* Plan selection */}
        <AppText variant="subtitle" style={styles.sectionTitle}>
          Seleccionar plan
        </AppText>

        <View style={styles.plansContainer}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.8}>
                <View style={styles.planIconContainer}>
                  <Ionicons
                    name={plan.icon}
                    size={24}
                    color={isSelected ? colors.status.boost : colors.text.muted}
                  />
                </View>
                <AppText
                  variant="body"
                  color={isSelected ? colors.status.boost : colors.text.primary}
                  style={styles.planLabel}>
                  {plan.label}
                </AppText>
                <AppText variant="caption" color={colors.text.secondary}>
                  {plan.description}
                </AppText>
                {isSelected && (
                  <View style={styles.planCheckmark}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.status.boost} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeBoost && selectedPlan && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.status.warning} />
            <AppText
              variant="caption"
              color={colors.status.warning}
              style={{ marginLeft: spacing.sm, flex: 1 }}>
              El boost activo actual se cancelará y se reemplazará por el nuevo plan.
            </AppText>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <AppButton
          text={saving ? 'Regalando...' : 'Regalar Boost'}
          onPress={handleGiftBoost}
          disabled={!selectedPlan || saving}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  barCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  barImage: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
  },
  barImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barDetails: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  activeBoostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  noBoostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.lg,
  },
  plansContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.status.boost,
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
  },
  planIconContainer: {
    marginBottom: spacing.sm,
  },
  planLabel: {
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  planCheckmark: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.bg.elevated,
  },
});
