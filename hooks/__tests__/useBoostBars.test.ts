import { renderHook, waitFor, act } from '@testing-library/react-native';
import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { useBoostBars, useBarBoost, ACTIVATION_MAX_ATTEMPTS } from '~/hooks/useBoostBars';

const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBoostBars - filtro de bares de test', () => {
  it('excluye los bares de test por defecto (includeTestBars=false)', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() => useBoostBars({ centerLatLng: null }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedFrom).toHaveBeenCalledWith('bar_boosts');
    expect(builder.eq).toHaveBeenCalledWith('bars.is_test', false);
  });

  it('incluye los bares de test cuando includeTestBars=true (admin)', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() =>
      useBoostBars({ centerLatLng: null, includeTestBars: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(builder.eq).not.toHaveBeenCalledWith('bars.is_test', false);
  });

  it('no consulta nada si enabled=false', async () => {
    const { result } = await renderHook(() =>
      useBoostBars({ centerLatLng: null, enabled: false })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedFrom).not.toHaveBeenCalled();
  });
});

describe('useBoostBars - filtro de locales de apuestas deportivas', () => {
  it('excluye los locales de apuestas deportivas por defecto (includeBettingBars=false)', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() => useBoostBars({ centerLatLng: null }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(builder.eq).toHaveBeenCalledWith('bars.is_betting_venue', false);
  });

  it('incluye los locales de apuestas deportivas cuando includeBettingBars=true', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() =>
      useBoostBars({ centerLatLng: null, includeBettingBars: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(builder.eq).not.toHaveBeenCalledWith('bars.is_betting_venue', false);
  });
});

describe('useBarBoost - espera de activación tras la compra', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reconsulta hasta que el webhook activa el boost y entonces deja de esperar', async () => {
    jest.useFakeTimers();
    const endAt = '2099-01-01T00:00:00.000Z';
    mockedFrom
      .mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null })) // carga inicial
      .mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null })) // aún pending
      .mockReturnValueOnce(createQueryBuilderMock({ data: { end_at: endAt, status: 'active' }, error: null }));

    const { result } = await renderHook(() => useBarBoost('bar-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boost?.isActive).toBe(false);

    await act(async () => {
      result.current.waitForActivation();
    });
    expect(result.current.isActivating).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => expect(result.current.isActivating).toBe(false));
    expect(result.current.boost).toEqual({ isActive: true, endAt });
    expect(mockedFrom).toHaveBeenCalledTimes(3);
  });

  it('deja de reconsultar tras agotar los intentos si el boost no llega a activarse', async () => {
    jest.useFakeTimers();
    mockedFrom.mockImplementation(() => createQueryBuilderMock({ data: null, error: null }));

    const { result } = await renderHook(() => useBarBoost('bar-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.waitForActivation();
    });

    for (let i = 0; i < ACTIVATION_MAX_ATTEMPTS + 2; i++) {
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
    }

    await waitFor(() => expect(result.current.isActivating).toBe(false));
    // carga inicial + refetch de waitForActivation + ACTIVATION_MAX_ATTEMPTS reintentos
    expect(mockedFrom).toHaveBeenCalledTimes(ACTIVATION_MAX_ATTEMPTS + 2);
    mockedFrom.mockReset();
  });
});
