import type { GameState } from '../state/state.types';
import type { Empire, EmpireSeed } from './empire.types';
import type { GameConfig } from '../config/config.types';
import { emptyModifierTotals } from '../modifier/modifier.service';
import { CHEAT_UNLIMITED_GOLD_AMOUNT, CHEAT_UNLIMITED_GOLD_NAME, NEUTRAL_OWNER } from './empire.constants';

export function createEmpire(config: GameConfig, seed: EmpireSeed): Empire {
  const unlimited = seed.isHuman && isUnlimitedGoldName(seed.name);
  return {
    id: seed.id,
    name: seed.name,
    factionId: seed.factionId,
    isHuman: seed.isHuman,
    neutralState: seed.neutralState,
    colorIndex: seed.id,
    gold: unlimited ? CHEAT_UNLIMITED_GOLD_AMOUNT : config.start.gold,
    science: config.start.science,
    civilians: config.start.civilians,
    civilianBalance: 0,
    troopBalance: 0,
    soldiers: config.start.soldiers,
    reserveCap: config.recruit.baseReserveCap,
    drafting: false,
    bonuses: emptyModifierTotals(),
    research: { completed: [], chosen: {}, active: null },
    unlocks: [],
    hexCount: 0,
    alive: true,
    eliminatedAt: null,
  };
}

export function refreshHexCounts(state: GameState): void {
  const counts = new Array<number>(state.empires.length).fill(0);
  for (const cell of state.grid.cells) {
    if (cell.owner === NEUTRAL_OWNER) continue;
    if (cell.owner >= 0 && cell.owner < counts.length) counts[cell.owner]! += 1;
  }
  for (const empire of state.empires) empire.hexCount = counts[empire.id] ?? 0;
}

export function hasUnlimitedGold(empire: Empire): boolean {
  return empire.isHuman && isUnlimitedGoldName(empire.name);
}

export function isUnlimitedGoldName(name: string): boolean {
  return name.trim().toLowerCase() === CHEAT_UNLIMITED_GOLD_NAME;
}
