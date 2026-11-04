/**
 * Mensajes de error que se enseñan al usuario (auditoría 12-H6).
 *
 * Nunca se muestra `error.message` de Supabase/Postgres/Storage tal cual: está
 * en inglés («new row violates row-level security policy…») o es técnico.
 * Los errores pensados para el usuario se lanzan como `UserFacingError` y su
 * mensaje (en español) sí se muestra.
 */
export class UserFacingError extends Error {
  readonly userFacing = true;
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export const NETWORK_ERROR_MESSAGE = 'Error de conexión. Revisa tu conexión a internet';
export const PERMISSION_ERROR_MESSAGE = 'No tienes permiso para hacer esto';

export function userFacingErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof UserFacingError || (error as any)?.userFacing === true) {
    return (error as Error).message || fallback;
  }

  const code = String((error as any)?.code ?? '').toLowerCase();
  const raw = typeof error === 'string' ? error : String((error as any)?.message ?? '');
  const msg = raw.toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => msg.includes(n));

  if (has('network request failed', 'failed to fetch', 'fetch failed', 'network', 'timeout', 'timed out')) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (
    code === '42501' ||
    has('row-level security', 'permission denied', 'not authorized', 'no autorizado', 'only super admins', 'unauthorized')
  ) {
    return PERMISSION_ERROR_MESSAGE;
  }
  if (has('already reviewed')) return 'Esta solicitud ya fue revisada';
  if (code === '23505' || has('duplicate key')) return 'Ya existe un registro igual';
  if (code === 'pgrst116' || has('not found')) return 'Ya no existe o se ha borrado';
  return fallback;
}
