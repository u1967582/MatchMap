import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { useFavoritesStore } from '~/stores/favoritesStore';

const mockedFrom = supabase.from as jest.Mock;

const resetStore = () => {
  useFavoritesStore.setState({ favorites: new Set(), userId: null, initialized: false });
};

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
});

describe('setUserId', () => {
  it('sin userId, limpia favoritos y marca initialized sin llamar a Supabase', () => {
    useFavoritesStore.getState().setUserId(null);

    const state = useFavoritesStore.getState();
    expect(state.favorites.size).toBe(0);
    expect(state.initialized).toBe(true);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('con userId, carga los favoritos existentes desde Supabase', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: [{ bar_id: 'bar-1' }, { bar_id: 'bar-2' }], error: null })
    );

    useFavoritesStore.getState().setUserId('user-1');
    // initializeFavorites es async; esperamos a que termine
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = useFavoritesStore.getState();
    expect(state.userId).toBe('user-1');
    expect(state.favorites.has('bar-1')).toBe(true);
    expect(state.favorites.has('bar-2')).toBe(true);
    expect(state.initialized).toBe(true);
  });

  it('si Supabase falla al inicializar, deja favorites vacío pero marca initialized', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    useFavoritesStore.getState().setUserId('user-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = useFavoritesStore.getState();
    expect(state.favorites.size).toBe(0);
    expect(state.initialized).toBe(true);
  });
});

describe('isFavorite', () => {
  it('devuelve true si el barId está en favorites', () => {
    useFavoritesStore.setState({ favorites: new Set(['bar-1']) });
    expect(useFavoritesStore.getState().isFavorite('bar-1')).toBe(true);
  });

  it('devuelve false si el barId no está en favorites', () => {
    expect(useFavoritesStore.getState().isFavorite('bar-1')).toBe(false);
  });
});

describe('addFavorite', () => {
  it('devuelve false y no modifica el estado si no hay usuario', async () => {
    const ok = await useFavoritesStore.getState().addFavorite('bar-1');
    expect(ok).toBe(false);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(false);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('aplica optimistic update antes de que resuelva Supabase', async () => {
    useFavoritesStore.setState({ userId: 'user-1' });
    let resolveInsert: (value: any) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveInsert = resolve;
    });
    mockedFrom.mockReturnValueOnce({
      insert: jest.fn(() => pending),
    });

    const promise = useFavoritesStore.getState().addFavorite('bar-1');

    // Antes de que resuelva la promesa de Supabase, el estado ya está actualizado
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(true);

    resolveInsert({ error: null });
    const ok = await promise;
    expect(ok).toBe(true);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(true);
  });

  it('revierte el optimistic update si Supabase devuelve error', async () => {
    useFavoritesStore.setState({ userId: 'user-1' });
    mockedFrom.mockReturnValueOnce({
      insert: jest.fn(() => Promise.resolve({ error: { message: 'boom' } })),
    });

    const ok = await useFavoritesStore.getState().addFavorite('bar-1');

    expect(ok).toBe(false);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(false);
  });
});

describe('removeFavorite', () => {
  it('devuelve false y no modifica el estado si no hay usuario', async () => {
    useFavoritesStore.setState({ favorites: new Set(['bar-1']) });
    const ok = await useFavoritesStore.getState().removeFavorite('bar-1');
    expect(ok).toBe(false);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(true);
  });

  it('elimina de forma optimista y confirma en éxito', async () => {
    useFavoritesStore.setState({ userId: 'user-1', favorites: new Set(['bar-1']) });
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const ok = await useFavoritesStore.getState().removeFavorite('bar-1');

    expect(ok).toBe(true);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(false);
  });

  it('revierte (vuelve a añadir) si Supabase devuelve error', async () => {
    useFavoritesStore.setState({ userId: 'user-1', favorites: new Set(['bar-1']) });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const ok = await useFavoritesStore.getState().removeFavorite('bar-1');

    expect(ok).toBe(false);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(true);
  });
});

describe('toggleFavorite', () => {
  it('si ya es favorito, llama a removeFavorite', async () => {
    useFavoritesStore.setState({ userId: 'user-1', favorites: new Set(['bar-1']) });
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const ok = await useFavoritesStore.getState().toggleFavorite('bar-1');

    expect(ok).toBe(true);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(false);
  });

  it('si no es favorito, llama a addFavorite', async () => {
    useFavoritesStore.setState({ userId: 'user-1' });
    mockedFrom.mockReturnValueOnce({
      insert: jest.fn(() => Promise.resolve({ error: null })),
    });

    const ok = await useFavoritesStore.getState().toggleFavorite('bar-1');

    expect(ok).toBe(true);
    expect(useFavoritesStore.getState().favorites.has('bar-1')).toBe(true);
  });
});

describe('getFavoriteBars', () => {
  it('devuelve [] si no hay usuario', async () => {
    const bars = await useFavoritesStore.getState().getFavoriteBars();
    expect(bars).toEqual([]);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('usa la imagen con image_order===1 si existe', async () => {
    useFavoritesStore.setState({ userId: 'user-1' });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({
        data: [
          {
            bar_id: 'bar-1',
            bars: {
              id: 'bar-1',
              name: 'Bar Uno',
              bar_images: [
                { image_url: 'segunda.jpg', image_order: 2 },
                { image_url: 'principal.jpg', image_order: 1 },
              ],
            },
          },
        ],
        error: null,
      })
    );

    const bars = await useFavoritesStore.getState().getFavoriteBars();

    expect(bars[0].image_url).toBe('principal.jpg');
  });

  it('si no hay imagen con order 1, usa la primera del array', async () => {
    useFavoritesStore.setState({ userId: 'user-1' });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({
        data: [
          {
            bar_id: 'bar-1',
            bars: {
              id: 'bar-1',
              name: 'Bar Uno',
              bar_images: [{ image_url: 'unica.jpg', image_order: 3 }],
            },
          },
        ],
        error: null,
      })
    );

    const bars = await useFavoritesStore.getState().getFavoriteBars();

    expect(bars[0].image_url).toBe('unica.jpg');
  });

  it('si no hay imágenes, image_url es null', async () => {
    useFavoritesStore.setState({ userId: 'user-1' });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({
        data: [{ bar_id: 'bar-1', bars: { id: 'bar-1', name: 'Bar Uno', bar_images: [] } }],
        error: null,
      })
    );

    const bars = await useFavoritesStore.getState().getFavoriteBars();

    expect(bars[0].image_url).toBeNull();
  });

  it('devuelve [] si Supabase falla', async () => {
    useFavoritesStore.setState({ userId: 'user-1' });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const bars = await useFavoritesStore.getState().getFavoriteBars();

    expect(bars).toEqual([]);
  });
});
