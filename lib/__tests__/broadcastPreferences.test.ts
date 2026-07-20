import { buildBroadcastPreferencesPayload, teamSelectionKey } from '~/lib/broadcastPreferences';

describe('teamSelectionKey', () => {
  it('combina teamId y competitionId con "|"', () => {
    expect(teamSelectionKey('team-1', 42)).toBe('team-1|42');
  });

  it('convierte competitionId numérico a string', () => {
    expect(teamSelectionKey('team-1', '42')).toBe(teamSelectionKey('team-1', 42));
  });
});

describe('buildBroadcastPreferencesPayload', () => {
  it('filtra solo las competiciones marcadas como true', () => {
    const payload = buildBroadcastPreferencesPayload(
      { '1': true, '2': false, '3': true },
      new Set()
    );
    expect(payload.competition_ids.sort()).toEqual(['1', '3']);
  });

  it('devuelve arrays vacíos si no hay nada seleccionado', () => {
    const payload = buildBroadcastPreferencesPayload({}, new Set());
    expect(payload).toEqual({ competition_ids: [], team_ids: [], team_competition_ids: [] });
  });

  it('descompone las claves "teamId|competitionId" en arrays paralelos', () => {
    const selectedTeams = new Set([teamSelectionKey('team-a', 10), teamSelectionKey('team-b', 20)]);
    const payload = buildBroadcastPreferencesPayload({}, selectedTeams);

    expect(payload.team_ids).toHaveLength(2);
    expect(payload.team_competition_ids).toHaveLength(2);

    const teamAIndex = payload.team_ids.indexOf('team-a');
    expect(payload.team_competition_ids[teamAIndex]).toBe('10');

    const teamBIndex = payload.team_ids.indexOf('team-b');
    expect(payload.team_competition_ids[teamBIndex]).toBe('20');
  });

  it('acepta un array además de un Set para selectedTeams', () => {
    const payload = buildBroadcastPreferencesPayload({}, [teamSelectionKey('team-a', 10)]);
    expect(payload.team_ids).toEqual(['team-a']);
    expect(payload.team_competition_ids).toEqual(['10']);
  });

  it('un mismo equipo en dos competiciones distintas genera dos entradas independientes', () => {
    const selectedTeams = new Set([teamSelectionKey('team-a', 10), teamSelectionKey('team-a', 20)]);
    const payload = buildBroadcastPreferencesPayload({}, selectedTeams);
    expect(payload.team_ids).toEqual(['team-a', 'team-a']);
    expect(payload.team_competition_ids.sort()).toEqual(['10', '20']);
  });
});
