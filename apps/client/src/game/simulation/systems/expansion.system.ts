import { ENGINE_TUNING } from '../simulation.constants';
import type { FrontierScan } from '../simulation.types';
import type { EmpireId } from '../../empire/empire.types';
import { terrainDefenceAt } from '../../map/terrain.service';
import { NEUTRAL_OWNER } from '../../empire/empire.constants';
import { returnToReserve } from '../../troops/troops.service';
import type { Expedition, GameState, Squad } from '../../state/state.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { DIRECTIONS } from '@the-big-war/game-engine/world-tile/world-tile.constants';
import { distance, gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';

interface Candidate {
  readonly from: Axial;
  readonly hex: Axial;
}

export function stepExpansion(state: GameState, dt: number): void {
  if (state.expeditions.length === 0) return;
  const scans = scanFrontiers(state);
  for (let index = state.expeditions.length - 1; index >= 0; index--) {
    const expedition = state.expeditions[index]!;
    const empire = state.empires[expedition.empire];
    if (!empire || !empire.alive) {
      state.expeditions.splice(index, 1);
      continue;
    }
    const scan = scans.get(expedition.empire);
    const region = new Set(expedition.region);
    const width = state.grid.width;
    const candidates = (scan?.candidates ?? []).filter(
      c => region.has(c.hex.r * width + c.hex.q) && gridAt(state.grid, c.hex)?.owner === NEUTRAL_OWNER,
    );

    const throughput = Math.min(
      ENGINE_TUNING.maxClaimsPerTick,
      1 +
        Math.floor(((scan?.barracks ?? 0) + (scan?.forts ?? 0)) / ENGINE_TUNING.claimPerStructures) +
        Math.floor(empire.hexCount / ENGINE_TUNING.claimHexesPerSize),
    );
    const squadSize = ENGINE_TUNING.claimSoldiersPerHex;
    while (expedition.squads.length < throughput && expedition.troops >= squadSize && candidates.length > 0) {
      expedition.troops -= squadSize;
      expedition.squads.push(spawnSquad(expedition.origin, squadSize));
    }

    const reserved = new Set(
      expedition.squads.filter(squad => squad.goal).map(squad => `${squad.goal!.q},${squad.goal!.r}`),
    );
    let busy = 0;
    for (const squad of expedition.squads) {
      if (advanceSquad(state, expedition, squad, candidates, reserved, dt)) busy += 1;
    }

    if (busy === 0) {
      let troops = expedition.troops;
      for (const squad of expedition.squads) troops += squad.troops;
      returnToReserve(state, expedition.empire, troops);
      state.expeditions.splice(index, 1);
    }
  }
}

function spawnSquad(origin: Axial, troops: number): Squad {
  return {
    pos: { q: origin.q, r: origin.r },
    tile: { q: origin.q, r: origin.r },
    heading: { q: 0, r: 0 },
    goal: null,
    from: null,
    claiming: false,
    progress: 0,
    duration: 0,
    troops,
  };
}

function advanceSquad(
  state: GameState,
  expedition: Expedition,
  squad: Squad,
  candidates: readonly Candidate[],
  reserved: Set<string>,
  dt: number,
): boolean {
  if (squad.goal && gridAt(state.grid, squad.goal)?.owner !== NEUTRAL_OWNER) {
    reserved.delete(`${squad.goal.q},${squad.goal.r}`);
    squad.goal = null;
    squad.claiming = false;
  }
  if (!squad.goal) {
    const next = pickCandidate(expedition, squad, candidates, reserved);
    if (!next) return false;
    squad.goal = next.hex;
    squad.from = next.from;
    squad.claiming = false;
    reserved.add(`${next.hex.q},${next.hex.r}`);
  }
  const goal = squad.goal;
  const from = squad.from!;

  if (!squad.claiming) {
    const dq = from.q - squad.pos.q;
    const dr = from.r - squad.pos.r;
    const gap = Math.hypot(dq, dr);
    const stride = dt / ENGINE_TUNING.walkSecondsPerHex;
    if (gap > stride) {
      squad.pos.q += (dq / gap) * stride;
      squad.pos.r += (dr / gap) * stride;
      return true;
    }
    squad.pos = { q: from.q, r: from.r };
    squad.claiming = true;
    squad.progress = 0;
    squad.duration = ENGINE_TUNING.claimSecondsPerHex * terrainDefenceAt(state, goal);
  }

  squad.progress += dt;
  const t = Math.min(1, squad.progress / squad.duration);
  squad.pos = { q: from.q + (goal.q - from.q) * t, r: from.r + (goal.r - from.r) * t };
  if (t < 1) return true;

  const cell = gridAt(state.grid, goal);
  if (cell && cell.owner === NEUTRAL_OWNER) cell.owner = expedition.empire;
  reserved.delete(`${goal.q},${goal.r}`);
  squad.heading = { q: goal.q - from.q, r: goal.r - from.r };
  squad.tile = { q: goal.q, r: goal.r };
  squad.goal = null;
  squad.from = null;
  squad.claiming = false;
  return true;
}

function pickCandidate(
  expedition: Expedition,
  squad: Squad,
  candidates: readonly Candidate[],
  reserved: ReadonlySet<string>,
): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const straight = { q: squad.tile.q + squad.heading.q, r: squad.tile.r + squad.heading.r };
  for (const candidate of candidates) {
    if (reserved.has(`${candidate.hex.q},${candidate.hex.r}`)) continue;
    const fromHere = candidate.from.q === squad.tile.q && candidate.from.r === squad.tile.r;
    const ahead = fromHere && candidate.hex.q === straight.q && candidate.hex.r === straight.r;
    const score =
      Math.hypot(candidate.from.q - squad.pos.q, candidate.from.r - squad.pos.r) +
      distance(candidate.hex, expedition.target) * ENGINE_TUNING.squadTargetPull -
      (ahead ? ENGINE_TUNING.squadStraightBonus : 0) -
      (fromHere ? ENGINE_TUNING.squadStayBonus : 0);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function scanFrontiers(state: GameState): Map<EmpireId, FrontierScan> {
  const width = state.grid.width;
  const height = state.grid.height;
  const scans = new Map<EmpireId, FrontierScan>();
  const active = new Set(state.expeditions.map(expedition => expedition.empire));

  for (const cell of state.grid.cells) {
    if (!active.has(cell.owner)) continue;
    let scan = scans.get(cell.owner);
    if (!scan) {
      scan = { candidates: [], barracks: 0, forts: 0 };
      scans.set(cell.owner, scan);
    }
    if (cell.building && cell.building.buildRemaining <= 0) {
      if (cell.building.kind === 'barracks') scan.barracks += 1;
      else if (cell.building.kind === 'fort') scan.forts += 1;
    }
    for (const dir of DIRECTIONS) {
      const q = cell.q + dir.q;
      const r = cell.r + dir.r;
      if (q < 0 || r < 0 || q >= width || r >= height) continue;
      if (state.grid.cells[r * width + q]!.owner !== NEUTRAL_OWNER) continue;
      scan.candidates.push({ from: { q: cell.q, r: cell.r }, hex: { q, r } });
    }
  }
  return scans;
}
