import type { GameState } from './state.types';
import type { HexGrid } from '../map/map.types';
import type { Empire } from '../empire/empire.types';
import type { GameConfig } from '../config/config.types';
import { createRng } from '@the-big-war/game-engine/rng/rng.service';

export function createBaseState(config: GameConfig, grid: HexGrid, empires: Empire[]): GameState {
  return {
    config,
    status: 'playing',
    playerEmpire: 0,
    grid,
    empires,
    fronts: [],
    expeditions: [],
    columns: [],
    landHexCount: grid.cells.length,
    elapsed: 0,
    tick: 0,
    speed: 1,
    rng: createRng(config.map.seed ^ 0x5eed),
    winner: null,
    endReason: null,
    nextBuildingId: 1,
    relations: {},
    offerCooldowns: {},
    pendingOffers: [],
    agentAccumulator: 0,
  };
}
