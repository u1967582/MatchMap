import { supabase } from '~/utils/supabase';

/**
 * Moderación de contenido generado por usuarios (App Store 1.2):
 * reportar reseñas, bloquear a usuarios y resolver reportes (super admin).
 * Tablas y RPC: review_reports, user_blocks y admin_resolve_review_report
 * (supabase/migrations/20261015130000_review_reports_and_user_blocks.sql).
 */

export type ReviewReportReason =
  'ofensivo' | 'spam' | 'falso' | 'acoso' | 'datos_personales' | 'otro';

// Debe coincidir con el CHECK review_reports_reason_check de la migración
export const REVIEW_REPORT_REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: 'ofensivo', label: 'Lenguaje ofensivo o de odio' },
  { value: 'acoso', label: 'Acoso o amenazas' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'falso', label: 'Reseña falsa o engañosa' },
  { value: 'datos_personales', label: 'Datos personales de alguien' },
  { value: 'otro', label: 'Otro' },
];

// Debe coincidir con el CHECK review_reports_message_length
export const REVIEW_REPORT_MESSAGE_MAX_LENGTH = 500;

export type ModerationResult = { ok: true } | { ok: false; error: any; duplicate?: boolean };

/** Código de Postgres para violación de UNIQUE (el reporte/bloqueo ya existía) */
const UNIQUE_VIOLATION = '23505';

export async function reportReview(params: {
  reviewId: string;
  reporterId: string;
  reason: ReviewReportReason;
  message?: string | null;
}): Promise<ModerationResult> {
  // El estado, el autor y el texto de la reseña los rellena un trigger en la BD
  const { error } = await supabase.from('review_reports').insert({
    review_id: params.reviewId,
    reporter_id: params.reporterId,
    reason: params.reason,
    message: params.message?.trim().slice(0, REVIEW_REPORT_MESSAGE_MAX_LENGTH) || null,
  });

  if (error) {
    // Ya había reportado esta reseña: la pantalla lo trata como éxito
    if (error.code === UNIQUE_VIOLATION) return { ok: false, error, duplicate: true };
    return { ok: false, error };
  }
  return { ok: true };
}

export async function blockUser(blockerId: string, blockedId: string): Promise<ModerationResult> {
  if (!blockerId || !blockedId || blockerId === blockedId) {
    return { ok: false, error: new Error('Bloqueo no válido') };
  }

  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, error, duplicate: true };
    return { ok: false, error };
  }
  return { ok: true };
}

/**
 * Ids de usuarios bloqueados por `userId`. Si la consulta falla (p. ej. sin
 * conexión o tabla aún no creada) devuelve [] para no romper la ficha del bar.
 */
export async function fetchBlockedUserIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (error) {
      console.error('❌ Error cargando usuarios bloqueados:', error.message);
      return [];
    }
    return (data ?? []).map((row: { blocked_id: string }) => row.blocked_id);
  } catch {
    return [];
  }
}

/**
 * Ids de reseñas que `userId` ya ha reportado: se le ocultan mientras el
 * equipo las revisa. Si la consulta falla devuelve [].
 */
export async function fetchReportedReviewIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('review_reports')
      .select('review_id')
      .eq('reporter_id', userId);
    if (error) {
      console.error('❌ Error cargando reseñas reportadas:', error.message);
      return [];
    }
    return (data ?? [])
      .map((row: { review_id: string | null }) => row.review_id)
      .filter((id): id is string => !!id);
  } catch {
    return [];
  }
}

/**
 * Quita de la lista las reseñas que el usuario no debe ver: las de usuarios
 * que ha bloqueado y las que ya ha reportado (pendientes de revisión).
 */
export function filterHiddenReviews<T extends { id: string; user_id?: string | null }>(
  reviews: T[],
  blockedUserIds: Iterable<string>,
  reportedReviewIds: Iterable<string>
): T[] {
  const blocked = new Set(blockedUserIds);
  const reported = new Set(reportedReviewIds);
  return reviews.filter(
    (review) => !reported.has(review.id) && !(review.user_id && blocked.has(review.user_id))
  );
}

/** Carga a la vez los bloqueos y los reportes del usuario (nunca lanza). */
export async function fetchHiddenReviewFilters(
  userId: string | null
): Promise<{ blockedUserIds: string[]; reportedReviewIds: string[] }> {
  const [blockedUserIds, reportedReviewIds] = await Promise.all([
    fetchBlockedUserIds(userId),
    fetchReportedReviewIds(userId),
  ]);
  return { blockedUserIds, reportedReviewIds };
}

// ---------------------------------------------------------------- admin ----

export interface PendingReviewReport {
  id: string;
  review_id: string | null;
  reason: string;
  message: string | null;
  review_comment: string | null;
  created_at: string;
  bar: { id: string; name: string } | null;
}

/** Reportes pendientes, del más antiguo al más reciente (solo super admin, por RLS). */
export async function fetchPendingReviewReports(): Promise<PendingReviewReport[]> {
  const { data, error } = await supabase
    .from('review_reports')
    .select('id, review_id, reason, message, review_comment, created_at, bar:bars(id, name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    review_id: row.review_id ?? null,
    reason: row.reason,
    message: row.message ?? null,
    review_comment: row.review_comment ?? null,
    created_at: row.created_at,
    bar: Array.isArray(row.bar) ? (row.bar[0] ?? null) : (row.bar ?? null),
  }));
}

export type ReviewReportAction = 'remove_review' | 'dismiss';

/**
 * Resuelve un reporte (solo super admin): `remove_review` borra la reseña y
 * cierra todos los reportes pendientes de esa reseña; `dismiss` descarta solo
 * este reporte y la reseña se queda.
 */
export async function resolveReviewReport(
  reportId: string,
  action: ReviewReportAction,
  notes?: string | null
): Promise<ModerationResult> {
  const { error } = await supabase.rpc('admin_resolve_review_report', {
    p_report_id: reportId,
    p_action: action,
    p_notes: notes?.trim() || null,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}

/**
 * Lista de pendientes tras resolver `resolved`: siempre sale ese reporte y, si
 * se eliminó la reseña, también el resto de reportes de la misma reseña (la
 * RPC los marca como revisados).
 */
export function removeResolvedReports<T extends { id: string; review_id: string | null }>(
  reports: T[],
  resolved: { id: string; review_id: string | null },
  action: ReviewReportAction
): T[] {
  return reports.filter((r) => {
    if (r.id === resolved.id) return false;
    if (action === 'remove_review' && resolved.review_id && r.review_id === resolved.review_id) {
      return false;
    }
    return true;
  });
}

export function reviewReportReasonLabel(reason: string): string {
  return REVIEW_REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}
