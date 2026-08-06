import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { fetchFavoriteTeamStatus, setFavoriteTeam, updateFavoriteTeam } from '~/services/users';

const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchFavoriteTeamStatus', () => {
  it('devuelve el estado del equipo favorito del usuario', async () => {
    const status = { favorite_team_id: 'team-1', favorite_team_prompted_at: '2026-01-01T00:00:00.000Z' };
    const builder = createQueryBuilderMock({ data: status, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const result = await fetchFavoriteTeamStatus('user-1');

    expect(mockedFrom).toHaveBeenCalledWith('users');
    expect(builder.select).toHaveBeenCalledWith('favorite_team_id, favorite_team_prompted_at');
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(result).toEqual(status);
  });

  it('lanza el error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    await expect(fetchFavoriteTeamStatus('user-1')).rejects.toEqual({ message: 'boom' });
  });
});

describe('setFavoriteTeam', () => {
  it('actualiza el equipo favorito y setea favorite_team_prompted_at', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await setFavoriteTeam('user-1', 'team-1');

    expect(mockedFrom).toHaveBeenCalledWith('users');
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        favorite_team_id: 'team-1',
        favorite_team_prompted_at: expect.any(String),
      })
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('permite pasar null para descartar el onboarding sin equipo', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await setFavoriteTeam('user-1', null);

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ favorite_team_id: null })
    );
  });

  it('lanza el error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    await expect(setFavoriteTeam('user-1', 'team-1')).rejects.toEqual({ message: 'boom' });
  });
});

describe('updateFavoriteTeam', () => {
  it('actualiza solo el equipo favorito, sin tocar favorite_team_prompted_at', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await updateFavoriteTeam('user-1', 'team-2');

    expect(builder.update).toHaveBeenCalledWith({ favorite_team_id: 'team-2' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('lanza el error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    await expect(updateFavoriteTeam('user-1', 'team-2')).rejects.toEqual({ message: 'boom' });
  });
});
