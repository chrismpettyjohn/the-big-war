/**
 * Front bookkeeping — pure plumbing, no combat rules.
 *
 * A Front is a contested edge between two adjacent hostile hexes. Fronts are
 * created lazily by the `SendTroops` command (commands.ts), refreshed every
 * combat tick by the engine, and removed by engine housekeeping. This module
 * owns id construction and lookup so engine.ts, commands.ts and the UI all
 * agree on front identity. Combat rules (damage, capture, idle timers) live in
 * engine stage5/6, not here.
 */

import { gridAt } from './hex';
import type { Axial } from './hex';
import type { Front, FrontId, FrontModifiers, GameState } from './types';

/** Neutral modifiers (multipliers of1, no tooltip lines). */
export const NEUTRAL_FRONT_MODIFIERS: FrontModifiers = {
  attack: 1,
  defence: 1,
  lines: [],
};

/** Canonical, order-independent id for the edge between two adjacent hexes. */
export function edgeId(a: Axial, b: Axial): FrontId {
  const aFirst = a.q !== b.q ? a.q < b.q : a.r <= b.r;
  return aFirst ? `${a.q},${a.r}|${b.q},${b.r}` : `${b.q},${b.r}|${a.q},${a.r}`;
}

/** Inverse of edgeId (for UI/debug). */
export function parseEdgeId(id: FrontId): { a: Axial; b: Axial } | null {
  const parts = id.split('|');
  const a = parts[0]?.split(',');
  const b = parts[1]?.split(',');
  if (!a || !b || a.length !== 2 || b.length !== 2) return null;
  return { a: { q: Number(a[0]), r: Number(a[1]) }, b: { q: Number(b[0]), r: Number(b[1]) } };
}

/** Front with the given id, if any. */
export function findFront(state: GameState, id: FrontId): Front | undefined {
  return state.fronts.find(front => front.id === id);
}

/** Front on the edge (a, b), if any. */
export function findFrontByEdge(state: GameState, a: Axial, b: Axial): Front | undefined {
  const id = edgeId(a, b);
  return state.fronts.find(front => front.id === id);
}

/** Every front touching the given hex (either side). */
export function incidentFronts(state: GameState, hex: Axial): Front[] {
  return state.fronts.filter(
    front =>
      (front.hexA.q === hex.q && front.hexA.r === hex.r) ||
      (front.hexB.q === hex.q && front.hexB.r === hex.r),
  );
}

/**
 * Find the front on edge (a, b), creating it when missing. The side standing on
 * each hex becomes that side's empire; sideA (hex a) starts in 'attack' mode,
 * sideB in 'defence'. Throws when either hex is off-grid (caller bug).
 */
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
    lastAttackAt: state.elapsed,
  };
  state.fronts.push(front);
  return front;
}

/** Remove a front by id. Returns true when one was removed. */
export function removeFront(state: GameState, id: FrontId): boolean {
  const index = state.fronts.findIndex(front => front.id === id);
  if (index < 0) return false;
  state.fronts.splice(index, 1);
  return true;
}

/** The side standing on `hex`, or null (hex not part of this front). */
export function sideOnHex(front: Front, hex: Axial): 'A' | 'B' | null {
  if (front.hexA.q === hex.q && front.hexA.r === hex.r) return 'A';
  if (front.hexB.q === hex.q && front.hexB.r === hex.r) return 'B';
  return null;
}
