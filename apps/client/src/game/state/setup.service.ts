import type { GameState } from './state.types';
import type { HexGrid } from '../map/map.types';
import { MAP_SHAPE } from '../map/map.constants';
import { createBaseState } from './state.service';
import { isPassable } from '../map/terrain.service';
import { empireNames } from '../names/names.service';
import type { Empire } from '../empire/empire.types';
import type { GameConfig } from '../config/config.types';
import { NEUTRAL_OWNER } from '../empire/empire.constants';
import { createBuilding } from '../building/building.service';
import { defaultFactionId } from '../faction/faction.service';
import type { BuildingKind } from '../building/building.types';
import type { Rng } from '@the-big-war/game-engine/rng/rng.types';
import { createEmpire, refreshHexCounts } from '../empire/empire.service';
import { createRng, nextInt } from '@the-big-war/game-engine/rng/rng.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { generateTerrain, pruneLoneMountains } from '../map/map-generator.service';
import { recomputeAllBonuses, recomputeEmpireBonuses } from '../research/research.service';
import { NEUTRAL_PLOT, PLOT_AFTER, PLOT_BEFORE, START_CITY_LEVEL, START_PLOT } from './setup.constants';
import { area, distance, gridAt, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';

function startPlot(capital: Axial, size = START_PLOT): Axial[] {
  const before = Math.floor((size - 1) / 2);
  const after = size - 1 - before;
  const plot: Axial[] = [];
  for (let r = capital.r - before; r <= capital.r + after; r++) {
    for (let q = capital.q - before; q <= capital.q + after; q++) plot.push({ q, r });
  }
  return plot;
}

function chooseCapitals(grid: HexGrid, rng: Rng, count: number, extra = 0): Axial[] {
  const candidates: Axial[] = [];
  const before = PLOT_BEFORE + MAP_SHAPE.startClearance;
  const after = PLOT_AFTER + MAP_SHAPE.startClearance;
  for (let r = before; r < grid.height - after; r++) {
    for (let q = before; q < grid.width - after; q++) {
      const hex = { q, r };
      const cell = gridAt(grid, hex);
      if (!cell || !isPassable(cell.terrain)) continue;
      candidates.push(hex);
    }
  }
  if (candidates.length === 0) {

    const fallback: Axial[] = [];
    for (const cell of grid.cells) {
      fallback.push({ q: cell.q, r: cell.r });
      if (fallback.length >= count) break;
    }
    return fallback;
  }

  const needed = Math.max(1, count) + extra;
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

  for (let i = 0; i < needed; i++) nextInt(rng, 1);
  const contenders = chosen.slice(0, needed - extra).sort((a, b) => a.q - b.q || a.r - b.r);
  return [...contenders, ...chosen.slice(needed - extra, needed)];
}

function neutralStateCount(config: GameConfig): number {
  return Math.max(0, Math.floor(config.start.neutralStates ?? 0));
}

function createEmpires(config: GameConfig): Empire[] {
  const empires: Empire[] = [];
  const total = config.start.empireCount + neutralStateCount(config);
  const names = empireNames(config.map.seed, total);
  for (let id = 0; id < total; id++) {
    empires.push(
      createEmpire(config, {
        id,
        name: id === 0 ? (config.start.humanName?.trim() || 'Zombo') : (names[id] ?? `Empire ${id}`),
        factionId: '',
        isHuman: id === 0,
        neutralState: id >= config.start.empireCount,
      }),
    );
  }
  return empires;
}

export function assignBotFactions(state: GameState, factionIds: readonly string[]): void {
  for (const empire of state.empires) {
    if (empire.isHuman && empire.factionId !== '') continue;
    empire.factionId = defaultFactionId(empire.id, factionIds);
    recomputeEmpireBonuses(state, empire.id);
  }
}

export function createInitialState(config: GameConfig): GameState {
  const mapRng = createRng(config.map.seed);
  const grid: HexGrid = generateTerrain(config, mapRng);
  const state = createBaseState(config, grid, createEmpires(config));

  const capitals = chooseCapitals(grid, mapRng, config.start.empireCount, neutralStateCount(config));
  for (let id = 0; id < state.empires.length; id++) {
    const capital = capitals[id];
    if (!capital) continue;
    claimTerritory(state, id, capital, state.empires[id]!.neutralState ? NEUTRAL_PLOT : START_PLOT);
  }

  pruneLoneMountains(grid);
  recomputeAllBonuses(state);
  refreshHexCounts(state);

  return state;
}

function claimTerritory(state: GameState, empireId: number, capital: Axial, size: number): void {
  for (const hex of area(capital, MAP_SHAPE.capitalClearing)) {
    const cell = gridAt(state.grid, hex);
    if (cell?.terrain === 'mountain') cell.terrain = 'plain';
  }
  const plot = new Set(startPlot(capital, size).map(hex => `${hex.q},${hex.r}`));
  const queue: Axial[] = [capital];
  plot.delete(`${capital.q},${capital.r}`);
  for (let head = 0; head < queue.length; head++) {
    const cell = gridAt(state.grid, queue[head]!);
    if (!cell || cell.owner !== NEUTRAL_OWNER || !isPassable(cell.terrain)) continue;
    cell.owner = empireId;
    for (const next of neighbors(cell)) {
      if (!plot.delete(`${next.q},${next.r}`)) continue;
      queue.push(next);
    }
  }
  if (gridAt(state.grid, capital)?.owner === empireId) placeStartBuilding(state, capital, 'city', START_CITY_LEVEL);
}

function placeStartBuilding(state: GameState, hex: Axial, kind: BuildingKind, level = 1): void {
  const cell = gridAt(state.grid, hex);
  if (!cell || cell.building) return;
  cell.terrain = 'plain';
  cell.building = createBuilding(state, kind, level, 0);
}
