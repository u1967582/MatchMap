import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { fetchMatchById } from '~/services/matches';

const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchMatchById', () => {
  const match = {
    id: 'match-1',
    date: '2026-06-01',
    time: '20:00',
    home_team_id: 'team-home',
    away_team_id: 'team-away',
    competition_id: 'comp-1',
    status: 'scheduled',
  };

  it('devuelve el partido enriquecido con equipos y competición', async () => {
    const teams = [
      { id: 'team-home', name: 'Home FC', gender: 'male', logo_url: null },
      { id: 'team-away', name: 'Away FC', gender: 'male', logo_url: null },
    ];
    const competitions = [{ id: 'comp-1', name: 'Liga', gender: 'male' }];

    mockedFrom
      .mockReturnValueOnce(createQueryBuilderMock({ data: match, error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: teams, error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: competitions, error: null }));

    const result = await fetchMatchById('match-1');

    expect(mockedFrom).toHaveBeenNthCalledWith(1, 'matches');
    expect(mockedFrom).toHaveBeenNthCalledWith(2, 'teams');
    expect(mockedFrom).toHaveBeenNthCalledWith(3, 'competitions');
    expect(result).toEqual({
      ...match,
      home_team: teams[0],
      away_team: teams[1],
      competition: competitions[0],
    });
  });

  it('devuelve null si el partido no existe', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error: null }));

    const result = await fetchMatchById('missing');

    expect(result).toBeNull();
    expect(mockedFrom).toHaveBeenCalledTimes(1);
  });

  it('lanza el error si falla la consulta del partido', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    await expect(fetchMatchById('match-1')).rejects.toEqual({ message: 'boom' });
  });

  it('deja home_team/away_team undefined si no se encuentran en la respuesta de equipos', async () => {
    mockedFrom
      .mockReturnValueOnce(createQueryBuilderMock({ data: match, error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));

    const result = await fetchMatchById('match-1');

    expect(result?.home_team).toBeUndefined();
    expect(result?.away_team).toBeUndefined();
    expect(result?.competition).toBeUndefined();
  });
});
