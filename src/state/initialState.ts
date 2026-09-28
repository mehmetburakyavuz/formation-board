import { DEFAULT_FORMATION_ID, DEFAULT_NUMBERS, getFormation } from '../data/formations';
import { tr } from '../i18n/tr';
import { slotLayouts } from './formationOps';
import { loadCustomFormations } from './persistence';
import type { AppState, PlayerState, TeamId, TeamState } from './schema';

export function createSquad(team: TeamId, formationId: string): PlayerState[] {
  const formation = getFormation(formationId);
  if (!formation) throw new Error(`Unknown formation ${formationId}`);
  const used = new Set<number>();
  let spare = 12;
  return formation.slots.map((slot, i) => {
    let number = DEFAULT_NUMBERS[slot.role];
    if (number === undefined || used.has(number)) {
      while (used.has(spare)) spare++;
      number = spare;
    }
    used.add(number);
    const layouts = slotLayouts(slot, team);
    return {
      id: `${team}-${i}`,
      team,
      number,
      name: '',
      role: slot.role,
      x: layouts.attack.x,
      z: layouts.attack.z,
      layouts,
      instructions: [],
    };
  });
}

function createTeam(id: TeamId): TeamState {
  const home = id === 'home';
  return {
    id,
    name: home ? tr.teams.home : tr.teams.away,
    color: home ? '#d7263d' : '#1f6fe0',
    numberColor: '#ffffff',
    gkColor: home ? '#f4c20d' : '#22b573',
    formationId: DEFAULT_FORMATION_ID,
    phase: 'attack',
  };
}

export function createInitialState(): AppState {
  return {
    teams: { home: createTeam('home'), away: createTeam('away') },
    players: [
      ...createSquad('home', DEFAULT_FORMATION_ID),
      ...createSquad('away', DEFAULT_FORMATION_ID),
    ],
    ball: { x: 0, z: 0 },
    activeTeam: 'home',
    selection: [],
    settings: { snap: false, showLabels: true, ballScale: 1.5, opponentMode: 'normal' },
    customFormations: loadCustomFormations(),
  };
}
