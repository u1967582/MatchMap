jest.mock('~/utils/supabase');

import { renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import { useFavorites } from '~/hooks/useFavorites';

const mockedSupabase = supabase as any;
const user = { id: 'user-1' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function renderWithUser(u: any = user) {
  mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: u }, error: null });
  const hook = await renderHook(() => useFavorites());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useFavorites', () => {
  it('sin usuario todas las operaciones devuelven false/[] sin consultar', async () => {
    const { result } = await renderWithUser(null);
    expect(result.current.user).toBeNull();
    await expect(result.current.isFavorite('b')).resolves.toBe(false);
    await expect(result.current.addToFavorites('b')).resolves.toBe(false);
    await expect(result.current.removeFromFavorites('b')).resolves.toBe(false);
    await expect(result.current.getFavoriteBars()).resolves.toEqual([]);
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('isFavorite consulta por usuario y bar', async () => {
    const { result } = await renderWithUser();
    const builder = createQueryBuilderMock({ data: { id: 'f1' }, error: null });
    mockedSupabase.from.mockReturnValueOnce(builder);
    await expect(result.current.isFavorite('bar-1')).resolves.toBe(true);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('bar_id', 'bar-1');
  });

  it('toggleFavorite añade si no era favorito', async () => {
    const { result } = await renderWithUser();
    const insertBuilder = createQueryBuilderMock({ data: null, error: null });
    mockedSupabase.from
      .mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }))
      .mockReturnValueOnce(insertBuilder);
    await expect(result.current.toggleFavorite('bar-1')).resolves.toBe(true);
    expect(insertBuilder.insert).toHaveBeenCalledWith({ user_id: 'user-1', bar_id: 'bar-1' });
  });

  it('toggleFavorite quita si ya era favorito', async () => {
    const { result } = await renderWithUser();
    const deleteBuilder = createQueryBuilderMock({ data: null, error: null });
    mockedSupabase.from
      .mockReturnValueOnce(createQueryBuilderMock({ data: { id: 'f1' }, error: null }))
      .mockReturnValueOnce(deleteBuilder);
    await expect(result.current.toggleFavorite('bar-1')).resolves.toBe(true);
    expect(deleteBuilder.delete).toHaveBeenCalled();
  });

  it('devuelve false si Supabase falla', async () => {
    const { result } = await renderWithUser();
    mockedSupabase.from.mockReturnValue(createQueryBuilderMock({ data: null, error: { message: 'x' } }));
    await expect(result.current.isFavorite('b')).resolves.toBe(false);
    await expect(result.current.addToFavorites('b')).resolves.toBe(false);
    await expect(result.current.removeFromFavorites('b')).resolves.toBe(false);
    await expect(result.current.getFavoriteBars()).resolves.toEqual([]);
  });

  it('getFavoriteBars elige la imagen principal e ignora bares no visibles', async () => {
    const { result } = await renderWithUser();
    mockedSupabase.from.mockReturnValueOnce(
      createQueryBuilderMock({
        data: [
          { bar_id: 'oculto', bars: null },
          {
            bar_id: 'bar-1',
            bars: {
              id: 'bar-1',
              bar_images: [
                { image_url: 'b.jpg', image_order: 2 },
                { image_url: 'a.jpg', image_order: 1 },
              ],
            },
          },
        ],
        error: null,
      })
    );
    const bars = await result.current.getFavoriteBars();
    expect(bars).toEqual([expect.objectContaining({ id: 'bar-1', image_url: 'a.jpg' })]);
  });
});
