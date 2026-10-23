import { disbandFront } from '../../front/front.service';
import type { GameState } from '../../state/state.types';
import { NEUTRAL_OWNER } from '../../empire/empire.constants';
import { refreshHexCounts } from '../../empire/empire.service';
import { removeDemolishedBuildings } from './buildings.system';
import { assignFrontClusters } from '../combat/front-clusters.service';
import { gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';
import { dissolveDiplomacy, endFrontsBetween } from '../../diplomacy/diplomacy.service';

export function stepHousekeeping(state: GameState): void {
  assignFrontClusters(state);
  endIdleAndBrokenFronts(state);
  removeDemolishedBuildings(state);
  refreshHexCounts(state);
  eliminateDeadEmpires(state);
}

function endIdleAndBrokenFronts(state: GameState): void {
  const idleSeconds = state.config.front.idleEndSeconds;
  for (let index = state.fronts.length - 1; index >= 0; index--) {
    const front = state.fronts[index]!;
    const cellA = gridAt(state.grid, front.hexA);
    const cellB = gridAt(state.grid, front.hexB);
    const hostile =
      cellA !== undefined &&
      cellB !== undefined &&
      cellA.owner !== cellB.owner &&
      cellA.owner !== NEUTRAL_OWNER &&
      cellB.owner !== NEUTRAL_OWNER &&
      cellA.owner === front.sideA.empire &&
      cellB.owner === front.sideB.empire;
    const idle = state.elapsed - front.lastAttackAt > idleSeconds;
    const empty = front.sideA.troops <= state.config.front.idleTroops && front.sideB.troops <= state.config.front.idleTroops;
    const oneSideEmpty = (front.sideA.troops <= 0 || front.sideB.troops <= 0) && front.capture === null;

    if (!hostile || idle || empty || oneSideEmpty) disbandFront(state, front);
  }
}

function eliminateDeadEmpires(state: GameState): void {
  for (const empire of state.empires) {
    if (!empire.alive) continue;
    if (empire.hexCount > 0) continue;
    empire.alive = false;
    empire.eliminatedAt = state.elapsed;
    empire.civilians = 0;
    empire.civilianBalance = 0;
    empire.troopBalance = 0;
    for (const other of state.empires) {
      if (other.id !== empire.id) endFrontsBetween(state, empire.id, other.id);
    }
    dissolveDiplomacy(state, empire.id);
  }
}
