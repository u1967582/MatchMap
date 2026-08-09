import { useState, useEffect, useMemo, useCallback } from 'react';
import { Image } from 'react-native';
import { supabase } from '~/utils/supabase';
import { haversineDistance, type LatLng } from '~/utils/geo';

export interface BoostBar {
  id: string;
  name: string;
  lat: number;
  lng: number;
  boost_end_at: string;
  distance?: number;
  rating?: number;
  review_count?: number;
  image_url?: string;
}

interface UseBoostBarsOptions {
  centerLatLng: LatLng | null;
  enabled?: boolean;
  /** Incluir bares marcados como "de test" (solo debe activarse para el admin) */
  includeTestBars?: boolean;
}

interface UseBoostBarsResult {
  boostBars: BoostBar[];
  allBoostBarIds: string[];
  top5NearestActive: BoostBar[];
  selected3Stable: string[];
  selected3Bars: BoostBar[];
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
  includeTestBars = false,
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
        let boostsQuery = supabase
          .from('bar_boosts')
          .select(`
            bar_id,
            end_at,
            bars!inner (
              id,
              name,
              latitude,
              longitude,
              rating,
              review_count,
              is_test,
              bar_images (image_url, image_order)
            )
          `)
          .eq('status', 'active')
          .gt('end_at', now);

        // Los bares de test solo son visibles para el admin
        if (!includeTestBars) {
          boostsQuery = boostsQuery.eq('bars.is_test', false);
        }

        const { data, error: queryError } = await boostsQuery;

        if (queryError) throw queryError;

        if (!isMounted) return;

        // Transform data
        const bars: BoostBar[] = (data || [])
          .filter((item) => item.bars && !Array.isArray(item.bars))
          .map((item) => {
            const bar = item.bars as unknown as {
              id: string;
              name: string;
              latitude: number;
              longitude: number;
              rating?: number;
              review_count?: number;
              bar_images?: { image_url: string; image_order: number }[];
            };
            const images = bar.bar_images || [];
            const mainImage =
              images.find((img) => img.image_order === 1)?.image_url ||
              images[0]?.image_url;
            return {
              id: bar.id,
              name: bar.name,
              lat: bar.latitude,
              lng: bar.longitude,
              boost_end_at: item.end_at,
              rating: bar.rating,
              review_count: bar.review_count,
              image_url: mainImage,
            };
          });

        setBoostBars(bars);

        // Prefetch images so they están listas cuando aparezca el popup
        bars.forEach((bar) => {
          if (bar.image_url) Image.prefetch(bar.image_url);
        });
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
  }, [enabled, includeTestBars]);

  const allBoostBarIds = useMemo(() => boostBars.map((b) => b.id), [boostBars]);

  // Extract primitives to avoid re-running the memo when a new object with same coords is passed
  const centerLat = centerLatLng?.lat ?? null;
  const centerLng = centerLatLng?.lng ?? null;

  // Calculate top 5 nearest and select 3 randomly.
  // When location is not yet available, fall back to up to 3 random bars so the
  // popup can show immediately after the fetch completes instead of waiting for GPS.
  const { top5NearestActive, selected3Stable, selected3Bars } = useMemo(() => {
    if (boostBars.length === 0) {
      return { top5NearestActive: [], selected3Stable: [], selected3Bars: [] };
    }

    // No location yet — return up to 3 random bars as a temporary selection
    if (centerLat === null || centerLng === null) {
      const randomized = [...boostBars].sort(() => Math.random() - 0.5).slice(0, 3);
      return {
        top5NearestActive: randomized,
        selected3Stable: randomized.map((bar) => bar.id),
        selected3Bars: randomized,
      };
    }

    const center = { lat: centerLat, lng: centerLng };

    // Calculate distances
    const barsWithDistance = boostBars.map((bar) => ({
      ...bar,
      distance: haversineDistance(center, { lat: bar.lat, lng: bar.lng }),
    }));

    // Sort by distance and take top 5
    const top5 = barsWithDistance
      .sort((a, b) => a.distance! - b.distance!)
      .slice(0, 5);

    // Pick 3 randomly from top 5
    const countToSelect = Math.min(3, top5.length);
    const shuffled = [...top5].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, countToSelect);

    return {
      top5NearestActive: top5,
      selected3Stable: selected.map((bar) => bar.id),
      selected3Bars: selected,
    };
  }, [boostBars, centerLat, centerLng]);

  return {
    boostBars,
    allBoostBarIds,
    top5NearestActive,
    selected3Stable,
    selected3Bars,
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
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [barId, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { boost, isLoading, refresh };
}
