import type { ModifierKey } from './modifier.types';

const MODIFIER_COVERED: Record<ModifierKey, true> = {
  goldIncome: true,
  scienceRate: true,
  growth: true,
  buildCost: true,
  attack: true,
  defence: true,
  reserveCap: true,
  recruitSpeed: true,
  frontAttack: true,
  frontDefence: true,
};

export const MODIFIER_KEYS: readonly ModifierKey[] = Object.keys(MODIFIER_COVERED) as ModifierKey[];
