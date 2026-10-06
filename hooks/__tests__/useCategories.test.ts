jest.mock('~/utils/supabase');

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import { useCategories } from '~/hooks/useCategories';

const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('useCategories', () => {
  it('carga las categorías de la base de datos ordenadas por nombre', async () => {
    const builder = createQueryBuilderMock({ data: [{ id: 'c1', name: 'Pub' }], error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const { result } = await renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedFrom).toHaveBeenCalledWith('bar_categories');
    expect(builder.order).toHaveBeenCalledWith('name');
    expect(result.current.categories).toEqual([{ id: 'c1', name: 'Pub' }]);
    expect(result.current.usingFallback).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('usa categorías de respaldo si la tabla está vacía', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));
    const { result } = await renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.categories.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('usa respaldo y expone el error si Supabase falla; refetch recupera', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );
    const { result } = await renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.error).toContain('boom');

    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: [{ id: 'c1', name: 'Pub' }], error: null })
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.usingFallback).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
