import { useState, useEffect, useCallback } from 'react';
import { supabase } from '~/utils/supabase';

export interface FavoriteTeamOption {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  match_count: number;
  competition_id: string;
  competition_name: string;
}

interface UseFavoriteTeamOptionsResult {
  options: FavoriteTeamOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Trae la lista de equipos elegibles como favorito (clubes españoles,
 * ordenados por relevancia) vía el RPC get_favorite_team_options.
 * `enabled` evita el fetch hasta que el popup vaya a mostrarse.
 */
export function useFavoriteTeamOptions(enabled: boolean = true): UseFavoriteTeamOptionsResult {
  const [options, setOptions] = useState<FavoriteTeamOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchOptions() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc('get_favorite_team_options');
        if (rpcError) throw rpcError;

        if (isMounted) setOptions((data ?? []) as FavoriteTeamOption[]);
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching favorite team options:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch team options'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchOptions();

    return () => {
      isMounted = false;
    };
  }, [enabled, refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { options, isLoading, error, refetch };
}
