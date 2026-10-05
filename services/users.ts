import { supabase } from '~/utils/supabase';

export interface FavoriteTeamStatus {
  favorite_team_id: string | null;
  favorite_team_prompted_at: string | null;
}

export async function fetchFavoriteTeamStatus(userId: string): Promise<FavoriteTeamStatus | null> {
  const { data, error } = await supabase
    .from('users')
    .select('favorite_team_id, favorite_team_prompted_at')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marca el popup de onboarding como mostrado y guarda el equipo elegido (o null si se descartó).
 * favorite_team_prompted_at se setea siempre, para no volver a preguntar.
 */
export async function setFavoriteTeam(userId: string, teamId: string | null): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      favorite_team_id: teamId,
      favorite_team_prompted_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Cambio posterior desde el perfil: no toca favorite_team_prompted_at, ya está seteado.
 */
export async function updateFavoriteTeam(userId: string, teamId: string | null): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ favorite_team_id: teamId })
    .eq('id', userId);

  if (error) throw error;
}

export interface BettingBarsStatus {
  is_adult_confirmed: boolean;
  show_betting_bars: boolean;
  betting_bars_prompted_at: string | null;
}

export async function fetchBettingBarsStatus(userId: string): Promise<BettingBarsStatus | null> {
  const { data, error } = await supabase
    .from('users')
    .select('is_adult_confirmed, show_betting_bars, betting_bars_prompted_at')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Guarda la respuesta del popup de edad/preferencia de apuestas deportivas.
 * betting_bars_prompted_at se setea siempre, para no volver a preguntar
 * automáticamente (el usuario puede reconfirmar desde el perfil cuando quiera).
 */
export async function setBettingBarsPreference(
  userId: string,
  { isAdultConfirmed, showBettingBars }: { isAdultConfirmed: boolean; showBettingBars: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      is_adult_confirmed: isAdultConfirmed,
      show_betting_bars: showBettingBars,
      betting_bars_prompted_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Cambio posterior desde el perfil (toggle simple): no toca
 * betting_bars_prompted_at ni is_adult_confirmed, ya están seteados.
 */
export async function updateShowBettingBars(userId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ show_betting_bars: value })
    .eq('id', userId);

  if (error) throw error;
}
