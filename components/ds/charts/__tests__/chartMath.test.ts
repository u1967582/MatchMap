import {
  computeChartDomain,
  scalePoints,
  buildLinePath,
  buildAreaPath,
  pickAxisTicks,
} from '~/components/ds/charts/chartMath';

describe('computeChartDomain', () => {
  it('min siempre es 0', () => {
    expect(computeChartDomain([5, 10, 2]).min).toBe(0);
  });

  it('max nunca es 0 ni NaN, incluso con array vacío', () => {
    expect(computeChartDomain([]).max).toBe(1);
    expect(computeChartDomain([0, 0, 0]).max).toBe(1);
  });

  it('max es el valor más alto cuando hay datos', () => {
    expect(computeChartDomain([5, 10, 2]).max).toBe(10);
  });
});

describe('scalePoints', () => {
  it('devuelve un array vacío para 0 puntos', () => {
    expect(scalePoints([], 100, 50)).toEqual([]);
  });

  it('centra el único punto en x para un array de 1 elemento', () => {
    const points = scalePoints([5], 100, 50);
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe(50);
  });

  it('distribuye x de forma creciente y dentro de [0, width] para N puntos', () => {
    const points = scalePoints([1, 2, 3, 4], 90, 50);
    expect(points.map((p) => p.x)).toEqual([0, 30, 60, 90]);
  });

  it('un valor más alto produce una y menor (coordenadas SVG invertidas)', () => {
    const points = scalePoints([1, 10], 100, 50);
    expect(points[1].y).toBeLessThan(points[0].y);
  });

  it('no genera NaN ni Infinity cuando todos los valores son 0', () => {
    const points = scalePoints([0, 0, 0], 100, 50);
    points.forEach((p) => {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    });
  });
});

describe('buildLinePath / buildAreaPath', () => {
  const points = [
    { x: 0, y: 10 },
    { x: 5, y: 20 },
    { x: 10, y: 0 },
  ];

  it('buildLinePath genera un path con M y 2 comandos L', () => {
    const path = buildLinePath(points);
    expect(path).toBe('M 0 10 L 5 20 L 10 0');
  });

  it('buildLinePath devuelve string vacío sin puntos', () => {
    expect(buildLinePath([])).toBe('');
  });

  it('buildAreaPath cierra el área hacia la línea base y con Z', () => {
    const path = buildAreaPath(points, 30);
    expect(path).toBe('M 0 10 L 5 20 L 10 0 L 10 30 L 0 30 Z');
  });

  it('buildAreaPath devuelve string vacío sin puntos', () => {
    expect(buildAreaPath([], 30)).toBe('');
  });
});

describe('pickAxisTicks', () => {
  it.each([1, 2, 4, 14, 30, 90, 365])('para longitud %i incluye siempre el primer y último índice', (length) => {
    const ticks = pickAxisTicks(length, 4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(length - 1);
  });

  it.each([1, 2, 4, 14, 30, 90, 365])('para longitud %i no supera maxTicks ni tiene duplicados', (length) => {
    const ticks = pickAxisTicks(length, 4);
    expect(ticks.length).toBeLessThanOrEqual(4);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it('devuelve un array vacío para longitud 0', () => {
    expect(pickAxisTicks(0, 4)).toEqual([]);
  });

  it('devuelve todos los índices cuando length <= maxTicks', () => {
    expect(pickAxisTicks(3, 4)).toEqual([0, 1, 2]);
  });
});
