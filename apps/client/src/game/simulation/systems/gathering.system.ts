import type { GameState } from '../../state/state.types';
import type { EmpireId } from '../../empire/empire.types';
import type { HexCell, Terrain } from '../../map/map.types';
import type { Gatherer } from '../../building/building.types';
import { hasUnlimitedGold } from '../../empire/empire.service';
import { CHEAT_UNLIMITED_GOLD_AMOUNT } from '../../empire/empire.constants';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { resolveModifier } from '@the-big-war/game-engine/modifier/modifier.service';
import { area, distance, gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';

const GATHERED_TERRAIN: Partial<Record<string, Terrain>> = {
  lumberjack: 'forest',
  miner: 'mountain',
};

export function stepGathering(state: GameState, dt: number): void {
  const gather = state.config.gather;
  for (const cell of state.grid.cells) {
    const building = cell.building;
    if (!building || building.buildRemaining > 0) continue;
    const terrain = GATHERED_TERRAIN[building.kind];
    if (!terrain) continue;
    const empire = state.empires[cell.owner];
    if (!empire || !empire.alive) continue;
    const home = { q: cell.q, r: cell.r };
    const radius = building.kind === 'lumberjack' ? state.config.support.lumberjackRadius : state.config.support.minerRadius;
    while (building.gatherers.length < gather.workersPerBuilding) {
      building.gatherers.push({ pos: home, target: null, phase: 'idle', progress: 0, duration: 0 });
    }
    for (const gatherer of building.gatherers) {
      const delivered = stepGatherer(state, gatherer, home, cell.owner, terrain, radius, dt);
      if (delivered <= 0) continue;
      empire.gold += resolveModifier(delivered * gather.goldPerLoad, empire.bonuses.goldIncome);
      if (hasUnlimitedGold(empire)) empire.gold = CHEAT_UNLIMITED_GOLD_AMOUNT;
    }
  }
}

function stepGatherer(
  state: GameState,
  gatherer: Gatherer,
  home: Axial,
  owner: EmpireId,
  terrain: Terrain,
  radius: number,
  dt: number,
): number {
  const gather = state.config.gather;
  if (gatherer.phase === 'idle') {
    const target = nearestResource(state, home, owner, terrain, radius);
    if (!target) {
      gatherer.pos = home;
      return 0;
    }
    gatherer.target = target;
    startLeg(gatherer, 'outbound', distance(home, target) * gather.walkSecondsPerHex);
  }

  gatherer.progress += dt;
  const target = gatherer.target!;
  const t = gatherer.duration > 0 ? Math.min(1, gatherer.progress / gatherer.duration) : 1;
  if (gatherer.phase === 'outbound') gatherer.pos = lerp(home, target, t);
  else if (gatherer.phase === 'returning') gatherer.pos = lerp(target, home, t);
  if (gatherer.progress < gatherer.duration) return 0;

  switch (gatherer.phase) {
    case 'outbound': {
      const cell = gridAt(state.grid, target);
      if (!cell || cell.terrain !== terrain || cell.owner !== owner) {
        gatherer.phase = 'idle';
        return 0;
      }
      startLeg(gatherer, 'working', gather.workSeconds);
      return 0;
    }
    case 'working': {
      const cell = gridAt(state.grid, target);
      if (!cell || cell.terrain !== terrain) {
        gatherer.phase = 'idle';
        return 0;
      }
      harvest(state, cell);
      startLeg(gatherer, 'returning', distance(home, target) * gather.walkSecondsPerHex);
      return 0;
    }
    case 'returning':
      gatherer.pos = home;
      gatherer.target = null;
      gatherer.phase = 'idle';
      return 1;
    default:
      return 0;
  }
}

function startLeg(gatherer: Gatherer, phase: Gatherer['phase'], duration: number): void {
  gatherer.phase = phase;
  gatherer.progress = 0;
  gatherer.duration = duration;
}

function harvest(state: GameState, cell: HexCell): void {
  cell.harvested = (cell.harvested ?? 0) + 1;
  if (cell.harvested < state.config.gather.loadsPerTile) return;
  cell.terrain = 'plain';
  cell.harvested = 0;
}

function nearestResource(state: GameState, home: Axial, owner: EmpireId, terrain: Terrain, radius: number): Axial | null {
  let best: Axial | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of area(home, radius)) {
    const cell = gridAt(state.grid, candidate);
    if (!cell || cell.terrain !== terrain || cell.owner !== owner || cell.building) continue;
    const d = distance(home, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

function lerp(a: Axial, b: Axial, t: number): Axial {
  return { q: a.q + (b.q - a.q) * t, r: a.r + (b.r - a.r) * t };
}
