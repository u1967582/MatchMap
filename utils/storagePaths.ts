/**
 * Rutas de Supabase Storage.
 *
 * Las políticas RLS de storage.objects (migración
 * 20261015120000_audit01_security_rls_storage.sql) deciden quién puede escribir
 * mirando la PRIMERA carpeta de la ruta:
 *   - avatars:             <userId>/…   → solo ese usuario
 *   - bar-images:          <barId>/…    → solo el propietario del bar o un super admin
 *   - bar-claim-documents: <userId>/…   → solo ese usuario (y admins leen)
 *
 * Cualquier subida nueva debe construir su ruta con estas funciones para no
 * romperse con las políticas.
 */

export const STORAGE_BUCKETS = {
  avatars: 'avatars',
  barImages: 'bar-images',
  claimDocuments: 'bar-claim-documents',
} as const;

export type BarImageKind = 'bar' | 'menu';

/** Primera carpeta de una ruta de Storage (la que comprueban las políticas). */
export function storageOwnerFolder(path: string): string | null {
  const parts = path.split('/');
  if (parts.length < 2 || !parts[0]) return null;
  return parts[0];
}

/** avatars: <userId>/avatar_<ts>.jpg */
export function avatarPath(userId: string, timestamp: number = Date.now()): string {
  return `${userId}/avatar_${timestamp}.jpg`;
}

/** bar-images: <barId>/<bar|menu>/<bar|menu>_<suffix>.jpg */
export function barImagePath(barId: string, kind: BarImageKind, suffix: string | number): string {
  return `${barId}/${kind}/${kind}_${suffix}.jpg`;
}

/** bar-images: <barId>/posts/post_<postId>_<ts>.jpg */
export function barPostImagePath(
  barId: string,
  postId: string,
  timestamp: number = Date.now()
): string {
  return `${barId}/posts/post_${postId}_${timestamp}.jpg`;
}

/** bar-claim-documents: <userId>/<barId>-<ts>.jpg */
export function claimDocumentPath(
  userId: string,
  barId: string,
  timestamp: number = Date.now()
): string {
  return `${userId}/${barId}-${timestamp}.jpg`;
}
