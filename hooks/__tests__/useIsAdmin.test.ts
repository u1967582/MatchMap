import { renderHook, waitFor } from '@testing-library/react-native';
import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { useIsAdmin } from '~/hooks/useIsAdmin';

const mockedFrom = supabase.from as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useIsAdmin', () => {
  it('devuelve isAdmin=false sin llamar a la tabla users si no hay sesión', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const { result } = await renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('devuelve isAdmin=true si users.is_super_user es true', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: { is_super_user: true }, error: null })
    );

    const { result } = await renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(mockedFrom).toHaveBeenCalledWith('users');
  });

  it('devuelve isAdmin=false si users.is_super_user es false', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: { is_super_user: false }, error: null })
    );

    const { result } = await renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('devuelve isAdmin=false (fail closed) si la consulta a users falla', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const { result } = await renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('devuelve isAdmin=false (fail closed) si supabase.auth.getUser lanza', async () => {
    mockedGetUser.mockRejectedValueOnce(new Error('network error'));

    const { result } = await renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });
});
