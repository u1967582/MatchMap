import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/utils/supabase';

export interface WorldCupTeam {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface WorldCupMatch {
  id: string;
  date: string;
  time: string;
  datetime_utc: string;
  matchday: number | null;
  round_name: string | null;
  group_name: string | null;
  stadium: string | null;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  home_score: number | null;
  away_score: number | null;
  home_team: WorldCupTeam;
  away_team: WorldCupTeam;
}

export function useWorldCupData() {
  const [matches, setMatches] = useState<WorldCupMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: matchError } = await supabase
        .from('matches')
        .select(`
          id,
          date,
          time,
          datetime_utc,
          matchday,
          round_name,
          group_name,
          stadium,
          status,
          home_score,
          away_score,
          home_team:teams!home_team_id(id, name, logo_url),
          away_team:teams!away_team_id(id, name, logo_url)
        `)
        .eq('competition_id', 'a26f5bef-02eb-433d-b531-c185ac1bf1e8')
        .order('datetime_utc', { ascending: true });

      if (matchError) throw matchError;
      setMatches((data ?? []) as unknown as WorldCupMatch[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos del Mundial';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { matches, loading, error, refetch: fetchData };
}
