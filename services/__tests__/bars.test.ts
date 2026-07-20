import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { createAutoPreRegisterBar, fetchBarIdsByMatch, fetchBarIdsByTeam } from '~/services/bars';

const mockedFrom = supabase.from as jest.Mock;
const mockedRpc = supabase.rpc as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchBarIdsByTeam', () => {
  it('llama al RPC con el equipo y onlyFuture=true por defecto, devolviendo los bar_id', async () => {
    mockedRpc.mockResolvedValueOnce({
      data: [{ bar_id: 'bar-1' }, { bar_id: 'bar-2' }],
      error: null,
    });

    const result = await fetchBarIdsByTeam('team-1');

    expect(mockedRpc).toHaveBeenCalledWith('fn_bar_ids_with_team_events', {
      _team: 'team-1',
      _future_only: true,
    });
    expect(result).toEqual(['bar-1', 'bar-2']);
  });

  it('respeta onlyFuture=false cuando se indica', async () => {
    mockedRpc.mockResolvedValueOnce({ data: [], error: null });

    await fetchBarIdsByTeam('team-1', false);

    expect(mockedRpc).toHaveBeenCalledWith('fn_bar_ids_with_team_events', {
      _team: 'team-1',
      _future_only: false,
    });
  });

  it('devuelve [] si data es null', async () => {
    mockedRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await fetchBarIdsByTeam('team-1');

    expect(result).toEqual([]);
  });

  it('lanza el error si el RPC falla', async () => {
    mockedRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    await expect(fetchBarIdsByTeam('team-1')).rejects.toEqual({ message: 'boom' });
  });
});

describe('fetchBarIdsByMatch', () => {
  it('devuelve los bar_id únicos de eventos futuros para el partido', async () => {
    const builder = createQueryBuilderMock({
      data: [{ bar_id: 'bar-1' }, { bar_id: 'bar-2' }, { bar_id: 'bar-1' }],
      error: null,
    });
    mockedFrom.mockReturnValueOnce(builder);

    const result = await fetchBarIdsByMatch('match-1');

    expect(mockedFrom).toHaveBeenCalledWith('events');
    expect(builder.eq).toHaveBeenCalledWith('match_id', 'match-1');
    expect(builder.gte).toHaveBeenCalledWith('start_time', expect.any(String));
    expect(result.sort()).toEqual(['bar-1', 'bar-2']);
  });

  it('devuelve [] si no hay eventos', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));

    const result = await fetchBarIdsByMatch('match-1');

    expect(result).toEqual([]);
  });

  it('lanza el error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    await expect(fetchBarIdsByMatch('match-1')).rejects.toEqual({ message: 'boom' });
  });
});

describe('createAutoPreRegisterBar', () => {
  const basePayload = {
    name: 'Bar Nuevo',
    email: '  Test@Example.com  ',
  };

  it('lanza error si no hay usuario autenticado', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await expect(createAutoPreRegisterBar(basePayload)).rejects.toThrow('Usuario no autenticado');
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('normaliza el email a minúsculas y sin espacios, e inserta con status pre_registered', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    const builder = createQueryBuilderMock({
      data: { id: 'bar-1', email: 'test@example.com', status: 'pre_registered' },
      error: null,
    });
    mockedFrom.mockReturnValueOnce(builder);

    const result = await createAutoPreRegisterBar(basePayload);

    expect(mockedFrom).toHaveBeenCalledWith('auto_pre_register_bars');
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Bar Nuevo',
        email: 'test@example.com',
        created_by_user_id: 'user-1',
        status: 'pre_registered',
      })
    );
    expect(result).toEqual({ id: 'bar-1', email: 'test@example.com', status: 'pre_registered' });
  });

  it('lanza el error si el insert falla', async () => {
    mockedGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'insert failed' } })
    );

    await expect(createAutoPreRegisterBar(basePayload)).rejects.toEqual({
      message: 'insert failed',
    });
  });
});
