import type { Terrain } from '../map/map.types';
import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import { hasUnlock } from '../research/research.service';
import type { CommandError } from '../commands/commands.types';
import { ENGINE_TUNING } from '../simulation/simulation.constants';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { resolveModifier } from '@the-big-war/game-engine/modifier/modifier.service';
import type { Building, BuildingId, BuildingKind, OwnedBuilding } from './building.types';
import { area, gridAt, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';
import { FLAT_COST_BUILDINGS, FREE_STANDING_BUILDINGS, PRODUCTION_BUILDINGS } from './building.constants';

export function createBuilding(state: GameState, kind: BuildingKind, level: number, buildRemaining: number): Building {
  return {
    id: state.nextBuildingId++,
    kind,
    level,
    cooldown: 0,
    growth: 0,
    demolishAt: null,
    buildRemaining,
    gatherers: [],
  };
}

export function isProductionBuilding(kind: BuildingKind): boolean {
  return PRODUCTION_BUILDINGS.has(kind);
}

export function buildingCost(state: GameState, empireId: EmpireId, kind: BuildingKind): number {
  const empire = state.empires[empireId];
  const placed = FLAT_COST_BUILDINGS.has(kind) ? 0 : countPlacedOfKind(state, empireId, kind);
  const base = state.config.buildings[kind].cost * state.config.economy.buildingCostGrowth ** placed;
  return empire ? resolveModifier(base, empire.bonuses.buildCost) : base;
}

export function buildingIdAt(state: GameState, hex: Axial): BuildingId | null {
  return gridAt(state.grid, hex)?.building?.id ?? null;
}

export function ownedBuildings(state: GameState, empireId: EmpireId): OwnedBuilding[] {
  const out: OwnedBuilding[] = [];
  for (const cell of state.grid.cells) {
    if (cell.owner !== empireId || !cell.building || cell.building.buildRemaining > 0) continue;
    out.push({ hex: { q: cell.q, r: cell.r }, cell, building: cell.building });
  }
  return out;
}

export function countBuildingsOfKind(state: GameState, empireId: EmpireId, kind: BuildingKind): number {
  let count = 0;
  for (const cell of state.grid.cells) {
    if (cell.owner === empireId && cell.building?.kind === kind && cell.building.buildRemaining <= 0) count += 1;
  }
  return count;
}

function countPlacedOfKind(state: GameState, empireId: EmpireId, kind: BuildingKind): number {
  let count = 0;
  for (const cell of state.grid.cells) {
    if (cell.owner === empireId && cell.building?.kind === kind) count += 1;
  }
  return count;
}

export function countSupport(
  state: GameState,
  empireId: EmpireId,
  hex: Axial,
  radius: number,
  predicate: (kind: BuildingKind) => boolean,
  minLevel = 1,
  square = false,
): number {
  let count = 0;
  for (const candidate of square ? squareArea(hex, radius) : area(hex, radius)) {
    const cell = gridAt(state.grid, candidate);
    if (!cell || cell.owner !== empireId || !cell.building || cell.building.buildRemaining > 0) continue;
    if (predicate(cell.building.kind) && cell.building.level >= minLevel) count += 1;
  }
  return count;
}

function squareArea(center: Axial, radius: number): Axial[] {
  const results: Axial[] = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dq = -radius; dq <= radius; dq++) results.push({ q: center.q + dq, r: center.r + dr });
  }
  return results;
}

export function hasAdjacentTerrain(state: GameState, hex: Axial, terrain: Terrain): boolean {
  if (gridAt(state.grid, hex)?.terrain === terrain) return true;
  return hasNeighbourTerrain(state, hex, terrain);
}

export function hasNeighbourTerrain(state: GameState, hex: Axial, terrain: Terrain): boolean {
  for (const neighbour of neighbors(hex)) {
    if (gridAt(state.grid, neighbour)?.terrain === terrain) return true;
  }
  return false;
}

export function isFreeStanding(kind: BuildingKind): boolean {
  return FREE_STANDING_BUILDINGS.has(kind);
}

export function hasNeighbourBuilding(state: GameState, hex: Axial): boolean {
  for (const neighbour of neighbors(hex)) {
    const building = gridAt(state.grid, neighbour)?.building;
    if (building && !isFreeStanding(building.kind)) return true;
  }
  return false;
}

const CLEARS_TERRAIN: Partial<Record<BuildingKind, Terrain>> = {
  lumberjack: 'forest',
  miner: 'mountain',
};

export function placementError(
  state: GameState,
  empireId: EmpireId,
  hex: Axial,
  kind: BuildingKind,
): CommandError | null {
  const empire = state.empires[empireId];
  if (!empire || !empire.alive) return 'no_empire';
  const cell = gridAt(state.grid, hex);
  if (!cell) return 'invalid_target';
  const spec = state.config.buildings[kind];
  if (empire.gold < buildingCost(state, empireId, kind)) return 'insufficient_gold';
  if (empire.civilians < ENGINE_TUNING.civiliansPerBuild) return 'insufficient_civilians';

  if (cell.owner !== empireId || cell.building !== null) return 'invalid_target';

  if (cell.terrain !== 'plain' && CLEARS_TERRAIN[kind] !== cell.terrain) return 'invalid_target';

  if (spec.requiresResearch !== null && !hasUnlock(empire, `building:${kind}`)) return 'not_researched';

  if (spec.requiresAdjacentTerrain !== null && !hasAdjacentTerrain(state, hex, spec.requiresAdjacentTerrain)) {
    return 'invalid_target';
  }

  if (!isFreeStanding(kind) && hasNeighbourBuilding(state, hex)) return 'invalid_target';
  return null;
}
