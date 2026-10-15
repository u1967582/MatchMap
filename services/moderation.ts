import { supabase } from '~/utils/supabase';

/**
 * Moderación de contenido generado por usuarios (App Store 1.2):
 * reportar reseñas y bloquear a usuarios.
 * Tablas: review_reports y user_blocks
 * (supabase/migrations/20261015120000_review_reports_and_user_blocks.sql).
 */

export type ReviewReportReason = 'ofensivo' | 'spam' | 'falso' | 'acoso' | 'datos_personales' | 'otro';

// Debe coincidir con el CHECK review_reports_reason_check de la migración
export const REVIEW_REPORT_REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: 'ofensivo', label: 'Lenguaje ofensivo o de odio' },
  { value: 'acoso', label: 'Acoso o amenazas' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'falso', label: 'Reseña falsa o engañosa' },
  { value: 'datos_personales', label: 'Datos personales de alguien' },
  { value: 'otro', label: 'Otro' },
];

export type ModerationResult = { ok: true } | { ok: false; error: any; duplicate?: boolean };

export async function reportReview(params: {
  reviewId: string;
  reporterId: string;
  reason: ReviewReportReason;
  message?: string | null;
}): Promise<ModerationResult> {
  const { error } = await supabase.from('review_reports').insert({
    review_id: params.reviewId,
    reporter_id: params.reporterId,
    reason: params.reason,
    message: params.message?.trim() || null,
  });

  if (error) {
    // 23505 = ya había reportado esta reseña: para el usuario es un éxito
    if (error.code === '23505') return { ok: false, error, duplicate: true };
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
    if (error.code === '23505') return { ok: false, error, duplicate: true };
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
