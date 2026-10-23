/**
 * Match bootstrapping: real map generation + `createInitialState`.
 *
 * Deterministic for a given `config.map.seed` — every random draw comes from a
 * `createRng` instance, never `Math.random`. The output is a complete
 * `GameState` (terrain, empires, starting territory, starting city) that the
 * store swaps in on `startMatch` (it also sets `status`).
 *
 * Tuning lives in `config.ts`; the only constants here are map-generation
 * shaping parameters collected in `MAP_SHAPE` below.
 */

import { recomputeEmpireBonuses } from './research';
import { emptyModifierTotals } from './config';
import { area, distance, gridAt, gridInBounds, makeGrid } from './hex';
import type { Axial } from './hex';
import { createRng, nextFloat, nextInt } from './rng';
import type { Rng } from './rng';
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

/* ------------------------------------------------------ map generation -- */

/**
 * Map-shape knobs (not gameplay tuning — these only affect how the terrain
 * looks). Patches are seeded blobs rather than per-hex noise so forests and
 * mountain ranges read as coherent regions on the map.
 */
const MAP_SHAPE = {
  /** Number of forest blobs / mountain ranges / water bodies. */
  forestPatches: 26,
  mountainPatches: 18,
  waterPatches: 3,
  /** Blob radius range (hexes). */
  patchMinRadius: 2,
  patchMaxRadius: 5,
  /** Water bodies are drawn as larger, more irregular regions. */
  waterMinRadius: 4,
  waterMaxRadius: 8,
  /** Probability a water hex also floods one random neighbour (irregular edge). */
  waterSpillChance: 0.35,
  /** Reverse of the land share: final terrain pass scatters this much forest. */
  forestVeinChance: 0.06,
  /** Extra (beyond city radius) neutral margin kept around each start. */
  startClearance: 0,
} as const;

/** Paint a soft-edged circular blob of `terrain` centred on `center`. */
function paintBlob(grid: HexGrid, rng: Rng, center: Axial, radius: number, terrain: Terrain): void {
  const target = terrain === 'water' ? 'water' : 'land';
  for (const hex of area(center, radius)) {
    if (!gridInBounds(grid, hex.q, hex.r)) continue;
    // Soft edge: hexes on the outer ring are skipped on a coin flip so blobs
    // are not perfect circles.
    if (distance(center, hex) === radius && nextFloat(rng) < 0.5) continue;
    const cell = gridAt(grid, hex);
    if (!cell) continue;
    // Never overwrite water with land and vice versa except when carving a new
    // lake (so two overlapping patches merge instead of fighting).
    if (target === 'water') cell.terrain = 'water';
    else if (cell.terrain !== 'water') cell.terrain = terrain;
  }
}

/** Generate the deterministic terrain grid for `config`. */
function generateTerrain(config: GameConfig, rng: Rng): HexGrid {
  const { width, height } = config.map;
  const grid = makeGrid<HexCell>(width, height, hex => ({
    q: hex.q,
    r: hex.r,
    terrain: 'plain',
    owner: NEUTRAL_OWNER,
    building: null,
  }));

  const randomCenter = (): Axial => ({
    q: nextInt(rng, width),
    r: nextInt(rng, height),
  });

  for (let i = 0; i < MAP_SHAPE.waterPatches; i++) {
    const radius =
      MAP_SHAPE.waterMinRadius + nextInt(rng, MAP_SHAPE.waterMaxRadius - MAP_SHAPE.waterMinRadius + 1);
    paintBlob(grid, rng, randomCenter(), radius, 'water');
  }
  for (let i = 0; i < MAP_SHAPE.mountainPatches; i++) {
    const radius =
      MAP_SHAPE.patchMinRadius + nextInt(rng, MAP_SHAPE.patchMaxRadius - MAP_SHAPE.patchMinRadius + 1);
    paintBlob(grid, rng, randomCenter(), radius, 'mountain');
  }
  for (let i = 0; i < MAP_SHAPE.forestPatches; i++) {
    const radius =
      MAP_SHAPE.patchMinRadius + nextInt(rng, MAP_SHAPE.patchMaxRadius - MAP_SHAPE.patchMinRadius + 1);
    paintBlob(grid, rng, randomCenter(), radius, 'forest');
  }

  // Scattered forest veins break up the plain expanses.
  for (const cell of grid.cells) {
    if (cell.terrain !== 'plain') continue;
    if (nextFloat(rng) < MAP_SHAPE.forestVeinChance) cell.terrain = 'forest';
  }

  // Water spill: one extra neighbour per lake hex makes coastlines ragged.
  for (const cell of grid.cells) {
    if (cell.terrain !== 'water') continue;
    if (nextFloat(rng) >= MAP_SHAPE.waterSpillChance) continue;
    const dir = nextInt(rng, 6);
    const dq = [1, 1, 0, -1, -1, 0][dir]!;
    const dr = [0, -1, -1, 0, 1, 1][dir]!;
    const neighbour = gridAt(grid, { q: cell.q + dq, r: cell.r + dr });
    if (neighbour) neighbour.terrain = 'water';
  }

  return grid;
}

/* --------------------------------------------------- empire placement ---- */

/**
 * Territory radius (hexes) the starting city grants.
 *
 * The starting city is placed at level 2 (see `START_CITY_LEVEL`), so its
 * territory is `cityTerritoryRadius[1]`. Level 2 rather than 1 on purpose: with
 * the "buildings need space" placement rule, a radius-1 start would have no
 * legal building site at all.
 */
const START_CITY_LEVEL = 2;

function startRadius(config: GameConfig): number {
  const index = Math.min(START_CITY_LEVEL - 1, config.support.cityTerritoryRadius.length - 1);
  return config.support.cityTerritoryRadius[Math.max(0, index)] ?? 1;
}

/** Land hexes owned at start by the empire standing on `capital`. */
function startTerritory(config: GameConfig, grid: HexGrid, capital: Axial): Axial[] {
  const radius = startRadius(config);
  return area(capital, radius).filter(hex => {
    const cell = gridAt(grid, hex);
    return cell !== undefined && cell.terrain !== 'water';
  });
}

/**
 * Pick `count` well-separated land capitals across the map.
 *
 * Deterministic: candidates are scanned in raster order; the first pick is the
 * first land candidate (so the human slot starts top-left), then each further
 * pick is the candidate farthest from everything chosen so far. Ties break on
 * raster order.
 */
function chooseCapitals(config: GameConfig, grid: HexGrid, rng: Rng, count: number): Axial[] {
  const candidates: Axial[] = [];
  const margin = startRadius(config) + 1 + MAP_SHAPE.startClearance;
  for (let r = margin; r < grid.height - margin; r++) {
    for (let q = margin; q < grid.width - margin; q++) {
      const hex = { q, r };
      const cell = gridAt(grid, hex);
      if (!cell || cell.terrain === 'water') continue;
      // Capitals need room: the whole starting territory must be land.
      if (startTerritory(config, grid, hex).length <= startRadius(config)) continue;
      candidates.push(hex);
    }
  }
  if (candidates.length === 0) {
    // Extremely unlikely (all-water map): fall back to any land hexes in order.
    const fallback: Axial[] = [];
    for (const cell of grid.cells) {
      if (cell.terrain !== 'water') fallback.push({ q: cell.q, r: cell.r });
      if (fallback.length >= count) break;
    }
    return fallback;
  }

  const needed = Math.max(1, count);
  const chosen: Axial[] = [candidates[0]!];
  while (chosen.length < needed) {
    let best: Axial | undefined;
    let bestSpacing = -1;
    for (const candidate of candidates) {
      if (chosen.some(existing => existing.q === candidate.q && existing.r === candidate.r)) continue;
      let separation = Infinity;
      for (const existing of chosen) separation = Math.min(separation, distance(existing, candidate));
      if (separation > bestSpacing) {
        bestSpacing = separation;
        best = candidate;
      }
    }
    if (!best) break;
    chosen.push(best);
  }
  // Consume a bounded number of draws so the rng stream stays aligned no matter
  // how many candidates were considered (keeps determinism obvious).
  for (let i = 0; i < needed; i++) nextInt(rng, 1);
  return chosen.slice(0, needed);
}

/* --------------------------------------------------------- empires ----- */

/** Build the starting empire records (territory + cities are placed after). */
function createEmpires(config: GameConfig): Empire[] {
  const empires: Empire[] = [];
  for (let id = 0; id < config.start.empireCount; id++) {
    empires.push({
      id,
      factionId: '',
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

/** Default faction id for a bot slot — cycles the FACTIONS list by empire id. */
export function defaultFactionId(empireId: number, factions: readonly string[]): string {
  if (factions.length === 0) return '';
  return factions[empireId % factions.length] ?? '';
}

/**
 * Assign factions for every empire. The human slot keeps whatever the session
 * picked ('' means "not chosen yet"); bots cycle through `factionIds`.
 */
export function assignBotFactions(state: GameState, factionIds: readonly string[]): void {
  for (const empire of state.empires) {
    if (empire.isHuman && empire.factionId !== '') continue;
    empire.factionId = defaultFactionId(empire.id, factionIds);
    recomputeEmpireBonuses(state, empire.id);
  }
}

/* ------------------------------------------------------- initial state -- */

/**
 * Create a fresh, fully-populated match state from `config`.
 *
 * Deterministic: same `config` (seed included) ⇒ byte-identical state. Does not
 * set `status` (the store owns that); callers that need a running match set
 * `status = 'playing'`.
 */
export function createInitialState(config: GameConfig): GameState {
  const mapRng = createRng(config.map.seed);
  const grid = generateTerrain(config, mapRng);

  const state: GameState = {
    config,
    status: 'playing',
    playerEmpire: 0,
    grid,
    empires: createEmpires(config),
    fronts: [],
    landHexCount: 0,
    elapsed: 0,
    tick: 0,
    speed: 1,
    // The sim rng is a *derived* stream so map generation never shifts gameplay
    // randomness when map-shape params change.
    rng: createRng(config.map.seed ^ 0x5eed),
    winner: null,
    endReason: null,
    nextBuildingId: 1,
    botAccumulator: 0,
  };

  state.landHexCount = grid.cells.reduce((count, cell) => count + (cell.terrain === 'water' ? 0 : 1), 0);

  const capitals = chooseCapitals(config, grid, mapRng, state.empires.length);
  for (let id = 0; id < state.empires.length; id++) {
    const capital = capitals[id];
    if (!capital) continue;
    claimTerritory(state, id, capital);
  }

  recomputeAllBonuses(state);
  refreshHexCounts(state);

  return state;
}

/** Claim the starting territory around `capital` for `empireId`. */
function claimTerritory(state: GameState, empireId: number, capital: Axial): void {
  for (const hex of startTerritory(state.config, state.grid, capital)) {
    const cell = gridAt(state.grid, hex);
    if (cell) cell.owner = empireId;
  }
  placeBuilding(state, capital, 'city', START_CITY_LEVEL);
}

/** Place a building on `hex`, assigning a fresh id. No validation (internal). */
function placeBuilding(state: GameState, hex: Axial, kind: Building['kind'], level = 1): void {
  const cell = gridAt(state.grid, hex);
  if (!cell || cell.building) return;
  cell.building = {
    id: state.nextBuildingId++,
    kind,
    level,
    cooldown: 0,
    growth: 0,
    demolishAt: null,
  };
}

/** Recompute every empire's bonuses (faction + research). */
function recomputeAllBonuses(state: GameState): void {
  for (const empire of state.empires) recomputeEmpireBonuses(state, empire.id);
}

/** Refresh `empire.hexCount` from the grid. */
function refreshHexCounts(state: GameState): void {
  const counts = new Array<number>(state.empires.length).fill(0);
  for (const cell of state.grid.cells) {
    if (cell.owner === NEUTRAL_OWNER || cell.terrain === 'water') continue;
    if (cell.owner >= 0 && cell.owner < counts.length) counts[cell.owner]! += 1;
  }
  for (const empire of state.empires) empire.hexCount = counts[empire.id] ?? 0;
}
