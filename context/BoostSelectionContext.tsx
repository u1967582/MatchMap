import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { LatLng } from '~/utils/geo';

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

/**
 * Provider for sharing boost selection state between list and map
 */
export const BoostSelectionProvider: React.FC<BoostSelectionProviderProps> = ({
  children,
}) => {
  const [selectedBoostBarIds, setSelectedBoostBarIds] = useState<string[]>([]);
  const [centerLatLng, setCenterLatLng] = useState<LatLng | null>(null);

  const value: BoostSelectionContextValue = {
    selectedBoostBarIds,
    centerLatLng,
    setSelectedBoostBarIds: useCallback((ids: string[]) => {
      setSelectedBoostBarIds(ids);
    }, []),
    setCenterLatLng: useCallback((center: LatLng | null) => {
      setCenterLatLng(center);
    }, []),
  };

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
