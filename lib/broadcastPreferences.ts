/** Clave para identificar un equipo dentro de una competición: "teamId|competitionId" */
export function teamSelectionKey(teamId: string, competitionId: string | number): string {
  return `${teamId}|${String(competitionId)}`;
}

export interface BroadcastPreferencesPayload {
  competition_ids: string[];
  team_ids: string[];
  team_competition_ids: string[];
}

/**
 * Construye el payload para `fn_sync_bar_preferences(_admin)`: descompone las
 * claves "teamId|competitionId" en dos arrays paralelos team_ids/team_competition_ids.
 */
export function buildBroadcastPreferencesPayload(
  selectedCompetitions: Record<string, boolean>,
  selectedTeams: Set<string> | string[]
): BroadcastPreferencesPayload {
  const competition_ids = Object.entries(selectedCompetitions)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const teamPairs = Array.from(selectedTeams).map((key) => {
    const [teamId, competitionId] = key.split('|');
    return { team_id: teamId, competition_id: competitionId };
  });

  return {
    competition_ids,
    team_ids: teamPairs.map((p) => p.team_id),
    team_competition_ids: teamPairs.map((p) => p.competition_id),
  };
}
