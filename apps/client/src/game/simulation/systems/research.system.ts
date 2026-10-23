import { ENGINE_TUNING } from '../simulation.constants';
import type { GameState } from '../../state/state.types';
import { completeResearch, researchDuration } from '../../research/research.service';

export function stepResearch(state: GameState, dt: number): void {
  for (const empire of state.empires) {
    const active = empire.research.active;
    if (!active || !empire.alive) continue;
    const duration = researchDuration(active.nodeId);
    if (duration <= 0) {
      active.progress = 1;
    } else {
      active.progress += dt / duration;
    }
    if (active.progress >= 1 - ENGINE_TUNING.progressEpsilon) {
      active.progress = 1;
      completeResearch(state, empire.id);
    }
  }
}
