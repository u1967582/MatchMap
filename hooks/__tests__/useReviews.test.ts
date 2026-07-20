import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { useReviews } from '~/hooks/useReviews';

const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getBarReviews', () => {
  it('devuelve las reviews del bar', async () => {
    const reviews = [{ id: 'r1', bar_id: 'bar-1', rating: 5 }];
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: reviews, error: null }));

    const { result } = await renderHook(() => useReviews());
    let returned: any;
    await act(async () => {
      returned = await result.current.getBarReviews('bar-1');
    });

    expect(returned).toEqual(reviews);
    expect(result.current.error).toBeNull();
  });

  it('devuelve [] y setea error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const { result } = await renderHook(() => useReviews());
    let returned: any;
    await act(async () => {
      returned = await result.current.getBarReviews('bar-1');
    });

    expect(returned).toEqual([]);
    await waitFor(() => expect(result.current.error).toBe('Failed to load reviews'));
  });
});

describe('getBarReviewStats', () => {
  it('devuelve ceros si no hay reviews', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));

    const { result } = await renderHook(() => useReviews());
    let stats: any;
    await act(async () => {
      stats = await result.current.getBarReviewStats('bar-1');
    });

    expect(stats).toEqual({
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('calcula la media redondeada a 1 decimal y la distribución por bucket', async () => {
    const ratings = [5, 5, 4, 3, 3, 3].map((rating, i) => ({ rating, id: `r${i}` }));
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: ratings, error: null }));

    const { result } = await renderHook(() => useReviews());
    let stats: any;
    await act(async () => {
      stats = await result.current.getBarReviewStats('bar-1');
    });

    // (5+5+4+3+3+3)/6 = 3.833... -> 3.8
    expect(stats.average_rating).toBe(3.8);
    expect(stats.total_reviews).toBe(6);
    expect(stats.rating_distribution).toEqual({ 1: 0, 2: 0, 3: 3, 4: 1, 5: 2 });
  });

  it('devuelve null y setea error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const { result } = await renderHook(() => useReviews());
    let stats: any;
    await act(async () => {
      stats = await result.current.getBarReviewStats('bar-1');
    });

    expect(stats).toBeNull();
    await waitFor(() => expect(result.current.error).toBe('Failed to load review statistics'));
  });
});

describe('getUserReview', () => {
  it('devuelve la review del usuario si existe', async () => {
    const review = { id: 'r1', bar_id: 'bar-1', user_id: 'u1', rating: 4 };
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: review, error: null }));

    const { result } = await renderHook(() => useReviews());
    let returned: any;
    await act(async () => {
      returned = await result.current.getUserReview('bar-1', 'u1');
    });

    expect(returned).toEqual(review);
  });

  it('trata el error PGRST116 (no encontrado) como éxito con data null', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { code: 'PGRST116', message: 'not found' } })
    );

    const { result } = await renderHook(() => useReviews());
    let returned: any;
    await act(async () => {
      returned = await result.current.getUserReview('bar-1', 'u1');
    });

    expect(returned).toBeNull();
  });

  it('devuelve null si hay otro tipo de error', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { code: 'OTHER', message: 'boom' } })
    );

    const { result } = await renderHook(() => useReviews());
    let returned: any;
    await act(async () => {
      returned = await result.current.getUserReview('bar-1', 'u1');
    });

    expect(returned).toBeNull();
  });
});

describe('createReview', () => {
  it('devuelve true en éxito, recorta el comentario', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() => useReviews());
    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.createReview('bar-1', 'u1', 5, '  genial  ');
    });

    expect(ok).toBe(true);
    expect(builder.insert).toHaveBeenCalledWith({
      bar_id: 'bar-1',
      user_id: 'u1',
      rating: 5,
      comment: 'genial',
    });
  });

  it('envía comment null si no se proporciona comentario', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() => useReviews());
    await act(async () => {
      await result.current.createReview('bar-1', 'u1', 5);
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
  });

  it('devuelve false y setea error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const { result } = await renderHook(() => useReviews());
    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.createReview('bar-1', 'u1', 5);
    });

    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.error).toBe('Failed to create review'));
  });
});

describe('updateReview', () => {
  it('devuelve true en éxito', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const { result } = await renderHook(() => useReviews());
    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.updateReview('r1', 4, 'bien');
    });

    expect(ok).toBe(true);
  });

  it('devuelve false si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const { result } = await renderHook(() => useReviews());
    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.updateReview('r1', 4);
    });

    expect(ok).toBe(false);
  });
});

describe('deleteReview', () => {
  it('devuelve true en éxito', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const { result } = await renderHook(() => useReviews());
    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.deleteReview('r1');
    });

    expect(ok).toBe(true);
  });

  it('devuelve false si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const { result } = await renderHook(() => useReviews());
    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.deleteReview('r1');
    });

    expect(ok).toBe(false);
  });
});
