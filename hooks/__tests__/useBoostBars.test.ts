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

const makeRow = (id: string, lat: number, lng: number, images: any[] = []) => ({
  bar_id: id,
  end_at: '2030-01-01T00:00:00Z',
  bars: {
    id,
    name: `Bar ${id}`,
    latitude: lat,
    longitude: lng,
    rating: 4,
    review_count: 2,
    bar_images: images,
  },
});

describe('useBoostBars - transformación y selección', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('mapea filas a BoostBar, usa la imagen principal y descarta filas sin bar', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce(
      createQueryBuilderMock({
        data: [
          makeRow('a', 41.38, 2.17, [
            { image_url: 'b.jpg', image_order: 2 },
            { image_url: 'a.jpg', image_order: 1 },
          ]),
          { bar_id: 'x', end_at: '2030-01-01', bars: null },
        ],
        error: null,
      })
    );
    const { result } = await renderHook(() => useBoostBars({ centerLatLng: null }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.boostBars).toEqual([
      {
        id: 'a',
        name: 'Bar a',
        lat: 41.38,
        lng: 2.17,
        boost_end_at: '2030-01-01T00:00:00Z',
        rating: 4,
        review_count: 2,
        image_url: 'a.jpg',
      },
    ]);
    expect(result.current.allBoostBarIds).toEqual(['a']);
  });

  it('con ubicación: top 5 más cercanos y 3 seleccionados de entre ellos', async () => {
    // 7 bares a distancias crecientes del centro
    const rows = Array.from({ length: 7 }, (_, i) => makeRow(`b${i}`, 41.38 + i * 0.01, 2.17));
    (supabase.from as jest.Mock).mockReturnValueOnce(
      createQueryBuilderMock({ data: rows, error: null })
    );

    const { result } = await renderHook(() =>
      useBoostBars({ centerLatLng: { lat: 41.38, lng: 2.17 } })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.top5NearestActive.map((b) => b.id)).toEqual([
      'b0',
      'b1',
      'b2',
      'b3',
      'b4',
    ]);
    expect(result.current.selected3Stable).toHaveLength(3);
    const top5 = new Set(result.current.top5NearestActive.map((b) => b.id));
    result.current.selected3Stable.forEach((id) => expect(top5.has(id)).toBe(true));
    expect(result.current.selected3Bars.map((b) => b.id)).toEqual(result.current.selected3Stable);
  });

  it('sin ubicación devuelve como mucho 3 bares aleatorios', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => makeRow(`b${i}`, 41 + i, 2));
    (supabase.from as jest.Mock).mockReturnValueOnce(
      createQueryBuilderMock({ data: rows, error: null })
    );
    const { result } = await renderHook(() => useBoostBars({ centerLatLng: null }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selected3Stable).toHaveLength(3);
  });

  it('la selección es estable entre renders con las mismas coordenadas', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow(`b${i}`, 41.38 + i * 0.01, 2.17));
    (supabase.from as jest.Mock).mockReturnValueOnce(
      createQueryBuilderMock({ data: rows, error: null })
    );
    const { result, rerender } = await renderHook(
      ({ c }: any) => useBoostBars({ centerLatLng: c }),
      { initialProps: { c: { lat: 41.38, lng: 2.17 } } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const first = result.current.selected3Stable;
    await rerender({ c: { lat: 41.38, lng: 2.17 } }); // objeto nuevo, mismas coords
    expect(result.current.selected3Stable).toBe(first);
  });

  it('expone el error si la consulta falla', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: new Error('boom') })
    );
    const { result } = await renderHook(() => useBoostBars({ centerLatLng: null }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.boostBars).toEqual([]);
  });

  it('solo pide boosts activos y no caducados', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);
    const { result } = await renderHook(() => useBoostBars({ centerLatLng: null }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(builder.eq).toHaveBeenCalledWith('status', 'active');
    expect(builder.gt).toHaveBeenCalledWith('end_at', expect.any(String));
  });
});

describe('useBarBoost', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('sin barId devuelve null sin consultar', async () => {
    const { result } = await renderHook(() => useBarBoost(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boost).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('boost activo', async () => {
    const builder = createQueryBuilderMock({
      data: { end_at: '2030-01-01', status: 'active' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(builder);
    const { result } = await renderHook(() => useBarBoost('bar-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boost).toEqual({ isActive: true, endAt: '2030-01-01' });
    expect(builder.eq).toHaveBeenCalledWith('bar_id', 'bar-1');
  });

  it('sin boost o con error → inactivo', async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: null })
    );
    const { result } = await renderHook(() => useBarBoost('bar-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boost).toEqual({ isActive: false, endAt: null });

    (supabase.from as jest.Mock).mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'x' } })
    );
    const r2 = await renderHook(() => useBarBoost('bar-2'));
    await waitFor(() => expect(r2.result.current.isLoading).toBe(false));
    expect(r2.result.current.boost).toEqual({ isActive: false, endAt: null });
  });

  it('refresh vuelve a consultar (p.ej. tras comprar un boost)', async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: { end_at: '2030-01-01' }, error: null }));
    const { result } = await renderHook(() => useBarBoost('bar-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boost?.isActive).toBe(false);

    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.boost?.isActive).toBe(true));
  });
});
