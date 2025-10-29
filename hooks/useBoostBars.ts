import { useState, useEffect, useMemo } from 'react';
import { supabase } from '~/utils/supabase';
import { haversineDistance, coordsToKey, type LatLng } from '~/utils/geo';
import { createSeededRandom } from '~/utils/random';

export interface BoostBar {
  id: string;
  name: string;
  lat: number;
  lng: number;
  boost_end_at: string;
  distance?: number;
}

interface UseBoostBarsOptions {
  centerLatLng: LatLng | null;
  enabled?: boolean;
}

interface UseBoostBarsResult {
  boostBars: BoostBar[];
  top5NearestActive: BoostBar[];
  selected3Stable: string[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and select boost bars
 * Returns top 5 nearest active boost bars and 3 randomly selected (but stable)
 */
export function useBoostBars({
  centerLatLng,
  enabled = true,
}: UseBoostBarsOptions): UseBoostBarsResult {
  const [boostBars, setBoostBars] = useState<BoostBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch active boost bars
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchBoostBars() {
      try {
        setIsLoading(true);
        setError(null);

        const now = new Date().toISOString();

        // Query bars with active boosts
        const { data, error: queryError } = await supabase
          .from('bar_boosts')
          .select(`
            bar_id,
            end_at,
            bars (
              id,
              name,
              latitude,
              longitude
            )
          `)
          .eq('status', 'active')
          .gt('end_at', now);

        if (queryError) throw queryError;

        if (!isMounted) return;

        // Transform data
        const bars: BoostBar[] = (data || [])
          .filter((item) => item.bars)
          .map((item) => ({
            id: item.bars.id,
            name: item.bars.name,
            lat: item.bars.latitude,
            lng: item.bars.longitude,
            boost_end_at: item.end_at,
          }));

        setBoostBars(bars);
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching boost bars:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch boost bars'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchBoostBars();

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  // Calculate top 5 nearest and select 3 stable
  const { top5NearestActive, selected3Stable } = useMemo(() => {
    if (!centerLatLng || boostBars.length === 0) {
      return { top5NearestActive: [], selected3Stable: [] };
    }

    // Calculate distances
    const barsWithDistance = boostBars.map((bar) => ({
      ...bar,
      distance: haversineDistance(centerLatLng, { lat: bar.lat, lng: bar.lng }),
    }));

    // Sort by distance and take top 5
    const top5 = barsWithDistance
      .sort((a, b) => a.distance! - b.distance!)
      .slice(0, 5);

    // Create deterministic seed from center coordinates
    const seed = coordsToKey(centerLatLng, 3);
    const rng = createSeededRandom(seed);

    // Pick 3 from top 5 (or all if less than 3)
    const countToSelect = Math.min(3, top5.length);
    const selected = rng.pick(top5, countToSelect);
    const selectedIds = selected.map((bar) => bar.id);

    return {
      top5NearestActive: top5,
      selected3Stable: selectedIds,
    };
  }, [boostBars, centerLatLng]);

  return {
    boostBars,
    top5NearestActive,
    selected3Stable,
    isLoading,
    error,
  };
}

/**
 * Hook to get boost status for a specific bar
 */
export function useBarBoost(barId: string | null) {
  const [boost, setBoost] = useState<{
    isActive: boolean;
    endAt: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!barId) {
      setBoost(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchBarBoost() {
      try {
        setIsLoading(true);

        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('bar_boosts')
          .select('end_at, status')
          .eq('bar_id', barId)
          .eq('status', 'active')
          .gt('end_at', now)
          .order('end_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (!isMounted) return;

        if (data) {
          setBoost({
            isActive: true,
            endAt: data.end_at,
          });
        } else {
          setBoost({
            isActive: false,
            endAt: null,
          });
        }
      } catch (err) {
        console.error('Error fetching bar boost:', err);
        if (isMounted) {
          setBoost({ isActive: false, endAt: null });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchBarBoost();

    return () => {
      isMounted = false;
    };
  }, [barId]);

  return { boost, isLoading };
}
