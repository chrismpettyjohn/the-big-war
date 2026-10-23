import type { GameState } from '../../state/state.types';
import { frontsTouch, pairKey } from '../../front/front.service';

export function assignFrontClusters(state: GameState): void {
  let nextCluster = 0;
  const pending = state.fronts.map((_, index) => index);
  const assigned = new Set<number>();

  for (const startIndex of pending) {
    if (assigned.has(startIndex)) continue;
    const start = state.fronts[startIndex]!;
    const pair = pairKey(start);
    const cluster = nextCluster++;
    const queue = [startIndex];
    assigned.add(startIndex);
    while (queue.length > 0) {
      const index = queue.pop()!;
      const front = state.fronts[index]!;
      front.cluster = cluster;
      for (const otherIndex of pending) {
        if (assigned.has(otherIndex)) continue;
        const other = state.fronts[otherIndex]!;
        if (pairKey(other) !== pair) continue;
        if (!frontsTouch(front, other)) continue;
        assigned.add(otherIndex);
        queue.push(otherIndex);
      }
    }
  }
}

