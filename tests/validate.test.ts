import { describe, expect, it } from 'vitest';
import { toDocument } from '../src/state/document';
import { createInitialState } from '../src/state/initialState';
import { captureFrame } from '../src/state/scenarioOps';
import type { AppState, TacticDocument } from '../src/state/schema';
import { parseTacticDocument, parseTacticJson } from '../src/state/validate';

function richState(): AppState {
  const s = createInitialState();
  const withDrawings: AppState = {
    ...s,
    tacticName: 'Kanat hücumu',
    players: s.players.map((p, i) =>
      i === 1 ? { ...p, name: 'Kaptan', instructions: ['overlap'] } : p,
    ),
    drawings: [
      {
        id: 'a1',
        type: 'arrow',
        style: 'pass',
        from: { kind: 'player', id: 'home-6' },
        to: { kind: 'player', id: 'home-9' },
        bend: 3,
      },
      {
        id: 'z1',
        type: 'zone',
        shape: 'ellipse',
        a: { x: 1, z: 2 },
        b: { x: 10, z: 8 },
        color: '#ff4d6d',
      },
      { id: 'n1', type: 'note', anchor: { kind: 'point', x: 3, z: 4 }, text: 'Pres!' },
    ],
  };
  const frame = captureFrame(withDrawings, 'f1');
  return { ...withDrawings, scenario: { frames: [frame], current: 'f1', speed: 2 } };
}

function roundTrip(doc: TacticDocument) {
  return parseTacticJson(JSON.stringify(doc));
}

function mutate(fn: (d: Record<string, unknown>) => void) {
  const d = JSON.parse(JSON.stringify(toDocument(richState()))) as Record<string, unknown>;
  fn(d);
  return parseTacticDocument(d);
}

describe('tactic document validation', () => {
  it('round-trips a full board through JSON unchanged', () => {
    const doc = toDocument(richState());
    const r = roundTrip(doc);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc).toEqual(doc);
  });

  it('rejects invalid JSON with a Turkish message', () => {
    const r = parseTacticJson('{ not json');
    expect(r).toEqual({ ok: false, error: expect.stringContaining('JSON') });
  });

  it('rejects files that are not tactic documents', () => {
    expect(parseTacticJson('[1,2,3]').ok).toBe(false);
    expect(parseTacticJson('{"hello":"world"}').ok).toBe(false);
  });

  it('rejects unsupported versions', () => {
    const r = mutate((d) => (d.version = 99));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('99');
  });

  it('reports the path of the first invalid field', () => {
    const r = mutate((d) => {
      const players = (d.state as { players: { role: string }[] }).players;
      players[3].role = 'XX';
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('players[3].role');
  });

  it('rejects drawings attached to unknown players', () => {
    const r = mutate((d) => {
      const drawings = (d.state as { drawings: { from?: { id: string } }[] }).drawings;
      const from = drawings[0].from;
      if (from) from.id = 'ghost';
    });
    expect(r.ok).toBe(false);
  });

  it('rejects malformed colours and missing fields', () => {
    expect(
      mutate((d) => ((d.state as { teams: { home: { color: string } } }).teams.home.color = 'red'))
        .ok,
    ).toBe(false);
    expect(mutate((d) => delete (d.state as Record<string, unknown>).ball).ok).toBe(false);
  });

  it('drops a dangling current frame id instead of failing', () => {
    const r = mutate(
      (d) => ((d.state as { scenario: { current: string } }).scenario.current = 'nope'),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc.state.scenario.current).toBeNull();
  });
});
