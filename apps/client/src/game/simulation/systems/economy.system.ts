import { ENGINE_TUNING } from '../simulation.constants';
import { terrainShare } from '../../map/terrain.service';
import type { GameState } from '../../state/state.types';
import type { EmpireId } from '../../empire/empire.types';
import { hasUnlimitedGold } from '../../empire/empire.service';
import type { OwnedBuilding } from '../../building/building.types';
import { CHEAT_UNLIMITED_GOLD_AMOUNT } from '../../empire/empire.constants';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { resolveModifier } from '@the-big-war/game-engine/modifier/modifier.service';
import { isProductionBuilding, ownedBuildings } from '../../building/building.service';

const civilianGrowthRate: number[] = [];

export function civilianGrowthRateOf(empireId: EmpireId): number {
  return civilianGrowthRate[empireId] ?? 0;
}

export function stepEconomy(state: GameState, dt: number): void {
  const econ = state.config.economy;
  const support = state.config.support;

  for (const empire of state.empires) {
    if (!empire.alive) {
      empire.civilianBalance = 0;
      civilianGrowthRate[empire.id] = 0;
      continue;
    }
    const owned = ownedBuildings(state, empire.id);
    let jobs = 0;
    for (const { building } of owned) {
      if (isProductionBuilding(building.kind)) jobs += econ.workersPerBuilding;
    }
    const workers = Math.min(empire.civilians, jobs);
    const staffing = jobs > 0 ? workers / jobs : 1;

    let rawGold = 0;
    let rawScience = 0;
    for (const { hex, building } of owned) {
      switch (building.kind) {
        case 'market':
          rawGold += econ.marketGoldPerSecond;
          break;
        case 'lumberjack':
          rawGold += econ.lumberjackGoldPerSecond * lumberjackTerrainBonus(state, empire.id, hex, support.lumberjackRadius);
          break;
        case 'miner':
          rawGold += econ.minerGoldPerSecond * minerTerrainBonus(state, empire.id, hex, support.minerRadius);
          break;
        case 'lab':
          rawScience += econ.labSciencePerSecond * labLevelBonus(building.level);
          break;
        default:
          break;
      }
    }

    const goldIncome = resolveModifier(rawGold, empire.bonuses.goldIncome) * staffing;
    empire.gold += goldIncome * dt;
    if (empire.gold < 0) empire.gold = 0;

    const labGoldCost = econ.labGoldPerSecond * staffing * labsOf(owned) * dt;
    let scienceProduction = resolveModifier(rawScience, empire.bonuses.scienceRate) * staffing;
    if (empire.gold <= 0 && labGoldCost > 0) scienceProduction = 0;
    else empire.gold = Math.max(0, empire.gold - labGoldCost);
    empire.science += scienceProduction * dt;
    if (hasUnlimitedGold(empire)) empire.gold = CHEAT_UNLIMITED_GOLD_AMOUNT;

    const passive = empire.civilians * econ.baseGrowthPerCivilian;
    let farmGrowth = 0;
    let cityGrowth = 0;
    for (const { building } of owned) {
      if (building.kind === 'city') {
        cityGrowth += ENGINE_TUNING.cityPopGrowthPerLevel * building.level;
        continue;
      }
      if (building.kind !== 'farm') continue;
      building.growth = Math.min(econ.farmGrowthMax, building.growth + dt / farmMaturitySeconds(state));
      farmGrowth += econ.farmGrowthPerFarm * (1 + building.growth);
    }
    const landGrowth = (passive + farmGrowth) * staffing;
    const growth = resolveModifier(landGrowth + cityGrowth, empire.bonuses.growth);
    civilianGrowthRate[empire.id] = growth;
  }
}

function labsOf(owned: readonly OwnedBuilding[]): number {
  let count = 0;
  for (const { building } of owned) if (building.kind === 'lab') count += 1;
  return count;
}

function farmMaturitySeconds(state: GameState): number {
  return state.config.economy.farmGrowthMax * 60;
}

function labLevelBonus(level: number): number {
  return 1 + (level - 1) * 0.25;
}

function lumberjackTerrainBonus(state: GameState, empireId: EmpireId, hex: Axial, radius: number): number {
  return terrainShare(state, empireId, hex, radius, 'forest');
}

function minerTerrainBonus(state: GameState, empireId: EmpireId, hex: Axial, radius: number): number {
  return terrainShare(state, empireId, hex, radius, 'mountain');
}
