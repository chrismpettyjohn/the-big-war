import type { Front } from '../../front/front.types';
import type { GameState } from '../../state/state.types';
import type { EmpireId } from '../../empire/empire.types';
import { shellingFactor } from '../../building/building.service';
import { distance } from '@the-big-war/game-engine/world-tile/world-tile.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';

export function stepArtillery(state: GameState): void {
  const battery = state.config.battery;
  for (const cell of state.grid.cells) {
    const building = cell.building;
    if (building?.kind !== 'battery' || building.buildRemaining > 0 || building.cooldown > 0) continue;
    if (building.demolishAt !== null) continue;
    const target = pickTarget(state, cell.owner, { q: cell.q, r: cell.r }, battery.range);
    if (!target) continue;
    const enemy = target.sideA.empire === cell.owner ? target.sideB : target.sideA;
    const enemyHex = target.sideA.empire === cell.owner ? target.hexB : target.hexA;
    enemy.troops = Math.max(0, enemy.troops - battery.damage * shellingFactor(state, enemy.empire, enemyHex));
    building.cooldown = battery.cooldown;
  }
}

function pickTarget(state: GameState, owner: EmpireId, from: Axial, range: number): Front | null {
  let best: Front | null = null;
  let bestTroops = 0;
  for (const front of state.fronts) {
    let enemyHex: Axial;
    let enemyTroops: number;
    if (front.sideA.empire === owner) {
      enemyHex = front.hexB;
      enemyTroops = front.sideB.troops;
    } else if (front.sideB.empire === owner) {
      enemyHex = front.hexA;
      enemyTroops = front.sideA.troops;
    } else continue;
    if (enemyTroops <= bestTroops || distance(from, enemyHex) > range) continue;
    best = front;
    bestTroops = enemyTroops;
  }
  return best;
}
