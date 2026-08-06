import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { useFavoriteTeamOptions } from '~/hooks/useFavoriteTeamOptions';

const mockedRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useFavoriteTeamOptions', () => {
  it('carga las opciones vía RPC y expone isLoading=false al terminar', async () => {
    const options = [
      {
        id: 'team-1',
        name: 'FC Barcelona',
        short_name: 'Barça',
        logo_url: null,
        match_count: 5,
        competition_id: 'comp-1',
        competition_name: 'La Liga',
      },
    ];
    mockedRpc.mockResolvedValueOnce({ data: options, error: null });

    const { result } = await renderHook(() => useFavoriteTeamOptions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedRpc).toHaveBeenCalledWith('get_favorite_team_options');
    expect(result.current.options).toEqual(options);
    expect(result.current.error).toBeNull();
  });

  it('no llama al RPC si enabled=false', async () => {
    const { result } = await renderHook(() => useFavoriteTeamOptions(false));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedRpc).not.toHaveBeenCalled();
    expect(result.current.options).toEqual([]);
  });

  it('devuelve [] y setea error si el RPC falla', async () => {
    mockedRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const { result } = await renderHook(() => useFavoriteTeamOptions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('refetch vuelve a llamar al RPC', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null });

    const { result } = await renderHook(() => useFavoriteTeamOptions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedRpc).toHaveBeenCalledTimes(1);

    result.current.refetch();

    await waitFor(() => expect(mockedRpc).toHaveBeenCalledTimes(2));
  });
});
