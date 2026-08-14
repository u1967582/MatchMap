import { Ionicons } from '@expo/vector-icons';
import { colors } from '~/components/ds';

export type MetricKey =
  | 'profile_views'
  | 'contact_clicks'
  | 'menu_views'
  | 'unique_visitors'
  | 'favorites_total'
  | 'reviews_total';

export interface MetricConfig {
  key: MetricKey;
  cardLabel: string;
  chartTitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  isCumulative: boolean;
}

export const METRIC_ORDER: MetricKey[] = [
  'profile_views',
  'contact_clicks',
  'menu_views',
  'unique_visitors',
  'favorites_total',
  'reviews_total',
];

export const METRIC_CONFIG: Record<MetricKey, MetricConfig> = {
  profile_views: {
    key: 'profile_views',
    cardLabel: 'Vistas del perfil',
    chartTitle: 'Vistas del perfil',
    icon: 'eye-outline',
    color: colors.brand.primary,
    isCumulative: false,
  },
  contact_clicks: {
    key: 'contact_clicks',
    cardLabel: 'Clics de contacto',
    chartTitle: 'Clics de contacto',
    icon: 'call-outline',
    color: colors.brand.link,
    isCumulative: false,
  },
  menu_views: {
    key: 'menu_views',
    cardLabel: 'Vistas de la carta',
    chartTitle: 'Vistas de la carta',
    icon: 'restaurant-outline',
    color: colors.status.warning,
    isCumulative: false,
  },
  unique_visitors: {
    key: 'unique_visitors',
    cardLabel: 'Visitantes únicos',
    chartTitle: 'Visitantes únicos',
    icon: 'people-outline',
    color: colors.tags.feature,
    isCumulative: false,
  },
  favorites_total: {
    key: 'favorites_total',
    cardLabel: 'En favoritos',
    chartTitle: 'Favoritos acumulados',
    icon: 'heart-outline',
    color: colors.status.destructive,
    isCumulative: true,
  },
  reviews_total: {
    key: 'reviews_total',
    cardLabel: 'Reseñas',
    chartTitle: 'Reseñas acumuladas',
    icon: 'star-outline',
    color: colors.status.boost,
    isCumulative: true,
  },
};

export interface StatsSummary {
  profile_views: number;
  menu_views: number;
  contact_clicks_phone: number;
  contact_clicks_address: number;
  contact_clicks_website: number;
  unique_visitors: number;
  favorites_count: number;
  favorites_added_period: number;
  reviews_count: number;
  avg_rating: number;
  period_days: number;
}

export interface DailyPoint {
  day: string;
  profile_views: number;
  menu_views: number;
  contact_clicks: number;
  unique_visitors: number;
  favorites_total: number;
  reviews_total: number;
}

export interface ChartPoint {
  day: string;
  value: number;
}

export function sumContactClicks(
  summary: Pick<StatsSummary, 'contact_clicks_phone' | 'contact_clicks_address' | 'contact_clicks_website'>
): number {
  return summary.contact_clicks_phone + summary.contact_clicks_address + summary.contact_clicks_website;
}

export function buildChartPoints(daily: DailyPoint[], metric: MetricKey): ChartPoint[] {
  return daily.map((point) => ({ day: point.day, value: point[metric] }));
}

export const MAX_RANGE_DAYS = 3650;

export function daysSince(startDateISO: string, todayISO?: string): number {
  const start = new Date(`${startDateISO}T00:00:00Z`).getTime();
  const today = new Date(`${todayISO ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const diffDays = Math.round((today - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(MAX_RANGE_DAYS, Math.max(1, diffDays));
}

export function formatDayLabel(dayISO: string): string {
  const [, month, day] = dayISO.split('-');
  return `${day}/${month}`;
}

export type StatsRangeKey = '30' | '90' | 'all';

const RANGE_LABELS: Record<Exclude<StatsRangeKey, 'all'>, string> = {
  '30': 'Últimos 30 días',
  '90': 'Últimos 3 meses',
};

/**
 * Etiqueta del período mostrado en la pantalla de estadísticas. Para
 * "desde inicio" muestra la fecha real de arranque (resuelta por
 * fn_get_bar_stats_range_start) en vez de un número de días fijo, ya que
 * ese rango puede variar bar a bar según cuándo empezó a tener datos.
 */
export function getPeriodLabel(range: StatsRangeKey, sinceDate: string | null): string {
  if (range === 'all') {
    if (!sinceDate) return 'Desde el inicio · no incluye tus propias visitas';
    const since = new Date(`${sinceDate}T00:00:00Z`).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `Desde el ${since} · no incluye tus propias visitas`;
  }
  return `${RANGE_LABELS[range]} · no incluye tus propias visitas`;
}
