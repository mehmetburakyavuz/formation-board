import type { ImportedTeam } from '../data/matchImport/mapLineup';
import { slotLayouts } from './formationOps';
import type { PersistedState, PlayerState, TeamId } from './schema';

function squad(team: TeamId, t: ImportedTeam): PlayerState[] {
  return t.players.map((p, i) => {
    const layouts = slotLayouts(p, team);
    return {
      id: `${team}-${i}`,
      team,
      number: p.number,
      name: p.name,
      role: p.role,
      x: layouts.attack.x,
      z: layouts.attack.z,
      layouts,
      instructions: [],
    };
  });
}

/**
 * A fresh board with a real match's line-ups: home on the left, away on the right.
 * Team colours and settings are kept; drawings and the scenario are cleared because they
 * refer to the previous players' positions.
 */
export function matchBoard(
  s: PersistedState,
  home: ImportedTeam,
  away: ImportedTeam,
): PersistedState {
  const team = (id: TeamId, t: ImportedTeam) => ({
    ...s.teams[id],
    name: t.name.slice(0, 60),
    formationId: t.formationId,
    phase: 'attack' as const,
  });
  return {
    ...s,
    tacticName: `${home.name} – ${away.name}`.slice(0, 100),
    teams: { home: team('home', home), away: team('away', away) },
    players: [...squad('home', home), ...squad('away', away)],
    ball: { x: 0, z: 0 },
    drawings: [],
    scenario: { ...s.scenario, frames: [], current: null },
  };
}
