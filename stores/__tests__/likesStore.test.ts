jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import { useLikesStore } from '~/stores/likesStore';

const mockedFrom = supabase.from as jest.Mock;

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  useLikesStore.setState({ likes: new Set(), userId: null, initialized: false });
});

afterEach(() => jest.restoreAllMocks());

describe('setUserId / initializeLikes', () => {
  it('carga los likes del usuario desde review_likes', async () => {
    const builder = createQueryBuilderMock({
      data: [{ review_id: 'r1' }, { review_id: 'r2' }],
      error: null,
    });
    mockedFrom.mockReturnValueOnce(builder);

    useLikesStore.getState().setUserId('user-1');
    await flush();

    expect(mockedFrom).toHaveBeenCalledWith('review_likes');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    const state = useLikesStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.isLiked('r1')).toBe(true);
    expect(state.isLiked('r3')).toBe(false);
  });

  it('al cerrar sesión vacía los likes sin consultar', () => {
    useLikesStore.setState({ likes: new Set(['r1']), userId: 'user-1' });
    useLikesStore.getState().setUserId(null);
    expect(mockedFrom).not.toHaveBeenCalled();
    expect(useLikesStore.getState().likes.size).toBe(0);
    expect(useLikesStore.getState().initialized).toBe(true);
  });

  it('marca initialized aunque falle la carga', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: { message: 'x' } }));
    useLikesStore.getState().setUserId('user-1');
    await flush();
    expect(useLikesStore.getState().initialized).toBe(true);
    expect(useLikesStore.getState().likes.size).toBe(0);
  });
});

describe('addLike / removeLike / toggleLike', () => {
  beforeEach(() => {
    useLikesStore.setState({ userId: 'user-1', initialized: true });
  });

  it('sin usuario no hace nada y devuelve false', async () => {
    useLikesStore.setState({ userId: null });
    await expect(useLikesStore.getState().addLike('r1')).resolves.toBe(false);
    await expect(useLikesStore.getState().removeLike('r1')).resolves.toBe(false);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('addLike inserta en review_likes y marca el like', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await expect(useLikesStore.getState().addLike('r1')).resolves.toBe(true);
    expect(builder.insert).toHaveBeenCalledWith({ user_id: 'user-1', review_id: 'r1' });
    expect(useLikesStore.getState().isLiked('r1')).toBe(true);
  });

  it('addLike es optimista y hace rollback si el servidor falla', async () => {
    let resolve!: (v: any) => void;
    const builder: any = createQueryBuilderMock();
    builder.insert = jest.fn(() => new Promise((r) => (resolve = r)));
    mockedFrom.mockReturnValueOnce(builder);

    const pending = useLikesStore.getState().addLike('r1');
    expect(useLikesStore.getState().isLiked('r1')).toBe(true);

    resolve({ error: { message: 'duplicate' } });
    await expect(pending).resolves.toBe(false);
    expect(useLikesStore.getState().isLiked('r1')).toBe(false);
  });

  it('removeLike borra filtrando por usuario y review', async () => {
    useLikesStore.setState({ likes: new Set(['r1']) });
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await expect(useLikesStore.getState().removeLike('r1')).resolves.toBe(true);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('review_id', 'r1');
    expect(useLikesStore.getState().isLiked('r1')).toBe(false);
  });

  it('removeLike restaura el like si el servidor falla', async () => {
    useLikesStore.setState({ likes: new Set(['r1']) });
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: { message: 'x' } }));
    await expect(useLikesStore.getState().removeLike('r1')).resolves.toBe(false);
    expect(useLikesStore.getState().isLiked('r1')).toBe(true);
  });

  it('toggleLike alterna entre añadir y quitar', async () => {
    mockedFrom.mockImplementation(() => createQueryBuilderMock({ data: null, error: null }));
    await useLikesStore.getState().toggleLike('r1');
    expect(useLikesStore.getState().isLiked('r1')).toBe(true);
    await useLikesStore.getState().toggleLike('r1');
    expect(useLikesStore.getState().isLiked('r1')).toBe(false);
  });

  it('el rollback de un like fallido no borra otros likes hechos mientras tanto', async () => {
    let rejectFirst!: (v: any) => void;
    const slowFailing: any = createQueryBuilderMock();
    slowFailing.insert = jest.fn(() => new Promise((r) => (rejectFirst = r)));
    mockedFrom
      .mockReturnValueOnce(slowFailing)
      .mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const first = useLikesStore.getState().addLike('r1');
    await useLikesStore.getState().addLike('r2'); // éxito mientras r1 sigue pendiente
    rejectFirst({ error: { message: 'x' } });
    await first;

    const state = useLikesStore.getState();
    expect(state.isLiked('r1')).toBe(false);
    expect(state.isLiked('r2')).toBe(true);
  });

  it('el rollback de un unlike fallido no resucita likes quitados mientras tanto', async () => {
    useLikesStore.setState({ likes: new Set(['r1', 'r2']) });
    let resolveFirst!: (v: any) => void;
    const slowFailing: any = createQueryBuilderMock();
    slowFailing.eq = jest.fn(() => slowFailing);
    slowFailing.delete = jest.fn(() => slowFailing);
    slowFailing.then = (f: any, r: any) => new Promise((res) => (resolveFirst = res)).then(f, r);
    mockedFrom
      .mockReturnValueOnce(slowFailing)
      .mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const first = useLikesStore.getState().removeLike('r1');
    await useLikesStore.getState().removeLike('r2');
    resolveFirst({ error: { message: 'x' } });
    await first;

    const state = useLikesStore.getState();
    expect(state.isLiked('r1')).toBe(true);
    expect(state.isLiked('r2')).toBe(false);
  });
});
