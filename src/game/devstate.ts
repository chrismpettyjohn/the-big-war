/**
 * THROWAWAY dev state — for the renderer engineer to start immediately.
 *
 * `createDevState()` fabricates a plausible, deterministic map + empires + a few
 * fronts so `src/render` and `src/ui` can render and interact before the
 * gameplay engineer finishes the real `createInitialState` (which lives in the
 * gameplay implementation, `src/game/setup.ts`, and is wired up by the store).
 *
 * DO NOT build product logic on this file. It is deliberately cheap: no start
 * guarantees, no balance, no bot setup. When `setup.ts` lands, switch
 * `store.startMatch` to it and delete this file.
 */

import { DEFAULT_GAME_CONFIG, emptyModifierTotals } from './config';
import { area, makeGrid } from './hex';
import { createRng, nextFloat, nextInt } from './rng';
import { NEUTRAL_OWNER } from './types';
import type {
  Building,
  Empire,
  GameConfig,
  GameState,
  HexCell,
  HexGrid,
  Terrain,
} from './types';

/** Terrain mix: mostly plain, with forest/mountain patches and a few lakes. */
function devTerrain(rng: { state: number }): Terrain {
  const roll = nextFloat(rng);
  if (roll < 0.06) return 'water';
  if (roll < 0.22) return 'forest';
  if (roll < 0.32) return 'mountain';
  return 'plain';
}

/**
 * One empire per start slot, spread around the map, each owning a small blob of
 * hexes (a "city" at the centre + a couple of neighbours) so territory, borders
 * and colours are visible. Faction ids cycle through the4 factions.
 */
function devEmpires(config: GameConfig): Empire[] {
  const factions = ['ironclad', 'league', 'verdant', 'academy'];
  const empires: Empire[] = [];
  for (let id = 0; id < config.start.empireCount; id++) {
    empires.push({
      id,
      factionId: factions[id % factions.length]!,
      isHuman: id === 0,
      colorIndex: id,
      gold: config.start.gold,
      science: config.start.science,
      civilians: config.start.civilians,
      civilianBalance: 0,
      soldiers: config.start.soldiers,
      reserveCap: config.recruit.baseReserveCap,
      bonuses: emptyModifierTotals(),
      research: { completed: [], chosen: {}, active: null },
      unlocks: [],
      hexCount: 0,
      alive: true,
      eliminatedAt: null,
    });
  }
  return empires;
}

/** Capital-ish hex for empire id, spread on a ring around the map centre. */
function capitalFor(state: GameState, id: number): { q: number; r: number } {
  const cx = Math.floor(state.grid.width / 2);
  const cy = Math.floor(state.grid.height / 2);
  const count = state.empires.length;
  const angle = (2 * Math.PI * id) / Math.max(1, count);
  const radius = Math.floor(Math.min(state.grid.width, state.grid.height) * 0.3);
  const q = Math.round(cx + radius * Math.cos(angle));
  const r = Math.round(cy + radius * Math.sin(angle));
  return {
    q: Math.max(1, Math.min(state.grid.width - 2, q)),
    r: Math.max(1, Math.min(state.grid.height - 2, r)),
  };
}

/**
 * Fabricate a full, renderable state. Deterministic for a given seed.
 *
 * Produces: terrain, per-empire capital blobs with a level1 city, a couple of
 * farms/markets, and TWO contested fronts between neighbouring empires so the
 * front badges and combat overlay have something to draw.
 */
export function createDevState(config: GameConfig = DEFAULT_GAME_CONFIG): GameState {
  const rng = createRng(config.map.seed);
  const grid = makeGrid<HexCell>(config.map.width, config.map.height, hex => ({
    q: hex.q,
    r: hex.r,
    terrain: devTerrain(rng),
    owner: NEUTRAL_OWNER,
    building: null,
  }));

  let nextBuildingId = 1;
  const build = (cell: HexCell, kind: Building['kind'], level = 1): void => {
    cell.building = { id: nextBuildingId++, kind, level, cooldown: 0, growth: 0, demolishAt: null };
  };

  const state: GameState = {
    config,
    status: 'playing',
    playerEmpire: 0,
    grid: grid as HexGrid,
    empires: [],
    fronts: [],
    landHexCount: 0,
    elapsed: 0,
    tick: 0,
    speed: 1,
    rng: createRng(config.map.seed ^ 0x5eed),
    winner: null,
    endReason: null,
    nextBuildingId,
    botAccumulator: 0,
  };

  state.empires = devEmpires(config);

  // Claim blobs first, then place buildings, so ownership exists for every cell
  // the renderer will look at.
  for (const empire of state.empires) {
    const capital = capitalFor(state, empire.id);
    for (const hex of area(capital, 2)) {
      const cell = grid.cells[hex.r * grid.width + hex.q];
      if (!cell || cell.terrain === 'water') continue;
      cell.owner = empire.id;
    }
    const capCell = grid.cells[capital.r * grid.width + capital.q];
    if (capCell && capCell.owner === empire.id) {
      build(capCell, 'city', empire.id === 0 ? 2 : 1);
      const near = area(capital, 1).filter(h => {
        const c = grid.cells[h.r * grid.width + h.q];
        return c && c.owner === empire.id && c.building === null && c.terrain !== 'water';
      });
      if (near[0]) {
        const c = grid.cells[near[0].r * grid.width + near[0].q]!;
        build(c, 'market');
      }
      if (near[1]) {
        const c = grid.cells[near[1].r * grid.width + near[1].q]!;
        build(c, nextInt(rng, 2) === 0 ? 'farm' : 'barracks');
      }
    }
  }

  // Fabricate two fronts on real hostile edges so combat UI has data.
  const hostileEdges: Array<{ a: { q: number; r: number }; b: { q: number; r: number } }> = [];
  const DIRS = [
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: -1 },
  ];
  for (let r = 0; r < grid.height && hostileEdges.length < 2; r++) {
    for (let q = 0; q < grid.width && hostileEdges.length < 2; q++) {
      const cell = grid.cells[r * grid.width + q]!;
      if (cell.owner === NEUTRAL_OWNER) continue;
      for (const dir of DIRS) {
        const nq = q + dir.q;
        const nr = r + dir.r;
        if (nq < 0 || nr < 0 || nq >= grid.width || nr >= grid.height) continue;
        const other = grid.cells[nr * grid.width + nq]!;
        if (other.owner !== NEUTRAL_OWNER && other.owner !== cell.owner) {
          hostileEdges.push({ a: { q, r }, b: { q: nq, r: nr } });
          break;
        }
      }
    }
  }

  for (const edge of hostileEdges) {
    const cellA = grid.cells[edge.a.r * grid.width + edge.a.q]!;
    const cellB = grid.cells[edge.b.r * grid.width + edge.b.q]!;
    state.fronts.push({
      id: `${edge.a.q},${edge.a.r}|${edge.b.q},${edge.b.r}`,
      hexA: edge.a,
      hexB: edge.b,
      sideA: {
        empire: cellA.owner,
        troops: 40 + nextInt(rng, 40),
        mode: 'attack',
        modifiers: { attack: 1, defence: 1, lines: [] },
      },
      sideB: {
        empire: cellB.owner,
        troops: 30 + nextInt(rng, 40),
        mode: 'defence',
        modifiers: { attack: 1, defence: 1.15, lines: [{ label: 'Forest', attack: 1, defence: 1.15 }] },
      },
      cluster: 0,
      resolution: null,
      lastAttackAt: 0,
    });
  }

  state.landHexCount = grid.cells.filter(cell => cell.terrain !== 'water').length;
  for (const empire of state.empires) {
    empire.hexCount = grid.cells.filter(cell => cell.owner === empire.id).length;
  }

  return state;
}
