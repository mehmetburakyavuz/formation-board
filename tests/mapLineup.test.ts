import { describe, expect, it } from 'vitest';
import type { ApiLineup } from '../src/data/matchImport/apiClient';
import { LineupError, mapLineup, shortName } from '../src/data/matchImport/mapLineup';
import { getFormation } from '../src/data/formations';
import { persistedOf } from '../src/state/document';
import { createInitialState } from '../src/state/initialState';
import { matchBoard } from '../src/state/matchOps';

function lineup(formation: string | null, grids: (string | null)[]): ApiLineup {
  return {
    team: { id: 1, name: 'Test FC' },
    formation,
    startXI: grids.map((grid, i) => ({
      player: {
        id: i,
        name: `P. Player${i}`,
        number: i + 1,
        pos: i === 0 ? 'G' : 'D',
        grid,
      },
    })),
  };
}

const G4231 = ['1:1', '2:1', '2:2', '2:3', '2:4', '3:1', '3:2', '4:1', '4:2', '4:3', '5:1'];
const G3421 = ['1:1', '2:1', '2:2', '2:3', '3:1', '3:2', '3:3', '3:4', '4:1', '4:2', '5:1'];

describe('mapLineup', () => {
  it('uses the built-in slots for a known formation', () => {
    const t = mapLineup(lineup('4-2-3-1', G4231));
    expect(t.formationId).toBe('4-2-3-1');
    expect(t.players).toHaveLength(11);
    const builtIn = (getFormation('4-2-3-1')?.slots ?? []).map((s) => s.role).sort();
    expect(t.players.map((p) => p.role).sort()).toEqual(builtIn);
    // Column 1 of the back four is the left back.
    expect(t.players[1]).toMatchObject({ name: 'Player1', number: 2, role: 'LB' });
    expect(t.players[0].role).toBe('GK');
  });

  it('derives roles and positions for an unknown formation', () => {
    const t = mapLineup(lineup('3-4-2-1', G3421));
    expect(t.formationId).toBe('3-4-2-1');
    expect(t.players.map((p) => p.role)).toEqual([
      'GK',
      'LCB',
      'CB',
      'RCB',
      'LWB',
      'LCM',
      'RCM',
      'RWB',
      'LAM',
      'RAM',
      'ST',
    ]);
    for (const p of t.players) {
      expect(p.nx).toBeGreaterThanOrEqual(0);
      expect(p.nx).toBeLessThanOrEqual(1);
      expect(p.ny).toBeGreaterThanOrEqual(0);
      expect(p.ny).toBeLessThanOrEqual(1);
    }
    // Lines get deeper → higher up the pitch.
    expect(t.players[10].nx).toBeGreaterThan(t.players[8].nx);
    expect(t.players[8].nx).toBeGreaterThan(t.players[4].nx);
  });

  it('rebuilds rows from the formation string when grids are missing', () => {
    const t = mapLineup(lineup('4-4-2', Array(11).fill(null)));
    expect(t.formationId).toBe('4-4-2');
    expect(t.players.filter((p) => p.role === 'GK')).toHaveLength(1);
  });

  it('rejects incomplete or unreadable line-ups', () => {
    expect(() => mapLineup(lineup('4-4-2', G4231.slice(0, 10)))).toThrow(LineupError);
    expect(() => mapLineup(lineup(null, Array(11).fill(null)))).toThrow(LineupError);
  });
});

describe('shortName', () => {
  it('drops initials and shortens long names', () => {
    expect(shortName('K. De Bruyne')).toBe('De Bruyne');
    expect(shortName('Rodri')).toBe('Rodri');
    expect(shortName('Trent Alexander-Arnold')).toBe('Alexander-Arnold');
  });
});

describe('matchBoard', () => {
  it('builds both squads and keeps team colours', () => {
    const s = persistedOf(createInitialState());
    const home = mapLineup(lineup('4-2-3-1', G4231));
    const away = { ...mapLineup(lineup('3-4-2-1', G3421)), name: 'Rakip' };
    const b = matchBoard(s, home, away);
    expect(b.tacticName).toBe('Test FC – Rakip');
    expect(b.teams.home).toMatchObject({ name: 'Test FC', formationId: '4-2-3-1' });
    expect(b.teams.away.color).toBe(s.teams.away.color);
    expect(b.players).toHaveLength(22);
    expect(new Set(b.players.map((p) => p.id)).size).toBe(22);
    // Home keeper on the left half, away keeper on the right half.
    expect(b.players.find((p) => p.id === 'home-0')?.x).toBeLessThan(0);
    expect(b.players.find((p) => p.id === 'away-0')?.x).toBeGreaterThan(0);
    expect(b.drawings).toEqual([]);
    expect(b.scenario.frames).toEqual([]);
  });
});
