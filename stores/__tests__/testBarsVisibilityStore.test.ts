import { useTestBarsVisibilityStore } from '~/stores/testBarsVisibilityStore';

const resetStore = () => {
  useTestBarsVisibilityStore.setState({ showTestBars: true });
};

beforeEach(() => {
  resetStore();
});

describe('testBarsVisibilityStore', () => {
  it('empieza mostrando los bares de test (showTestBars=true)', () => {
    expect(useTestBarsVisibilityStore.getState().showTestBars).toBe(true);
  });

  it('toggleShowTestBars invierte el valor', () => {
    useTestBarsVisibilityStore.getState().toggleShowTestBars();
    expect(useTestBarsVisibilityStore.getState().showTestBars).toBe(false);

    useTestBarsVisibilityStore.getState().toggleShowTestBars();
    expect(useTestBarsVisibilityStore.getState().showTestBars).toBe(true);
  });
});
