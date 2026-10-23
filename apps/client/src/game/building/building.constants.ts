import type { BuildingKind } from './building.types';

export const BUILDING_KINDS: readonly BuildingKind[] = [
  'city',
  'market',
  'farm',
  'lumberjack',
  'miner',
  'lab',
  'barracks',
  'fort',
  'cannon',
];

export const PRODUCTION_BUILDINGS: ReadonlySet<BuildingKind> = new Set<BuildingKind>([
  'market',
  'lumberjack',
  'miner',
  'lab',
  'farm',
]);
