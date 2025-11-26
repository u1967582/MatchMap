import { supabase } from '~/utils/supabase';

export async function fetchBarIdsByTeam(teamId: string, onlyFuture: boolean = true): Promise<string[]> {
  const { data, error } = await supabase.rpc('fn_bar_ids_with_team_events', {
    _team: teamId,
    _future_only: onlyFuture,
  });
  if (error) throw error;
  return (data ?? []).map((r: { bar_id: string }) => r.bar_id);
}

/**
 * Fetch bar IDs that have events for a specific match
 */
export async function fetchBarIdsByMatch(matchId: string): Promise<string[]> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('events')
      .select('bar_id')
      .eq('match_id', matchId)
      .gte('start_time', now);
    
    if (error) throw error;
    
    // Return unique bar IDs
    const barIds = [...new Set(data?.map(e => e.bar_id) || [])];
    console.log(`📍 Found ${barIds.length} bars with events for match ${matchId}`);
    return barIds;
  } catch (error) {
    console.error('❌ Error fetching bar IDs by match:', error);
    throw error;
  }
}


