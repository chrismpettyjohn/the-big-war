import { describe, expect, test } from 'bun:test';
import { createInitialState } from '@the-big-war/client/game/state/setup.service';
import { DEFAULT_GAME_CONFIG } from '@the-big-war/client/game/config/config.constants';
import { gridAt, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';

describe('map generation', () => {
  test('mountains always sit in ranges, never alone', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = createInitialState({ ...DEFAULT_GAME_CONFIG, map: { ...DEFAULT_GAME_CONFIG.map, seed } });
      for (const cell of state.grid.cells) {
        if (cell.terrain !== 'mountain') continue;
        expect(neighbors(cell).some(hex => gridAt(state.grid, hex)?.terrain === 'mountain')).toBe(true);
      }
    }
  });

  test('every passable tile is reachable, so walls never seal anyone in', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = createInitialState({ ...DEFAULT_GAME_CONFIG, map: { ...DEFAULT_GAME_CONFIG.map, seed } });
      const passable = state.grid.cells.filter(cell => cell.terrain !== 'mountain');
      const seen = new Set<string>([`${passable[0]!.q},${passable[0]!.r}`]);
      const stack = [passable[0]!];
      while (stack.length > 0) {
        const cell = stack.pop()!;
        for (const hex of neighbors(cell)) {
          const next = gridAt(state.grid, hex);
          if (!next || next.terrain === 'mountain' || seen.has(`${hex.q},${hex.r}`)) continue;
          seen.add(`${hex.q},${hex.r}`);
          stack.push(next);
        }
      }
      expect(seen.size).toBe(passable.length);
    }
  });

  test('mountain ridges are long enough to form walls', () => {
    const state = createInitialState({ ...DEFAULT_GAME_CONFIG, map: { ...DEFAULT_GAME_CONFIG.map, seed: 3 } });
    const mountains = state.grid.cells.filter(cell => cell.terrain === 'mountain').length;
    expect(mountains / state.grid.cells.length).toBeGreaterThan(0.04);
  });

  test('ore is rare but present', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = createInitialState({ ...DEFAULT_GAME_CONFIG, map: { ...DEFAULT_GAME_CONFIG.map, seed } });
      const ore = state.grid.cells.filter(cell => cell.terrain === 'ore').length;
      expect(ore).toBeGreaterThan(0);
      expect(ore / state.grid.cells.length).toBeLessThan(0.01);
    }
  });

  test('forests cover only a small share of the map', () => {
    const state = createInitialState({ ...DEFAULT_GAME_CONFIG, map: { ...DEFAULT_GAME_CONFIG.map, seed: 3 } });
    const forest = state.grid.cells.filter(cell => cell.terrain === 'forest').length;
    expect(forest / state.grid.cells.length).toBeLessThan(0.1);
  });
});
