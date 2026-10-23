import type { GameState } from '../../state/state.types';

export function stepBuildings(state: GameState, dt: number): void {
  for (const cell of state.grid.cells) {
    const building = cell.building;
    if (!building) continue;
    if (building.buildRemaining > 0) {
      building.buildRemaining = Math.max(0, building.buildRemaining - dt);
      continue;
    }
    if (building.kind === 'cannon' && building.cooldown > 0) {
      building.cooldown = Math.max(0, building.cooldown - dt);
    }
  }
}

export function removeDemolishedBuildings(state: GameState): void {
  for (const cell of state.grid.cells) {
    const building = cell.building;
    if (!building || building.demolishAt === null) continue;
    if (building.demolishAt <= state.elapsed) cell.building = null;
  }
}
