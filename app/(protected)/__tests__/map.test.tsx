import React from 'react';
import { act, render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { usePendingNotificationStore } from '~/stores/pendingNotificationStore';
import MapScreen from '~/app/(protected)/map';

const mockMap = jest.fn((_props: { initialMatchId?: string }) => null);
jest.mock('~/components/Map', () => ({
  __esModule: true,
  default: (props: { initialMatchId?: string }) => mockMap(props),
}));
jest.mock('~/components/ui/BottomTabBar', () => () => null);
jest.mock('~/components/ads/AdBanner', () => () => null);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const lastMatchId = () => mockMap.mock.calls[mockMap.mock.calls.length - 1][0].initialMatchId;

beforeEach(() => {
  jest.useFakeTimers();
  mockMap.mockClear();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  usePendingNotificationStore.setState({ matchId: null, handledIds: [] });
});

afterEach(() => jest.useRealTimers());

describe('MapScreen: partido de una notificación (06-H5)', () => {
  it('usa el matchId de la ruta', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ matchId: 'ruta' });
    await render(<MapScreen />);
    expect(lastMatchId()).toBe('ruta');
  });

  it('usa el partido pendiente si otra navegación quitó los parámetros', async () => {
    usePendingNotificationStore.getState().registerTap('n1', 'pendiente');
    await render(<MapScreen />);
    expect(lastMatchId()).toBe('pendiente');
  });

  it('el partido pendiente sobrevive a un remontaje inmediato y luego se olvida', async () => {
    usePendingNotificationStore.getState().registerTap('n1', 'pendiente');
    const first = await render(<MapScreen />);
    await first.unmount();
    await render(<MapScreen />);
    expect(lastMatchId()).toBe('pendiente');

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(usePendingNotificationStore.getState().matchId).toBeNull();
    expect(lastMatchId()).toBeUndefined();
  });
});
