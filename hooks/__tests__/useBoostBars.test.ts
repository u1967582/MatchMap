import { renderHook, waitFor } from '@testing-library/react-native';
import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { useBoostBars } from '~/hooks/useBoostBars';

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
