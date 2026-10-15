import {
  formatMatchDateTime,
  formatMatchTime,
  formatRelativeDate,
  isEuSummerTime,
  madridWallTimeToDate,
} from '~/utils/dateFormat';

describe('isEuSummerTime', () => {
  it('2026: el horario de verano va del 29-mar 01:00 UTC al 25-oct 01:00 UTC', () => {
    expect(isEuSummerTime(Date.UTC(2026, 2, 29, 0, 59))).toBe(false);
    expect(isEuSummerTime(Date.UTC(2026, 2, 29, 1, 0))).toBe(true);
    expect(isEuSummerTime(Date.UTC(2026, 9, 25, 0, 59))).toBe(true);
    expect(isEuSummerTime(Date.UTC(2026, 9, 25, 1, 0))).toBe(false);
  });

  it('enero y julio', () => {
    expect(isEuSummerTime(Date.UTC(2026, 0, 15, 12))).toBe(false);
    expect(isEuSummerTime(Date.UTC(2026, 6, 15, 12))).toBe(true);
  });
});

describe('madridWallTimeToDate', () => {
  it('en verano Madrid es UTC+2', () => {
    expect(madridWallTimeToDate('2026-10-15', '21:00')?.toISOString()).toBe(
      '2026-10-15T19:00:00.000Z'
    );
  });

  it('en invierno Madrid es UTC+1 (acepta HH:MM:SS)', () => {
    expect(madridWallTimeToDate('2026-12-01', '21:00:00')?.toISOString()).toBe(
      '2026-12-01T20:00:00.000Z'
    );
  });

  it('cambio de hora de octubre: antes y después', () => {
    // 25-oct-2026: a las 03:00 CEST se vuelve a las 02:00 CET
    expect(madridWallTimeToDate('2026-10-25', '01:30')?.toISOString()).toBe(
      '2026-10-24T23:30:00.000Z'
    );
    expect(madridWallTimeToDate('2026-10-25', '18:00')?.toISOString()).toBe(
      '2026-10-25T17:00:00.000Z'
    );
  });

  it('cambio de hora de marzo: antes y después', () => {
    // 29-mar-2026: a las 02:00 CET se pasa a las 03:00 CEST
    expect(madridWallTimeToDate('2026-03-29', '01:30')?.toISOString()).toBe(
      '2026-03-29T00:30:00.000Z'
    );
    expect(madridWallTimeToDate('2026-03-29', '20:00')?.toISOString()).toBe(
      '2026-03-29T18:00:00.000Z'
    );
  });

  it('partido a medianoche: la fecha UTC es la del día anterior', () => {
    expect(madridWallTimeToDate('2026-08-01', '00:30')?.toISOString()).toBe(
      '2026-07-31T22:30:00.000Z'
    );
  });

  it('sin hora usa las 00:00', () => {
    expect(madridWallTimeToDate('2026-12-01')?.toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });

  it('acepta una fecha ISO completa (usa solo YYYY-MM-DD)', () => {
    expect(madridWallTimeToDate('2026-12-01T10:00:00Z', '12:00')?.toISOString()).toBe(
      '2026-12-01T11:00:00.000Z'
    );
  });

  it('devuelve null con formatos no válidos', () => {
    expect(madridWallTimeToDate('', '21:00')).toBeNull();
    expect(madridWallTimeToDate('15/10/2026', '21:00')).toBeNull();
    expect(madridWallTimeToDate('2026-10-15', 'mañana')).toBeNull();
  });
});

// Zona del "dispositivo" en los tests: Canarias va una hora por detrás de
// Madrid todo el año, así se comprueba la conversión de zona horaria.
const CANARIAS = 'Atlantic/Canary';

describe('formatMatchTime / formatMatchDateTime (dispositivo en Canarias)', () => {
  it('muestra la hora local del dispositivo, no la de Madrid', () => {
    expect(formatMatchTime('2026-10-15', '21:00', CANARIAS)).toBe('20:00');
  });

  it('el cambio de día también se ajusta a la zona del dispositivo', () => {
    // 00:30 en Madrid = 23:30 del día anterior en Canarias
    const text = formatMatchDateTime('2026-08-01', '00:30', CANARIAS);
    expect(text).toContain('31');
    expect(text).toContain('23:30');
  });

  it('en Madrid se muestra la misma hora guardada', () => {
    expect(formatMatchTime('2026-12-01', '21:00', 'Europe/Madrid')).toBe('21:00');
  });

  it('con datos no válidos no lanza y devuelve lo que se pueda', () => {
    expect(formatMatchTime('fecha-rara', '21:00:00')).toBe('21:00');
    expect(formatMatchTime('fecha-rara', null)).toBe('');
    expect(formatMatchDateTime('fecha-rara', '21:00')).toBe('fecha-rara 21:00');
  });
});

describe('formatRelativeDate', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  it.each([
    [0, 'hoy'],
    [1, 'hace 1 día'],
    [3, 'hace 3 días'],
    [7, 'hace 1 semana'],
    [20, 'hace 2 semanas'],
    [30, 'hace 1 mes'],
    [90, 'hace 3 meses'],
    [365, 'hace 1 año'],
    [800, 'hace 2 años'],
  ])('%i días → "%s"', (days, expected) => {
    expect(formatRelativeDate(daysAgo(days), now)).toBe(expected);
  });

  it('una fecha futura (reloj desajustado) se muestra como "hoy"', () => {
    expect(formatRelativeDate('2026-10-16T12:00:00Z', now)).toBe('hoy');
  });

  it('una fecha no válida devuelve cadena vacía', () => {
    expect(formatRelativeDate('no-es-fecha', now)).toBe('');
  });
});
