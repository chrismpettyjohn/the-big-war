import type { Terrain } from './map.types';

export const TERRAINS: readonly Terrain[] = ['plain', 'forest', 'mountain', 'ore'];

export const MAP_SHAPE = {
  forestPatches: 6,

  mountainRanges: 2,
  rangeMinLength: 4,
  rangeMaxLength: 8,
  rangeBend: 0.4,
  rangeTaper: 0.15,
  rangeEdgeInset: 3,
  rangeWidenChance: 0.05,

  wallRegions: 8,
  wallRegionSpacing: 12,
  wallThickness: 2.6,
  wallWarp: 2.5,
  wallWarpCell: 10,
  wallKeepChance: 0.85,
  passSpacing: 14,
  passRadius: 1,

  pocketMinSize: 12,

  oreDeposits: 6,
  oreSpacing: 12,
  oreMinSize: 1,
  oreMaxSize: 3,

  patchMinRadius: 2,
  patchMaxRadius: 5,

  forestVeinChance: 0.008,

  startClearance: 0,
} as const;
