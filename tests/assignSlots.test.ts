import { describe, expect, it } from 'vitest';
import { getFormation, FORMATIONS, type Formation } from '../src/data/formations';
import { assignSlots, roleLine, type SlotCandidate } from '../src/logic/assignSlots';

function squadFrom(f: Formation): SlotCandidate[] {
  return f.slots.map((s, i) => ({ id: `p${i}`, role: s.role, nx: s.nx, ny: s.ny }));
}

function mustGet(id: string): Formation {
  const f = getFormation(id);
  if (!f) throw new Error(`missing ${id}`);
  return f;
}

/** Role each player receives after the assignment. */
function rolesAfter(from: Formation, to: Formation): Map<string, string> {
  const players = squadFrom(from);
  const res = assignSlots(players, to.slots);
  const out = new Map<string, string>();
  for (const p of players) {
    const slot = res.get(p.id);
    if (slot === undefined) throw new Error(`${p.id} unassigned`);
    out.set(p.role, to.slots[slot].role);
  }
  return out;
}

describe('assignSlots', () => {
  it('is a bijection for every pair of preset formations', () => {
    for (const a of FORMATIONS) {
      for (const b of FORMATIONS) {
        const res = assignSlots(squadFrom(a), b.slots);
        expect(res.size).toBe(11);
        expect(new Set(res.values()).size).toBe(11);
      }
    }
  });

  it('maps a formation onto itself as identity', () => {
    for (const f of FORMATIONS) {
      const res = assignSlots(squadFrom(f), f.slots);
      f.slots.forEach((_, i) => expect(res.get(`p${i}`)).toBe(i));
    }
  });

  it('keeps the goalkeeper in goal', () => {
    for (const a of FORMATIONS) {
      for (const b of FORMATIONS) {
        const res = assignSlots(squadFrom(a), b.slots);
        expect(b.slots[res.get('p0') ?? -1].role).toBe('GK');
      }
    }
  });

  it('prefers identical roles', () => {
    const m = rolesAfter(mustGet('4-4-2'), mustGet('3-5-2'));
    expect(m.get('LCB')).toBe('LCB');
    expect(m.get('RCB')).toBe('RCB');
    expect(m.get('LCM')).toBe('LCM');
    expect(m.get('RCM')).toBe('RCM');
    expect(m.get('LS')).toBe('LS');
    expect(m.get('RS')).toBe('RS');
  });

  it('then prefers the same line, by distance (4-4-2 → 3-5-2)', () => {
    const m = rolesAfter(mustGet('4-4-2'), mustGet('3-5-2'));
    expect(m.get('LB')).toBe('LWB');
    // One defender has to fill the extra centre-back slot; the nearest full-back tucks in
    // and the wide midfielder on that side becomes the wing-back.
    expect(m.get('RB')).toBe('CB');
    expect(m.get('RM')).toBe('RWB');
    expect(m.get('LM')).toBe('CM');
  });

  it('never sends a player across to the opposite flank between presets', () => {
    for (const a of FORMATIONS) {
      for (const b of FORMATIONS) {
        const players = squadFrom(a);
        const res = assignSlots(players, b.slots);
        for (const p of players) {
          const to = b.slots[res.get(p.id) ?? -1];
          const crossed = (p.ny < 0.35 && to.ny > 0.65) || (p.ny > 0.65 && to.ny < 0.35);
          expect(crossed, `${a.id}→${b.id}: ${p.role}→${to.role}`).toBe(false);
        }
      }
    }
  });

  it('4-4-2 → 4-3-3: strikers lead the line, left midfielder becomes the left winger', () => {
    const m = rolesAfter(mustGet('4-4-2'), mustGet('4-3-3'));
    expect(m.get('LM')).toBe('LW');
    expect(['ST', 'RW', 'LW']).toContain(m.get('LS'));
    expect(['ST', 'RW']).toContain(m.get('RS'));
    expect(roleLine('CDM')).toBe('MID');
  });

  it('is deterministic', () => {
    const a = assignSlots(squadFrom(mustGet('4-2-3-1')), mustGet('5-3-2').slots);
    const b = assignSlots(squadFrom(mustGet('4-2-3-1')), mustGet('5-3-2').slots);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('uses current positions for players with custom placements', () => {
    // Two players with the same role; the one standing near the right flank takes RW.
    const players: SlotCandidate[] = [
      { id: 'a', role: 'ST', nx: 0.6, ny: 0.1 },
      { id: 'b', role: 'ST', nx: 0.6, ny: 0.9 },
    ];
    const res = assignSlots(players, [
      { role: 'LW', nx: 0.65, ny: 0.13 },
      { role: 'RW', nx: 0.65, ny: 0.87 },
    ]);
    expect(res.get('a')).toBe(0);
    expect(res.get('b')).toBe(1);
  });
});
