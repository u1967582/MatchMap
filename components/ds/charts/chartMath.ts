export interface ScaledPoint {
  x: number;
  y: number;
}

export function computeChartDomain(values: number[]): { min: number; max: number } {
  return { min: 0, max: Math.max(1, ...values) };
}

export function scalePoints(
  values: number[],
  width: number,
  height: number,
  paddingTop: number = 8
): ScaledPoint[] {
  if (values.length === 0) return [];

  const { max } = computeChartDomain(values);
  const usableHeight = Math.max(0, height - paddingTop);

  if (values.length === 1) {
    const y = height - (values[0] / max) * usableHeight;
    return [{ x: width / 2, y }];
  }

  return values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - (value / max) * usableHeight,
  }));
}

export function buildLinePath(points: ScaledPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const segments = rest.map((p) => `L ${p.x} ${p.y}`);
  return [`M ${first.x} ${first.y}`, ...segments].join(' ');
}

export function buildAreaPath(points: ScaledPoint[], height: number): string {
  if (points.length === 0) return '';
  const linePath = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`;
}

export function pickAxisTicks(length: number, maxTicks: number = 4): number[] {
  if (length <= 0) return [];
  if (length <= maxTicks) return Array.from({ length }, (_, i) => i);

  const lastIndex = length - 1;
  const step = lastIndex / (maxTicks - 1);
  const ticks = Array.from({ length: maxTicks }, (_, i) => Math.round(i * step));

  return Array.from(new Set(ticks)).sort((a, b) => a - b);
}
