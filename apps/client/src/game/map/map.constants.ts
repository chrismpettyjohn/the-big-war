import type { Terrain } from './map.types';

export const TERRAINS: readonly Terrain[] = ['plain', 'forest', 'mountain'];

export const MAP_SHAPE = {
  forestPatches: 16,

  mountainRanges: 6,
  rangeMinLength: 8,
  rangeMaxLength: 18,
  rangeTurnChance: 0.3,
  rangeWidenChance: 0.35,

  patchMinRadius: 2,
  patchMaxRadius: 5,

  forestVeinChance: 0.03,

  startClearance: 0,
} as const;
