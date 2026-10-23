import type { HexCell } from '../map/map.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';

export type BuildingId = number;

export type BuildingKind =
  | 'city'
  | 'market'
  | 'lumberjack'
  | 'miner'
  | 'farm'
  | 'lab'
  | 'barracks'
  | 'fort'
  | 'cannon';

export interface Building {
  readonly id: BuildingId;
  readonly kind: BuildingKind;

  level: number;

  cooldown: number;

  growth: number;

  demolishAt: number | null;

  buildRemaining: number;
}

export interface OwnedBuilding {
  readonly hex: Axial;
  readonly cell: HexCell;
  readonly building: Building;
}
