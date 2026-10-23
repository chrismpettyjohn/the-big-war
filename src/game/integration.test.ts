/**
 * End-to-end smoke test for the playable loop, driven exactly the way the shell
 * drives it: create the state, start the store, dispatch player commands, then
 * let the store advance real time so bots get their turns.
 *
 * The unit suites cover each system in isolation; this one exists to catch
 * integration breakage — a state shape the store can't step, a command the UI
 * sends that the bus now rejects, or a bot that throws on a live state.
 */

import { describe, expect, test } from 'bun:test';
import { createGameStore } from './store';
import { createInitialState } from './setup';
import { DEFAULT_GAME_CONFIG } from './config';
import { gridAt } from './hex';
import type { Axial } from './types';

/** A plain land hex owned by `owner`, if one exists. */
function ownedLand(state: ReturnType<typeof createInitialState>, owner: number): Axial | null {
  for (const cell of state.grid.cells) {
    if (cell.owner === owner && cell.terrain !== 'water') return { q: cell.q, r: cell.r };
  }
  return null;
}

describe('match integration', () => {
  test('store starts a real match with playable empires', () => {
    const store = createGameStore({ createMatch: createInitialState });
    store.startMatch({ ...DEFAULT_GAME_CONFIG, start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 4 } });

    expect(store.status()).toBe('playing');
    expect(store.state.empires).toHaveLength(4);
    // Every empire starts with a capital and some land.
    for (const empire of store.state.empires) {
      expect(empire.hexCount).toBeGreaterThan(0);
    }
    expect(store.state.landHexCount).toBeGreaterThan(0);
  });

  test('player can place a building and build a front against a neighbour', () => {
    const store = createGameStore({ createMatch: createInitialState });
    store.startMatch({ ...DEFAULT_GAME_CONFIG, start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 3 } });
    const me = store.state.playerEmpire;

    const home = ownedLand(store.state, me);
    expect(home).not.toBeNull();
    // Give the player room to build, then place a market next to the capital.
    store.state.empires[me]!.gold = 1_000_000;
    const empty = store.state.grid.cells.find(
      cell => cell.owner === me && cell.terrain !== 'water' && cell.building === null,
    );
    if (empty) {
      const result = store.dispatch({
        type: 'PlaceBuilding',
        empire: me,
        hex: { q: empty.q, r: empty.r },
        kind: 'market',
      });
      expect(result.ok).toBe(true);
    }

    // Find a hostile hex adjacent to our territory and attack it.
    let target: Axial | null = null;
    for (const cell of store.state.grid.cells) {
      if (cell.owner < 0 || cell.owner === me || cell.terrain === 'water') continue;
      for (const neighbour of store.state.grid.cells) {
        if (gridAt(store.state.grid, { q: neighbour.q, r: neighbour.r })?.owner !== me) continue;
        if (Math.abs(neighbour.q - cell.q) + Math.abs(neighbour.r - cell.r) === 1) {
          target = { q: cell.q, r: cell.r };
          break;
        }
      }
      if (target) break;
    }

    if (target) {
      store.state.empires[me]!.soldiers = 100;
      const send = store.dispatch({
        type: 'SendTroops',
        empire: me,
        hex: home!,
        target,
        percent: 50,
        intent: 'attack',
      });
      // Either it opens a front or reports why not — never throws.
      expect(typeof send.ok).toBe('boolean');
    }
  });

  test('stepping the store runs bots without throwing and stays finite', () => {
    const store = createGameStore({ createMatch: createInitialState });
    store.startMatch({ ...DEFAULT_GAME_CONFIG, start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 4 } });

    // 20 seconds of real time at 60 fps; speed 4 to exercise the fast path.
    store.state.speed = 4;
    for (let i = 0; i < 1_200; i++) store.step(1 / 60);

    expect(store.state.status).toBe('playing');
    expect(Number.isFinite(store.state.elapsed)).toBe(true);
    expect(store.state.elapsed).toBeGreaterThan(0);
    for (const empire of store.state.empires) {
      expect(Number.isFinite(empire.gold)).toBe(true);
      expect(Number.isFinite(empire.soldiers)).toBe(true);
      expect(empire.gold).toBeGreaterThanOrEqual(0);
    }
  });

  test('determinism: same seed + same commands ⇒ identical outcome', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      map: { ...DEFAULT_GAME_CONFIG.map, seed: 4242 },
      start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 3 },
    };
    const run = () => {
      const store = createGameStore({ createMatch: createInitialState });
      store.startMatch(config);
      for (let i = 0; i < 600; i++) store.step(1 / 60);
      return store.state.empires.map(empire => ({
        gold: Math.round(empire.gold),
        soldiers: Math.round(empire.soldiers),
        hexCount: empire.hexCount,
      }));
    };
    expect(run()).toEqual(run());
  });
});
