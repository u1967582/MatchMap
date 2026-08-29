import { useBettingBarsVisibilityStore } from '~/stores/bettingBarsVisibilityStore';

const resetStore = () => {
  useBettingBarsVisibilityStore.setState({
    showBettingBars: false,
    isAdultConfirmed: false,
    promptedAt: null,
    hydrated: false,
  });
};

beforeEach(() => {
  resetStore();
});

describe('bettingBarsVisibilityStore', () => {
  it('empieza oculto y sin hidratar (fail-safe: showBettingBars=false)', () => {
    const state = useBettingBarsVisibilityStore.getState();
    expect(state.showBettingBars).toBe(false);
    expect(state.isAdultConfirmed).toBe(false);
    expect(state.hydrated).toBe(false);
  });

  it('setFromServer hidrata el estado con los datos de public.users', () => {
    useBettingBarsVisibilityStore.getState().setFromServer({
      show_betting_bars: true,
      is_adult_confirmed: true,
      betting_bars_prompted_at: '2026-08-16T10:00:00.000Z',
    });

    const state = useBettingBarsVisibilityStore.getState();
    expect(state.showBettingBars).toBe(true);
    expect(state.isAdultConfirmed).toBe(true);
    expect(state.promptedAt).toBe('2026-08-16T10:00:00.000Z');
    expect(state.hydrated).toBe(true);
  });

  it('setShowBettingBars cambia solo la preferencia de visibilidad', () => {
    useBettingBarsVisibilityStore.getState().setFromServer({
      show_betting_bars: false,
      is_adult_confirmed: true,
      betting_bars_prompted_at: '2026-08-16T10:00:00.000Z',
    });

    useBettingBarsVisibilityStore.getState().setShowBettingBars(true);

    const state = useBettingBarsVisibilityStore.getState();
    expect(state.showBettingBars).toBe(true);
    expect(state.isAdultConfirmed).toBe(true);
  });

  it('reset vuelve al estado inicial oculto y sin hidratar', () => {
    useBettingBarsVisibilityStore.getState().setFromServer({
      show_betting_bars: true,
      is_adult_confirmed: true,
      betting_bars_prompted_at: '2026-08-16T10:00:00.000Z',
    });

    useBettingBarsVisibilityStore.getState().reset();

    const state = useBettingBarsVisibilityStore.getState();
    expect(state.showBettingBars).toBe(false);
    expect(state.isAdultConfirmed).toBe(false);
    expect(state.promptedAt).toBe(null);
    expect(state.hydrated).toBe(false);
  });
});
