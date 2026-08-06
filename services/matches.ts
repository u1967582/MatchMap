import { supabase } from '~/utils/supabase';
import type { Match } from '~/components/ui/MatchPickerModal';

/**
 * Resuelve un partido por id con sus equipos y competición ya enriquecidos,
 * en el mismo formato que usa MatchPickerModal/Map. Pensado para el deep
 * link de notificaciones (?matchId=...), donde solo se conoce el id.
 */
export async function fetchMatchById(matchId: string): Promise<Match | null> {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, date, time, home_team_id, away_team_id, competition_id, status')
    .eq('id', matchId)
    .maybeSingle();

  if (matchError) throw matchError;
  if (!match) return null;

  const [{ data: teamsData }, { data: competitionsData }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, gender, logo_url')
      .in('id', [match.home_team_id, match.away_team_id]),
    supabase.from('competitions').select('id, name, gender').eq('id', match.competition_id),
  ]);

  const teamsMap = new Map((teamsData ?? []).map((team) => [team.id, team]));
  const competition = competitionsData?.[0];

  return {
    ...match,
    home_team: teamsMap.get(match.home_team_id),
    away_team: teamsMap.get(match.away_team_id),
    competition,
  };
}
