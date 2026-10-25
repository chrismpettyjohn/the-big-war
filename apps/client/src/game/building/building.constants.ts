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
  'trench',
  'machine_gun',
  'battery',
  'bunker',
];

export const PRODUCTION_BUILDINGS: ReadonlySet<BuildingKind> = new Set<BuildingKind>([
  'market',
  'lumberjack',
  'miner',
  'lab',
  'farm',
]);

export const FREE_STANDING_BUILDINGS: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['trench']);

export const FLAT_COST_BUILDINGS: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['trench']);
