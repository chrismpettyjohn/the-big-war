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

  test('forests cover only a small share of the map', () => {
    const state = createInitialState({ ...DEFAULT_GAME_CONFIG, map: { ...DEFAULT_GAME_CONFIG.map, seed: 3 } });
    const forest = state.grid.cells.filter(cell => cell.terrain === 'forest').length;
    expect(forest / state.grid.cells.length).toBeLessThan(0.1);
  });
});
