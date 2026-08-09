import { create } from 'zustand';

interface TestBarsVisibilityState {
  /** Solo tiene efecto real cuando el usuario actual es admin (ver useIsAdmin) */
  showTestBars: boolean;
  toggleShowTestBars: () => void;
}

export const useTestBarsVisibilityStore = create<TestBarsVisibilityState>((set) => ({
  showTestBars: true,
  toggleShowTestBars: () => set((state) => ({ showTestBars: !state.showTestBars })),
}));
