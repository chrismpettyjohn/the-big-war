import { BOT_TUNING } from './bot.constants';
import type { HexCell } from '../map/map.types';
import { ownTrench } from '../trench/trench.service';
import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import { hasUnlock } from '../research/research.service';
import { NEUTRAL_OWNER } from '../empire/empire.constants';
import type { BuildingKind } from '../building/building.types';
import type { Bot, CannonShot, HostileEdge } from './bot.types';
import { canAttack, getRelation } from '../diplomacy/diplomacy.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { hasNeighbourBuilding, hasNeighbourTerrain } from '../building/building.service';
import { distance, gridAt, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';

export function ownedCells(state: GameState, empireId: EmpireId): HexCell[] {
  return state.grid.cells.filter(cell => cell.owner === empireId);
}

export function isFreeSite(state: GameState, cell: HexCell): boolean {
  if (cell.building !== null) return false;
  return !hasNeighbourBuilding(state, { q: cell.q, r: cell.r });
}

export function findSite(state: GameState, empireId: EmpireId, kind: BuildingKind): Axial | null {
  const spec = state.config.buildings[kind];
  if (!spec) return null;
  if (spec.requiresResearch !== null) {
    const empire = state.empires[empireId];
    if (!empire || !hasUnlock(empire, `building:${kind}`)) return null;
  }
  if (kind === 'machine_gun') return unarmedTrench(state, empireId);
  if (kind === 'trench') return borderTrenchSite(state, empireId);
  let fallback: Axial | null = null;
  let scanned = 0;
  for (const cell of ownedCells(state, empireId)) {
    if (scanned >= BOT_TUNING.siteScanLimit) break;
    const hex = { q: cell.q, r: cell.r };
    if (!isFreeSite(state, cell)) continue;
    if (spec.requiresAdjacentTerrain !== null) {
      if (hasNeighbourTerrain(state, hex, spec.requiresAdjacentTerrain)) return hex;
      continue;
    }
    if (cell.terrain === 'plain') return hex;
    if (fallback === null) fallback = hex;
    scanned += 1;
  }
  return fallback;
}

export function bordersForeignEmpire(state: GameState, empireId: EmpireId, hex: Axial): boolean {
  for (const neighbour of neighbors(hex)) {
    const owner = gridAt(state.grid, neighbour)?.owner;
    if (owner !== undefined && owner !== NEUTRAL_OWNER && owner !== empireId) return true;
  }
  return false;
}

function unarmedTrench(state: GameState, empireId: EmpireId): Axial | null {
  for (const cell of ownedCells(state, empireId)) {
    const hex = { q: cell.q, r: cell.r };
    if (ownTrench(state, empireId, hex)?.machineGun === false) return hex;
  }
  return null;
}

function borderTrenchSite(state: GameState, empireId: EmpireId): Axial | null {
  for (const cell of ownedCells(state, empireId)) {
    if (cell.building !== null || cell.terrain !== 'plain') continue;
    const hex = { q: cell.q, r: cell.r };
    if (bordersForeignEmpire(state, empireId, hex)) return hex;
  }
  return null;
}

export function unmannedBorderTrench(state: GameState, empireId: EmpireId): Axial | null {
  for (const cell of ownedCells(state, empireId)) {
    const hex = { q: cell.q, r: cell.r };
    const trench = ownTrench(state, empireId, hex);
    if (trench && trench.garrison === 0 && bordersForeignEmpire(state, empireId, hex)) return hex;
  }
  return null;
}

export function findCannonShot(state: GameState, empireId: EmpireId): CannonShot | null {
  const range = state.config.cannon.range;
  for (const cell of state.grid.cells) {
    if (cell.owner !== empireId || cell.building?.kind !== 'cannon') continue;
    if (cell.building.cooldown > 0 || cell.building.buildRemaining > 0) continue;
    const from = { q: cell.q, r: cell.r };
    for (const neighbour of neighbors(from)) {
      for (let step = 1; step <= range; step++) {
        const probe = { q: from.q + (neighbour.q - from.q) * step, r: from.r + (neighbour.r - from.r) * step };
        const target = gridAt(state.grid, probe);
        if (!target) continue;
        if (distance(from, probe) > range) continue;
        if (target.owner !== empireId && target.owner !== NEUTRAL_OWNER) return { from, target: { q: probe.q, r: probe.r } };
      }
    }
  }
  return null;
}

export function effectiveAggression(bot: Bot, state: GameState): number {
  const shifted = bot.personality.aggression + state.config.bot.aggression - 0.5;
  return Math.min(1, Math.max(0, shifted));
}

export function borderingEmpires(state: GameState, empireId: EmpireId): Set<EmpireId> {
  const found = new Set<EmpireId>();
  for (const cell of state.grid.cells) {
    if (cell.owner !== empireId) continue;
    for (const neighbour of neighbors({ q: cell.q, r: cell.r })) {
      const owner = gridAt(state.grid, neighbour)?.owner;
      if (owner !== undefined && owner >= 0 && owner !== empireId) found.add(owner);
    }
  }
  return found;
}

export function troopsOnFrontsAgainst(state: GameState, empireA: EmpireId, empireB: EmpireId): number {
  let total = 0;
  for (const front of state.fronts) {
    if (front.sideA.empire === empireA && front.sideB.empire === empireB) total += front.sideA.troops;
    if (front.sideB.empire === empireA && front.sideA.empire === empireB) total += front.sideB.troops;
  }
  return total;
}

export function hostileEdges(state: GameState, empireId: EmpireId): HostileEdge[] {
  const edges: HostileEdge[] = [];
  const neutralState = state.empires[empireId]?.neutralState ?? false;
  for (const cell of state.grid.cells) {
    if (cell.owner !== empireId) continue;
    for (const neighbour of neighbors({ q: cell.q, r: cell.r })) {
      const other = gridAt(state.grid, neighbour);
      if (!other || other.owner === empireId) continue;
      if (neutralState && other.owner < 0) continue;
      if (other.owner >= 0 && getRelation(state, empireId, other.owner).status !== 'war') continue;
      if (!canAttack(state, empireId, other.owner).allowed) continue;
      edges.push({ from: { q: cell.q, r: cell.r }, target: { q: other.q, r: other.r }, defender: other.owner });
    }
  }
  return edges;
}
