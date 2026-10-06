import { act, renderHook } from '@testing-library/react-native';
import { formatCountdown, useCountdown } from '~/hooks/useCountdown';

const NOW = new Date('2026-10-06T12:00:00Z').getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useCountdown', () => {
  it('sin fecha está expirado', async () => {
    const { result } = await renderHook(() => useCountdown(null));
    expect(result.current.expired).toBe(true);
    expect(result.current.totalSeconds).toBe(0);
  });

  it('descompone el tiempo restante en días/horas/minutos/segundos', async () => {
    const end = new Date(NOW + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000).toISOString();
    const { result } = await renderHook(() => useCountdown(end));
    expect(result.current).toMatchObject({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      expired: false,
    });
  });

  it('acepta objetos Date', async () => {
    const { result } = await renderHook(() => useCountdown(new Date(NOW + 90_000)));
    expect(result.current).toMatchObject({ minutes: 1, seconds: 30 });
  });

  it('se actualiza cada segundo y llega a expirado', async () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const { result } = await renderHook(() => useCountdown(new Date(NOW + 2_000).toISOString()));
    expect(result.current.seconds).toBe(2);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.seconds).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.expired).toBe(true);
    expect(clearSpy).toHaveBeenCalled(); // para el intervalo al expirar
    const secondsAtExpiry = result.current.totalSeconds;
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.totalSeconds).toBe(secondsAtExpiry);
  });

  it('una fecha pasada está expirada', async () => {
    const { result } = await renderHook(() => useCountdown(new Date(NOW - 1000)));
    expect(result.current.expired).toBe(true);
  });

  it('limpia el intervalo al desmontar', async () => {
    const setSpy = jest.spyOn(global, 'setInterval');
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = await renderHook(() => useCountdown(new Date(NOW + 60_000)));
    const intervalId = setSpy.mock.results.find((r) => r.type === 'return')?.value;
    expect(intervalId).toBeDefined();
    await unmount();
    expect(clearSpy).toHaveBeenCalledWith(intervalId);
  });

  it('una fecha inválida se trata como expirada (no NaN)', async () => {
    const { result } = await renderHook(() => useCountdown('no-es-una-fecha'));
    expect(result.current.expired).toBe(true);
    expect(formatCountdown(result.current)).toBe('Expirado');
  });
});

describe('formatCountdown', () => {
  const base = { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 1, expired: false };

  it('muestra "Expirado"', () => {
    expect(formatCountdown({ ...base, expired: true })).toBe('Expirado');
  });

  it('formatea con ceros a la izquierda', () => {
    expect(formatCountdown({ ...base, hours: 1, minutes: 2, seconds: 3 })).toBe('01:02:03');
  });

  it('añade los días cuando hay', () => {
    expect(formatCountdown({ ...base, days: 3, hours: 10, minutes: 0, seconds: 9 })).toBe(
      '3d 10:00:09'
    );
  });
});
