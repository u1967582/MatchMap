// Utilidades de autorización compartidas por las edge functions.
// deno-lint-ignore-file no-explicit-any

/**
 * Compara dos secretos en tiempo constante (respecto a su contenido) para no
 * filtrar por tiempo de respuesta cuántos caracteres coinciden.
 */
export function timingSafeEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  // La longitud sí se filtra; el contenido no.
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Autorización de las funciones que invoca pg_cron (verify_jwt = false).
 * pg_cron envía en `x-cron-secret` el secreto guardado en Vault, que la
 * función lee con la RPC `get_cron_secret` (solo service_role).
 *
 * El secreto se cachea por instancia. Si no coincide se vuelve a leer (como
 * mucho una vez cada `refreshMs`), para que una rotación del secreto en Vault
 * no deje la función devolviendo 401 hasta el siguiente arranque en frío, sin
 * que peticiones con un secreto falso provoquen una RPC cada una.
 */
export function createCronAuth(
  supabase: any,
  { refreshMs = 60_000, now = () => Date.now() }: { refreshMs?: number; now?: () => number } = {}
) {
  let cached: string | null = null;
  let loadedAt = -Infinity;

  async function load(): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_cron_secret');
    if (error || typeof data !== 'string' || !data) {
      console.error('No se pudo leer cron_secret:', error?.message);
      return null;
    }
    return data;
  }

  return async function isAuthorizedCron(req: Request): Promise<boolean> {
    const provided = req.headers.get('x-cron-secret');
    if (!provided) return false;

    if (cached && timingSafeEqual(provided, cached)) return true;
    if (cached && now() - loadedAt < refreshMs) return false;

    const fresh = await load();
    loadedAt = now();
    if (!fresh) return false;
    cached = fresh;
    return timingSafeEqual(provided, fresh);
  };
}
