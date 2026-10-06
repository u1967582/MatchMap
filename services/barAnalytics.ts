import { supabase } from '~/utils/supabase';

export type BarAnalyticsEventType =
  | 'profile_view'
  | 'menu_view'
  | 'contact_click_phone'
  | 'contact_click_address'
  | 'contact_click_website';

/**
 * Registra un evento de comportamiento sobre un bar (vista de perfil, de
 * carta, o clic de contacto). Fire-and-forget: nunca lanza, solo loguea si
 * fn_track_bar_event devuelve error. No llama a la RPC si no hay barId o si
 * quien dispara el evento es el propio owner (evita la llamada de red; la
 * RPC ya repite esta validación en el servidor como defensa en profundidad).
 */
export function trackBarEvent(
  barId: string | undefined | null,
  eventType: BarAnalyticsEventType,
  isOwner: boolean
): void {
  if (!barId || isOwner) return;

  supabase.rpc('fn_track_bar_event', { p_bar_id: barId, p_event_type: eventType }).then(({ error }) => {
    if (error) console.error(`Error tracking ${eventType}:`, error);
  });
}

/**
 * Registra presencia cercana a un bar (ver fn_track_bar_proximity). Solo
 * envía el bar_id, nunca coordenadas.
 */
export function trackBarProximity(barId: string | undefined | null): void {
  if (!barId) return;

  supabase.rpc('fn_track_bar_proximity', { p_bar_id: barId }).then(({ error }) => {
    if (error) console.error('Error tracking proximity:', error);
  });
}

/** Resumen agregado de estadísticas del bar para los últimos `days` días. */
export function fetchBarStatsSummary(barId: string, days: number) {
  return supabase.rpc('fn_get_bar_stats_summary', { p_bar_id: barId, p_days: days });
}

/** Serie diaria de las 6 métricas del dashboard para los últimos `days` días. */
export function fetchBarStatsDaily(barId: string, days: number) {
  return supabase.rpc('fn_get_bar_stats_daily', { p_bar_id: barId, p_days: days });
}

/** Fecha del primer evento trackeado para el bar, usada para el rango "desde inicio". */
export function fetchBarStatsRangeStart(barId: string) {
  return supabase.rpc('fn_get_bar_stats_range_start', { p_bar_id: barId });
}
