import { supabase } from '~/utils/supabase';

export async function fetchBarIdsByTeam(teamId: string, onlyFuture: boolean = true): Promise<string[]> {
  const { data, error } = await supabase.rpc('fn_bar_ids_with_team_events', {
    _team: teamId,
    _future_only: onlyFuture,
  });
  if (error) throw error;
  return (data ?? []).map((r: { bar_id: string }) => r.bar_id);
}


