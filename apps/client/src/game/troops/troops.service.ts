import { ensureFront } from '../front/front.service';
import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import { NEUTRAL_OWNER } from '../empire/empire.constants';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { distance, gridAt, gridInBounds, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';

export function launchExpedition(
  state: GameState,
  empire: EmpireId,
  target: Axial,
  troops: number,
  origin: Axial | null = null,
): void {
  const targetIndex = target.r * state.grid.width + target.q;
  const existing = state.expeditions.find(
    expedition => expedition.empire === empire && expedition.region.includes(targetIndex),
  );
  if (existing) {
    existing.troops += troops;
    existing.target = { q: target.q, r: target.r };
    return;
  }
  const region = wildRegion(state, target, empire);
  if (region.length === 0) {
    returnToReserve(state, empire, troops);
    return;
  }
  const start = origin ?? nearestOwnedHex(state, empire, target) ?? target;
  state.expeditions.push({
    empire,
    target: { q: target.q, r: target.r },
    troops,
    region,
    origin: { q: start.q, r: start.r },
    squads: [],
  });
}

export function wildRegion(state: GameState, start: Axial, empire: EmpireId): number[] {
  const { grid } = state;
  const startIndex = start.r * grid.width + start.q;
  const seen = new Set<number>([startIndex]);
  const queue: Axial[] = [start];
  const region: number[] = [];
  while (queue.length > 0) {
    const hex = queue.pop()!;
    const index = hex.r * grid.width + hex.q;
    const cell = gridAt(grid, hex);
    if (!cell) continue;
    const wild = cell.owner === NEUTRAL_OWNER;
    if (!wild && cell.owner !== empire && index !== startIndex) continue;
    if (wild) region.push(index);
    for (const next of neighbors(hex)) {
      if (!gridInBounds(grid, next.q, next.r)) continue;
      const nextIndex = next.r * grid.width + next.q;
      if (seen.has(nextIndex)) continue;
      seen.add(nextIndex);
      queue.push(next);
    }
  }
  return region;
}

export function joinFront(
  state: GameState,
  empire: EmpireId,
  hex: Axial,
  target: Axial,
  troops: number,
  intent: 'attack' | 'defence',
): boolean {
  const front = ensureFront(state, hex, target);
  const isSideA = front.hexA.q === hex.q && front.hexA.r === hex.r;
  const side = isSideA ? front.sideA : front.sideB;
  if (side.empire !== empire) return false;
  side.troops += troops;
  side.mode = intent;
  front.lastAttackAt = state.elapsed;
  return true;
}

export function returnToReserve(state: GameState, empire: EmpireId, troops: number): void {
  const owner = state.empires[empire];
  if (!owner || !owner.alive || troops <= 0) return;
  owner.soldiers += troops;
}

export function deployedTroops(state: GameState, empire: EmpireId): number {
  let total = 0;
  for (const expedition of state.expeditions) {
    if (expedition.empire !== empire) continue;
    total += expedition.troops;
    for (const squad of expedition.squads) total += squad.troops;
  }
  for (const column of state.columns) if (column.empire === empire) total += column.troops;
  for (const front of state.fronts) {
    if (front.sideA.empire === empire) total += front.sideA.troops;
    if (front.sideB.empire === empire) total += front.sideB.troops;
  }
  return total;
}

export function nearestOwnedHex(state: GameState, empire: EmpireId, target: Axial): Axial | null {
  let best: Axial | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const cell of state.grid.cells) {
    if (cell.owner !== empire) continue;
    const d = distance(cell, target);
    if (d < bestDistance) {
      bestDistance = d;
      best = { q: cell.q, r: cell.r };
    }
  }
  return best;
}

export function tileLine(from: Axial, to: Axial): Axial[] {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  const stepQ = Math.sign(dq);
  const stepR = Math.sign(dr);
  const nq = Math.abs(dq);
  const nr = Math.abs(dr);
  const line: Axial[] = [{ q: from.q, r: from.r }];
  let q = from.q;
  let r = from.r;
  let iq = 0;
  let ir = 0;
  while (iq < nq || ir < nr) {
    if ((0.5 + iq) / nq < (0.5 + ir) / nr) {
      q += stepQ;
      iq += 1;
    } else {
      r += stepR;
      ir += 1;
    }
    line.push({ q, r });
  }
  return line;
}

export function marchPath(state: GameState, empire: EmpireId, target: Axial): Axial[] | null {
  const origin = nearestOwnedHex(state, empire, target);
  if (!origin) return null;
  const line = tileLine(origin, target);
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    if (gridAt(state.grid, line[i]!)?.owner === empire) start = i;
  }
  const path = line.slice(start);
  return path.length >= 2 ? path : null;
}

