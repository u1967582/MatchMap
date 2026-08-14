import {
  METRIC_ORDER,
  METRIC_CONFIG,
  MAX_RANGE_DAYS,
  sumContactClicks,
  buildChartPoints,
  daysSince,
  formatDayLabel,
  getPeriodLabel,
} from '~/lib/barStats';
import type { MetricKey, DailyPoint } from '~/lib/barStats';

const DAILY: DailyPoint[] = [
  {
    day: '2026-08-01',
    profile_views: 10,
    menu_views: 5,
    contact_clicks: 2,
    unique_visitors: 8,
    favorites_total: 20,
    reviews_total: 3,
  },
  {
    day: '2026-08-02',
    profile_views: 12,
    menu_views: 6,
    contact_clicks: 1,
    unique_visitors: 9,
    favorites_total: 21,
    reviews_total: 3,
  },
];

describe('METRIC_ORDER / METRIC_CONFIG', () => {
  it('contiene exactamente las 6 claves de METRIC_CONFIG sin duplicados', () => {
    const configKeys = Object.keys(METRIC_CONFIG).sort();
    expect([...METRIC_ORDER].sort()).toEqual(configKeys);
    expect(new Set(METRIC_ORDER).size).toBe(METRIC_ORDER.length);
  });

  it('respeta el orden de prioridad acordado', () => {
    expect(METRIC_ORDER).toEqual([
      'profile_views',
      'contact_clicks',
      'menu_views',
      'unique_visitors',
      'favorites_total',
      'reviews_total',
    ]);
  });

  it('cada métrica tiene un color hex válido', () => {
    METRIC_ORDER.forEach((key) => {
      expect(METRIC_CONFIG[key].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('marca favorites_total y reviews_total como acumulativas, el resto no', () => {
    expect(METRIC_CONFIG.favorites_total.isCumulative).toBe(true);
    expect(METRIC_CONFIG.reviews_total.isCumulative).toBe(true);
    expect(METRIC_CONFIG.profile_views.isCumulative).toBe(false);
    expect(METRIC_CONFIG.contact_clicks.isCumulative).toBe(false);
    expect(METRIC_CONFIG.menu_views.isCumulative).toBe(false);
    expect(METRIC_CONFIG.unique_visitors.isCumulative).toBe(false);
  });
});

describe('sumContactClicks', () => {
  it('suma los 3 tipos de clic de contacto', () => {
    expect(sumContactClicks({ contact_clicks_phone: 3, contact_clicks_address: 1, contact_clicks_website: 2 })).toBe(6);
  });

  it('devuelve 0 cuando los 3 son 0', () => {
    expect(sumContactClicks({ contact_clicks_phone: 0, contact_clicks_address: 0, contact_clicks_website: 0 })).toBe(0);
  });
});

describe('buildChartPoints', () => {
  const cases: [MetricKey, number[]][] = [
    ['profile_views', [10, 12]],
    ['contact_clicks', [2, 1]],
    ['menu_views', [5, 6]],
    ['unique_visitors', [8, 9]],
    ['favorites_total', [20, 21]],
    ['reviews_total', [3, 3]],
  ];

  it.each(cases)('mapea la columna correcta para %s', (metric, expected) => {
    const points = buildChartPoints(DAILY, metric);
    expect(points.map((p) => p.value)).toEqual(expected);
    expect(points.map((p) => p.day)).toEqual(['2026-08-01', '2026-08-02']);
  });

  it('devuelve un array vacío si no hay datos diarios', () => {
    expect(buildChartPoints([], 'profile_views')).toEqual([]);
  });
});

describe('daysSince', () => {
  it('devuelve 1 cuando la fecha de inicio es hoy', () => {
    expect(daysSince('2026-08-14', '2026-08-14')).toBe(1);
  });

  it('devuelve 30 para un rango de 29 días de diferencia', () => {
    expect(daysSince('2026-07-16', '2026-08-14')).toBe(30);
  });

  it('nunca devuelve menos de 1 aunque la fecha de inicio sea futura', () => {
    expect(daysSince('2026-09-01', '2026-08-14')).toBe(1);
  });

  it('limita el resultado a MAX_RANGE_DAYS', () => {
    expect(daysSince('2000-01-01', '2026-08-14')).toBe(MAX_RANGE_DAYS);
  });
});

describe('formatDayLabel', () => {
  it('formatea una fecha ISO como DD/MM', () => {
    expect(formatDayLabel('2026-08-14')).toBe('14/08');
  });

  it('conserva ceros a la izquierda', () => {
    expect(formatDayLabel('2026-01-05')).toBe('05/01');
  });
});

describe('getPeriodLabel', () => {
  it('usa la etiqueta fija para 30 días', () => {
    expect(getPeriodLabel('30', null)).toBe('Últimos 30 días · no incluye tus propias visitas');
  });

  it('usa la etiqueta fija para 3 meses', () => {
    expect(getPeriodLabel('90', null)).toBe('Últimos 3 meses · no incluye tus propias visitas');
  });

  it('para "all" muestra la fecha real de inicio cuando está disponible', () => {
    expect(getPeriodLabel('all', '2025-08-06')).toBe('Desde el 6 ago 2025 · no incluye tus propias visitas');
  });

  it('para "all" cae en un texto genérico si aún no se resolvió la fecha', () => {
    expect(getPeriodLabel('all', null)).toBe('Desde el inicio · no incluye tus propias visitas');
  });
});
