import { useState, useCallback } from 'react';
import { supabase } from '~/utils/supabase';

export type ScarveRarity = 'common' | 'rare' | 'legendary';

export interface UserScarf {
  id: string;
  claim_count: number;
  rarity: ScarveRarity;
  first_claimed_at: string;
  last_claimed_at: string;
  team: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export function useScarves(userId: string | null) {
  const [scarves, setScarves] = useState<UserScarf[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchScarves = useCallback(async () => {
    if (!userId) {
      setScarves([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_scarves')
        .select(`
          id,
          claim_count,
          rarity,
          first_claimed_at,
          last_claimed_at,
          team:teams!user_scarves_team_id_fkey(id, name, logo_url)
        `)
        .eq('user_id', userId)
        .order('last_claimed_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching scarves:', error);
        return;
      }

      setScarves((data as unknown as UserScarf[]) ?? []);
    } catch (error) {
      console.error('❌ Error in fetchScarves:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { scarves, loading, refetch: fetchScarves };
}

/**
 * Comprueba si el usuario ya tiene un claim para un matchId dado.
 * Evita doble-claim desde la UI.
 */
export async function hasClaimedMatch(userId: string, matchId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ticket_claims')
    .select('id')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}
