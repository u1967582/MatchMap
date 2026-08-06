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
