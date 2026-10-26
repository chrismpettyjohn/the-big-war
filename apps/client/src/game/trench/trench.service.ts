import type { HexCell } from '../map/map.types';
import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import type { Building } from '../building/building.types';
import { gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';

export function ownTrench(state: GameState, empire: EmpireId, hex: Axial): Building | null {
  const cell = gridAt(state.grid, hex);
  const building = cell?.building;
  if (!cell || cell.owner !== empire || !building || building.kind !== 'trench') return null;
  if (building.buildRemaining > 0 || building.demolishAt !== null) return null;
  return building;
}

export function garrisonRoom(state: GameState, building: Building): number {
  return Math.max(0, state.config.trench.capacity - building.garrison);
}

export function addToGarrison(state: GameState, building: Building, troops: number): number {
  const moved = Math.min(troops, garrisonRoom(state, building));
  building.garrison += moved;
  return troops - moved;
}

export function defendersOn(state: GameState, cell: HexCell): number {
  let total = 0;
  for (const front of state.fronts) {
    if (front.hexA.q === cell.q && front.hexA.r === cell.r && front.sideA.empire === cell.owner) total += front.sideA.troops;
    if (front.hexB.q === cell.q && front.hexB.r === cell.r && front.sideB.empire === cell.owner) total += front.sideB.troops;
  }
  return total;
}

export function isMannedMachineGun(state: GameState, cell: HexCell): boolean {
  const building = cell.building;
  if (!building || building.kind !== 'trench' || !building.machineGun || building.buildRemaining > 0) return false;
  return building.garrison > 0 || defendersOn(state, cell) > 0;
}

export function garrisonedTroops(state: GameState, empire: EmpireId): number {
  let total = 0;
  for (const cell of state.grid.cells) {
    if (cell.owner === empire && cell.building?.kind === 'trench') total += cell.building.garrison;
  }
  return total;
}
