/**
 * Utilidades de fecha para partidos y reseñas.
 *
 * Los partidos (`matches.date` + `matches.time`) se guardan en hora local de
 * Madrid (ver supabase/functions/sync-football/handler.ts). Para mostrarlos en
 * la zona horaria del dispositivo (Canarias, turistas, etc.) hay que convertir
 * esa hora "de pared" a un instante real. No se usa `new Date('YYYY-MM-DD HH:MM')`
 * porque ese formato no es estándar (Hermes puede devolver Invalid Date) y
 * además lo interpreta en la zona del dispositivo.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Último domingo del mes (0-11) a la 01:00 UTC: cambio de hora en la UE. */
function lastSundayAt1Utc(year: number, month0: number): number {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0));
  const day = lastDay.getUTCDate() - lastDay.getUTCDay();
  return Date.UTC(year, month0, day, 1, 0, 0);
}

/** ¿Está en vigor el horario de verano de la UE en este instante? */
export function isEuSummerTime(utcMs: number): boolean {
  const year = new Date(utcMs).getUTCFullYear();
  return utcMs >= lastSundayAt1Utc(year, 2) && utcMs < lastSundayAt1Utc(year, 9);
}

/**
 * Convierte fecha y hora de Madrid (`2026-10-15`, `21:00` o `21:00:00`) en un
 * Date con el instante correcto. Devuelve null si el formato no es válido.
 */
export function madridWallTimeToDate(date: string, time?: string | null): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  if (!dateMatch) return null;
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time ?? '00:00');
  if (!timeMatch) return null;

  const [, y, mo, d] = dateMatch.map(Number);
  const [, h, mi, s = 0] = timeMatch.map((v) => (v === undefined ? 0 : Number(v)));
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);

  // Madrid es UTC+2 en verano y UTC+1 en invierno
  const summerCandidate = wallAsUtc - 2 * HOUR_MS;
  const utcMs = isEuSummerTime(summerCandidate) ? summerCandidate : wallAsUtc - HOUR_MS;
  return new Date(utcMs);
}

/** `timeZone` solo se pasa en tests; en la app se usa la zona del dispositivo. */
function zoneOption(timeZone?: string): { timeZone?: string } {
  return timeZone ? { timeZone } : {};
}

/** Hora del partido en la zona del dispositivo, p. ej. "21:00". */
export function formatMatchTime(date: string, time?: string | null, timeZone?: string): string {
  const kickoff = madridWallTimeToDate(date, time);
  if (!kickoff) return time ? time.slice(0, 5) : '';
  return kickoff.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    ...zoneOption(timeZone),
  });
}

/** Fecha y hora del partido en la zona del dispositivo, p. ej. "jue, 15 oct, 21:00". */
export function formatMatchDateTime(date: string, time?: string | null, timeZone?: string): string {
  const kickoff = madridWallTimeToDate(date, time);
  if (!kickoff) return `${date ?? ''} ${time ?? ''}`.trim();
  return kickoff.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...zoneOption(timeZone),
  });
}

/** Tiempo relativo en español para reseñas ("hoy", "hace 3 días"…). */
export function formatRelativeDate(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (24 * HOUR_MS));

  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'hace 1 día';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? 'hace 1 semana' : `hace ${weeks} semanas`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}
