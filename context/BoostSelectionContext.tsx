import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useMemo, useEffect } from 'react';
import { haversineDistance, type LatLng } from '~/utils/geo';

interface BoostSelectionContextValue {
  selectedBoostBarIds: string[];
  centerLatLng: LatLng | null;
  setSelectedBoostBarIds: (ids: string[]) => void;
  setCenterLatLng: (center: LatLng | null) => void;
}

const BoostSelectionContext = createContext<BoostSelectionContextValue | undefined>(
  undefined
);

interface BoostSelectionProviderProps {
  children: ReactNode;
}

// Configuration constants
const DEBOUNCE_MS = 300; // 300ms debounce for center updates
const DISTANCE_THRESHOLD_M = 50; // 50m threshold to trigger update

/**
 * Check if two arrays of strings are equal
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
}

/**
 * Check if distance between two points exceeds threshold
 */
function exceedsDistanceThreshold(a: LatLng | null, b: LatLng | null, thresholdKm: number): boolean {
  if (a === null || b === null) return true;
  const distanceKm = haversineDistance(a, b);
  return distanceKm > thresholdKm;
}

/**
 * Provider for sharing boost selection state between list and map
 */
export const BoostSelectionProvider: React.FC<BoostSelectionProviderProps> = ({
  children,
}) => {
  const [selectedBoostBarIds, setSelectedBoostBarIdsState] = useState<string[]>([]);
  const [centerLatLng, setCenterLatLngState] = useState<LatLng | null>(null);

  // Use refs to avoid unnecessary updates
  const selectedBoostBarIdsRef = useRef<string[]>([]);
  const centerLatLngRef = useRef<LatLng | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingCenterRef = useRef<LatLng | null>(null);

  const setSelectedBoostBarIds = useCallback((ids: string[]) => {
    // Only update if the array actually changed
    if (!arraysEqual(ids, selectedBoostBarIdsRef.current)) {
      selectedBoostBarIdsRef.current = ids;
      setSelectedBoostBarIdsState(ids);
    }
  }, []);

  const setCenterLatLng = useCallback((center: LatLng | null) => {
    // Store pending center
    pendingCenterRef.current = center;

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the update
    debounceTimerRef.current = setTimeout(() => {
      const newCenter = pendingCenterRef.current;

      // Only update if distance exceeds threshold (50m = 0.05km)
      if (exceedsDistanceThreshold(newCenter, centerLatLngRef.current, 0.05)) {
        centerLatLngRef.current = newCenter;
        setCenterLatLngState(newCenter);
      }
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const value: BoostSelectionContextValue = useMemo(() => ({
    selectedBoostBarIds,
    centerLatLng,
    setSelectedBoostBarIds,
    setCenterLatLng,
  }), [selectedBoostBarIds, centerLatLng, setSelectedBoostBarIds, setCenterLatLng]);

  return (
    <BoostSelectionContext.Provider value={value}>
      {children}
    </BoostSelectionContext.Provider>
  );
};

/**
 * Hook to access boost selection context
 */
export function useBoostSelection(): BoostSelectionContextValue {
  const context = useContext(BoostSelectionContext);
  if (!context) {
    throw new Error('useBoostSelection must be used within BoostSelectionProvider');
  }
  return context;
}
