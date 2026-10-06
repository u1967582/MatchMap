import { create } from 'zustand';

interface BettingBarsVisibilityState {
  /** Oculto hasta que se hidrate desde public.users (fail-safe: oculto por defecto) */
  showBettingBars: boolean;
  isAdultConfirmed: boolean;
  promptedAt: string | null;
  hydrated: boolean;
  setFromServer: (data: {
    show_betting_bars: boolean;
    is_adult_confirmed: boolean;
    betting_bars_prompted_at: string | null;
  }) => void;
  setShowBettingBars: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  showBettingBars: false,
  isAdultConfirmed: false,
  promptedAt: null as string | null,
  hydrated: false,
};

export const useBettingBarsVisibilityStore = create<BettingBarsVisibilityState>((set) => ({
  ...initialState,
  setFromServer: (data) =>
    set({
      showBettingBars: data.show_betting_bars,
      isAdultConfirmed: data.is_adult_confirmed,
      promptedAt: data.betting_bars_prompted_at,
      hydrated: true,
    }),
  setShowBettingBars: (value) => set({ showBettingBars: value }),
  reset: () => set(initialState),
}));
