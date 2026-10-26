import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import { NEUTRAL_FRONT_MODIFIERS } from './front.constants';
import { addToGarrison, ownTrench } from '../trench/trench.service';
import type { Front, FrontId, FrontSide, FrontSideKey } from './front.types';
import { gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
export function edgeId(a: Axial, b: Axial): FrontId {
  const aFirst = a.q !== b.q ? a.q < b.q : a.r <= b.r;
  return aFirst ? `${a.q},${a.r}|${b.q},${b.r}` : `${b.q},${b.r}|${a.q},${a.r}`;
}

export function parseEdgeId(id: FrontId): { a: Axial; b: Axial } | null {
  const parts = id.split('|');
  const a = parts[0]?.split(',');
  const b = parts[1]?.split(',');
  if (!a || !b || a.length !== 2 || b.length !== 2) return null;
  return { a: { q: Number(a[0]), r: Number(a[1]) }, b: { q: Number(b[0]), r: Number(b[1]) } };
}

export function findFront(state: GameState, id: FrontId): Front | undefined {
  return state.fronts.find(front => front.id === id);
}

export function findFrontByEdge(state: GameState, a: Axial, b: Axial): Front | undefined {
  const id = edgeId(a, b);
  return state.fronts.find(front => front.id === id);
}

export function incidentFronts(state: GameState, hex: Axial): Front[] {
  return state.fronts.filter(
    front =>
      (front.hexA.q === hex.q && front.hexA.r === hex.r) ||
      (front.hexB.q === hex.q && front.hexB.r === hex.r),
  );
}

export function ensureFront(state: GameState, a: Axial, b: Axial): Front {
  const existing = findFrontByEdge(state, a, b);
  if (existing) return existing;
  const cellA = gridAt(state.grid, a);
  const cellB = gridAt(state.grid, b);
  if (!cellA || !cellB) throw new Error(`ensureFront: hex off grid (${a.q},${a.r})|(${b.q},${b.r})`);
  const front: Front = {
    id: edgeId(a, b),
    hexA: { q: a.q, r: a.r },
    hexB: { q: b.q, r: b.r },
    sideA: { empire: cellA.owner, troops: 0, mode: 'attack', modifiers: NEUTRAL_FRONT_MODIFIERS },
    sideB: { empire: cellB.owner, troops: 0, mode: 'defence', modifiers: NEUTRAL_FRONT_MODIFIERS },
    cluster: -1,
    resolution: null,
    capture: null,
    lastAttackAt: state.elapsed,
  };
  state.fronts.push(front);
  return front;
}

export function removeFront(state: GameState, id: FrontId): boolean {
  const index = state.fronts.findIndex(front => front.id === id);
  if (index < 0) return false;
  state.fronts.splice(index, 1);
  return true;
}

export function sideOnHex(front: Front, hex: Axial): FrontSideKey | null {
  if (front.hexA.q === hex.q && front.hexA.r === hex.r) return 'A';
  if (front.hexB.q === hex.q && front.hexB.r === hex.r) return 'B';
  return null;
}

export function frontIdForEdge(state: GameState, a: Axial, b: Axial): FrontId | null {
  return findFrontByEdge(state, a, b)?.id ?? null;
}

export function sideOf(front: Front, empire: EmpireId): FrontSide | null {
  if (front.sideA.empire === empire) return front.sideA;
  if (front.sideB.empire === empire) return front.sideB;
  return null;
}

export function returnFrontTroops(state: GameState, side: FrontSide, home: Axial | null = null): void {
  const empire = state.empires[side.empire];
  if (!empire || !empire.alive) return;
  if (side.troops <= 0) return;
  const trench = home ? ownTrench(state, side.empire, home) : null;
  empire.soldiers += trench ? addToGarrison(state, trench, side.troops) : side.troops;
  side.troops = 0;
}

export function disbandFront(state: GameState, front: Front): void {
  returnFrontTroops(state, front.sideA, front.hexA);
  returnFrontTroops(state, front.sideB, front.hexB);
  removeFront(state, front.id);
}

export function pairKey(front: Front): string {
  const a = front.sideA.empire;
  const b = front.sideB.empire;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function frontsTouch(a: Front, b: Front): boolean {
  return hexEqual(a.hexA, b.hexA) || hexEqual(a.hexA, b.hexB) || hexEqual(a.hexB, b.hexA) || hexEqual(a.hexB, b.hexB);
}

function hexEqual(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}
