export type AuthDeepLink = {
  kind: 'callback' | 'recovery';
  accessToken: string;
  refreshToken: string;
};

/**
 * Extrae los tokens de sesión de un deep link de Supabase.
 *
 * Solo acepta las rutas a las que Supabase redirige (`auth/callback` y
 * `auth/reset-password` con `type=recovery`). Cualquier otro enlace con
 * tokens devuelve null, para que un enlace malicioso no pueda iniciar sesión
 * en una cuenta ajena.
 */
export function parseAuthDeepLink(rawUrl: string): AuthDeepLink | null {
  const path = rawUrl.replace(/^[^:]+:\/\//, '').split(/[?#]/)[0];
  const isCallback = path.endsWith('auth/callback');
  const isReset = path.endsWith('auth/reset-password');

  if (!isCallback && !isReset) return null;

  // Los tokens pueden venir en el hash fragment (#) o en query params (?)
  const hashIndex = rawUrl.indexOf('#');
  const queryIndex = rawUrl.indexOf('?');
  const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex + 1) : '';
  const query =
    queryIndex >= 0
      ? rawUrl.slice(queryIndex + 1, hashIndex > queryIndex ? hashIndex : undefined)
      : '';

  let params = new URLSearchParams(hash);
  if (!params.get('access_token') || !params.get('refresh_token')) {
    params = new URLSearchParams(query);
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  if (isReset) {
    return params.get('type') === 'recovery'
      ? { kind: 'recovery', accessToken, refreshToken }
      : null;
  }

  return { kind: 'callback', accessToken, refreshToken };
}
