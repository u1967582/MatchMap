import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { fetchBarStatsSummary, fetchBarStatsDaily, fetchBarStatsRangeStart } from '~/services/barAnalytics';
import {
  AppText,
  AppCard,
  AppButton,
  Divider,
  EmptyState,
  SkeletonBox,
  SegmentedControl,
  StatsAreaChart,
  colors,
  spacing,
  radius,
  toast,
} from '~/components/ds';
import type { SegmentedControlOption } from '~/components/ds';
import {
  METRIC_ORDER,
  METRIC_CONFIG,
  sumContactClicks,
  buildChartPoints,
  daysSince,
  formatDayLabel,
  getPeriodLabel,
} from '~/lib/barStats';
import type { MetricKey, StatsSummary, DailyPoint, StatsRangeKey } from '~/lib/barStats';

const RANGE_OPTIONS: SegmentedControlOption<StatsRangeKey>[] = [
  { value: '30', label: '30 días' },
  { value: '90', label: '3 meses' },
  { value: 'all', label: 'Desde inicio' },
];

const METRIC_DESCRIPTIONS: Record<MetricKey, string> = {
  profile_views: 'Cada apertura de la ficha de tu bar por otra persona.',
  contact_clicks: 'Toques en tu teléfono, dirección o web.',
  menu_views: 'Veces que se ha abierto tu carta.',
  unique_visitors: 'Personas distintas que interactuaron en el período.',
  favorites_total: 'Total acumulado en favoritos.',
  reviews_total: 'Total de reseñas recibidas y valoración media.',
};

export default function BarStatsScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();

  const [pageLoading, setPageLoading] = React.useState(true);
  const [authorized, setAuthorized] = React.useState(false);
  const [barName, setBarName] = React.useState('');
  const [summary, setSummary] = React.useState<StatsSummary | null>(null);

  const [selectedMetric, setSelectedMetric] = React.useState<MetricKey>('profile_views');
  const [range, setRange] = React.useState<StatsRangeKey>('30');
  const [daily, setDaily] = React.useState<DailyPoint[]>([]);
  const [statsLoading, setStatsLoading] = React.useState(false);
  const sinceStartDateRef = React.useRef<string | null>(null);

  const [infoModalVisible, setInfoModalVisible] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      if (!barId) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.back();
          return;
        }

        const { data: barData, error: barError } = await supabase
          .from('bars')
          .select('name, owner_id')
          .eq('id', barId)
          .single();

        if (barError || !barData) {
          toast.error('No se pudo cargar el bar');
          setPageLoading(false);
          router.back();
          return;
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('is_super_user')
          .eq('id', user.id)
          .single();

        const canView = barData.owner_id === user.id || !!(userRow as any)?.is_super_user;
        if (!canView) {
          toast.error('No tienes permisos para ver estas estadísticas');
          setPageLoading(false);
          router.back();
          return;
        }

        setBarName(barData.name);
        setAuthorized(true);
      } catch (error) {
        console.error('Error in BarStatsScreen load:', error);
        toast.error('Ocurrió un error al cargar las estadísticas');
        setPageLoading(false);
      }
    };

    load();
  }, [barId, router]);

  React.useEffect(() => {
    if (!authorized || !barId) return;
    let cancelled = false;

    const resolveDays = async (): Promise<number | null> => {
      if (range === '30') return 30;
      if (range === '90') return 90;

      if (!sinceStartDateRef.current) {
        const { data, error } = await fetchBarStatsRangeStart(barId);
        if (error) {
          console.error('Error fetching range start:', error);
          toast.error('No se pudo calcular el rango "desde inicio"');
          return null;
        }
        sinceStartDateRef.current = data as unknown as string;
      }
      return daysSince(sinceStartDateRef.current!);
    };

    const load = async () => {
      setStatsLoading(true);

      const days = await resolveDays();
      if (cancelled) return;
      if (days === null) {
        setStatsLoading(false);
        setPageLoading(false);
        return;
      }

      const [summaryRes, dailyRes] = await Promise.all([
        fetchBarStatsSummary(barId, days),
        fetchBarStatsDaily(barId, days),
      ]);
      if (cancelled) return;

      if (summaryRes.error) console.error('Error fetching stats summary:', summaryRes.error);
      setSummary((summaryRes.data?.[0] as StatsSummary) ?? null);

      if (dailyRes.error) console.error('Error fetching daily stats:', dailyRes.error);
      setDaily((dailyRes.data as DailyPoint[]) ?? []);

      setStatsLoading(false);
      setPageLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [range, authorized, barId]);

  const chartPoints = React.useMemo(() => buildChartPoints(daily, selectedMetric), [daily, selectedMetric]);

  if (pageLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <SkeletonBox width={24} height={24} />
          <SkeletonBox width="40%" height={20} />
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.content}>
          <SkeletonBox width="60%" height={16} style={{ marginBottom: spacing.xl }} />
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBox key={i} width="47%" height={90} borderRadius={radius.xl} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!authorized || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="bar-chart-outline"
          title="Sin estadísticas todavía"
          subtitle="Cuando la gente empiece a interactuar con tu bar, verás los datos aquí."
        />
      </SafeAreaView>
    );
  }

  const cardValues: Record<MetricKey, { value: number; sublabel?: string }> = {
    profile_views: { value: summary.profile_views },
    contact_clicks: { value: sumContactClicks(summary) },
    menu_views: { value: summary.menu_views },
    unique_visitors: { value: summary.unique_visitors },
    favorites_total: {
      value: summary.favorites_count,
      sublabel: summary.favorites_added_period > 0 ? `+${summary.favorites_added_period} en el período` : undefined,
    },
    reviews_total: {
      value: summary.reviews_count,
      sublabel: summary.reviews_count > 0 ? `${summary.avg_rating} ★ media` : undefined,
    },
  };

  const activeMetricConfig = METRIC_CONFIG[selectedMetric];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title" maxScale={1.2}>Estadísticas</AppText>
        <TouchableOpacity style={styles.infoButton} onPress={() => setInfoModalVisible(true)} activeOpacity={0.7}>
          <Ionicons name="information-circle-outline" size={20} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="subtitle" style={styles.barName} maxScale={1.2}>{barName}</AppText>
        <AppText variant="caption" style={styles.periodLabel}>
          {getPeriodLabel(range, sinceStartDateRef.current)}
        </AppText>

        {statsLoading ? (
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBox key={i} width="47%" height={90} borderRadius={radius.xl} />
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {METRIC_ORDER.map((metric) => (
              <StatCard
                key={metric}
                metric={metric}
                value={cardValues[metric].value}
                sublabel={cardValues[metric].sublabel}
                isSelected={selectedMetric === metric}
                onSelect={setSelectedMetric}
              />
            ))}
          </View>
        )}

        <AppCard style={styles.chartCard}>
          <AppText variant="subtitle" style={styles.chartTitle}>
            {activeMetricConfig.chartTitle}
          </AppText>

          <SegmentedControl
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            accentColor={activeMetricConfig.color}
          />

          <View style={styles.chartWrapper}>
            {statsLoading ? (
              <SkeletonBox width="100%" height={160} borderRadius={radius.lg} />
            ) : (
              <StatsAreaChart
                data={chartPoints}
                color={activeMetricConfig.color}
                gradientId={`stats-chart-${selectedMetric}`}
                formatDay={formatDayLabel}
              />
            )}
          </View>
        </AppCard>
      </ScrollView>

      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInfoModalVisible(false)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <AppText variant="subtitle" color={colors.text.primary} style={styles.modalTitleFlex}>
                Qué significa cada métrica
              </AppText>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {METRIC_ORDER.map((metric, index) => {
                const cfg = METRIC_CONFIG[metric];
                return (
                  <React.Fragment key={metric}>
                    {index > 0 && <Divider spacing={spacing.sm} />}
                    <View style={styles.metricRow}>
                      <Ionicons name={cfg.icon} size={18} color={cfg.color} style={styles.metricIcon} />
                      <View style={styles.metricTextCol}>
                        <AppText variant="label" color={colors.text.primary}>{cfg.cardLabel}</AppText>
                        <AppText variant="caption" color={colors.text.secondary}>
                          {METRIC_DESCRIPTIONS[metric]}
                        </AppText>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </ScrollView>

            <AppText variant="caption" color={colors.text.muted} style={styles.infoFootnote}>
              No contamos tus propias visitas, ni más de una vez al día por persona.
            </AppText>

            <AppButton text="Entendido" variant="secondary" onPress={() => setInfoModalVisible(false)} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  metric,
  value,
  sublabel,
  isSelected,
  onSelect,
}: {
  metric: MetricKey;
  value: number;
  sublabel?: string;
  isSelected: boolean;
  onSelect: (metric: MetricKey) => void;
}) {
  const cfg = METRIC_CONFIG[metric];

  return (
    <AppCard
      onPress={() => onSelect(metric)}
      style={StyleSheet.flatten([styles.statCard, isSelected && { borderColor: cfg.color, borderWidth: 1.5 }])}
    >
      <View style={styles.statCardHeader}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        <Ionicons name="stats-chart-outline" size={14} color={isSelected ? cfg.color : colors.text.muted} />
      </View>
      <AppText variant="h2" maxScale={1.1} style={styles.statValue}>{value}</AppText>
      <AppText variant="caption">{cfg.cardLabel}</AppText>
      {sublabel ? <AppText variant="caption" color={colors.status.success}>{sublabel}</AppText> : null}
    </AppCard>
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
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  barName: {
    marginBottom: spacing.xxs,
  },
  periodLabel: {
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: '47%',
    padding: spacing.lg,
    gap: spacing.xxs,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    marginTop: spacing.xs,
  },
  chartCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  chartTitle: {
    marginBottom: spacing.xs,
  },
  chartWrapper: {
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '75%',
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitleFlex: {
    flex: 1,
  },
  modalScroll: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  metricIcon: {
    marginTop: 2,
  },
  metricTextCol: {
    flex: 1,
    gap: 1,
  },
  infoFootnote: {
    marginBottom: spacing.lg,
    lineHeight: 17,
  },
});
