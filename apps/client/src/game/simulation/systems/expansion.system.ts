import { ENGINE_TUNING } from '../simulation.constants';
import type { FrontierScan } from '../simulation.types';
import type { GameState } from '../../state/state.types';
import type { EmpireId } from '../../empire/empire.types';
import { terrainDefenceAt } from '../../map/terrain.service';
import { NEUTRAL_OWNER } from '../../empire/empire.constants';
import { DIRECTIONS } from '@the-big-war/game-engine/world-tile/world-tile.constants';
import { distance, gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';

export function stepExpansion(state: GameState): void {
  if (state.expeditions.length === 0) return;
  const scans = scanFrontiers(state);
  for (let index = state.expeditions.length - 1; index >= 0; index--) {
    const expedition = state.expeditions[index]!;
    const empire = state.empires[expedition.empire];
    const scan = scans.get(expedition.empire);
    if (!empire || !empire.alive) {
      state.expeditions.splice(index, 1);
      continue;
    }

    const throughput = Math.min(
      ENGINE_TUNING.maxClaimsPerTick,
      1 +
        Math.floor(((scan?.barracks ?? 0) + (scan?.forts ?? 0)) / ENGINE_TUNING.claimPerStructures) +
        Math.floor(empire.hexCount / ENGINE_TUNING.claimHexesPerSize),
    );
    const candidates = (scan?.candidates ?? [])
      .filter(hex => gridAt(state.grid, hex)?.owner === NEUTRAL_OWNER)
      .sort((a, b) => distance(a, expedition.target) - distance(b, expedition.target));

    let claimed = 0;
    for (const hex of candidates) {
      if (claimed >= throughput) break;
      const cell = gridAt(state.grid, hex);
      if (!cell || cell.owner !== NEUTRAL_OWNER) continue;
      const cost = ENGINE_TUNING.claimSoldiersPerHex * terrainDefenceAt(state, hex);
      if (expedition.troops < cost) break;
      cell.owner = empire.id;
      expedition.troops -= cost;
      claimed += 1;
    }

    const stalled = claimed === 0;
    if (stalled || expedition.troops < ENGINE_TUNING.claimSoldiersPerHex) {
      empire.soldiers = Math.min(empire.reserveCap, empire.soldiers + Math.floor(expedition.troops));
      state.expeditions.splice(index, 1);
    }
  }
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
      scan.candidates.push({ q, r });
    }
  }
  return scans;
}
