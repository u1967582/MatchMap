jest.mock('~/utils/supabase');

import { renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import { useFilterData } from '~/hooks/useFilterData';

const mockedFrom = supabase.from as jest.Mock;

const tables: Record<string, any> = {
  bar_categories: [{ id: 10, name: 'Bar deportivo' }, { id: 11, name: 'Desconocida' }],
  food_types: [{ id: 20, name: 'Italiana' }],
  bar_features: [{ id: 30, name: 'Terraza' }],
  bar_tv_features: [{ id: 40, name: 'TV 4K' }],
};

function mockTables(overrides: Record<string, { data: any; error: any }> = {}) {
  mockedFrom.mockImplementation((table: string) =>
    createQueryBuilderMock(overrides[table] ?? { data: tables[table], error: null })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('useFilterData', () => {
  it('carga las 4 tablas y asigna emojis (con emoji por defecto si no hay mapeo)', async () => {
    mockTables();
    const { result } = await renderHook(() => useFilterData());
    await waitFor(() => expect(result.current.barCategories[0].id).toBe(10));

    expect(result.current.barCategories).toEqual([
      { id: 10, name: 'Bar deportivo', emoji: '⚽️' },
      { id: 11, name: 'Desconocida', emoji: '🏪' },
    ]);
    expect(result.current.foodTypes).toEqual([{ id: 20, name: 'Italiana', emoji: '🍕' }]);
    expect(result.current.barFeatures).toEqual([{ id: 30, name: 'Terraza', emoji: '🌞' }]);
    expect(result.current.tvFeatures).toEqual([{ id: 40, name: 'TV 4K', emoji: '4️⃣' }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('si alguna tabla falla o está vacía, usa los datos de respaldo para todas', async () => {
    mockTables({ bar_tv_features: { data: [], error: null } });
    const { result } = await renderHook(() => useFilterData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.barCategories.find((c) => c.id === 10)).toBeUndefined();
    expect(result.current.tvFeatures.length).toBeGreaterThan(0);
  });

  it('si la consulta lanza, expone error y usa respaldo', async () => {
    mockedFrom.mockImplementation(() => {
      throw new Error('offline');
    });
    const { result } = await renderHook(() => useFilterData());
    await waitFor(() => expect(result.current.error).toBe('Error al cargar los filtros'));
    expect(result.current.foodTypes.length).toBeGreaterThan(0);
    expect(result.current.loading).toBe(false);
  });
});
