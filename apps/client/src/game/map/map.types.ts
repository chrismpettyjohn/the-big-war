import type { EmpireId } from '../empire/empire.types';
import type { Building } from '../building/building.types';
import type { AxialGrid } from '@the-big-war/game-engine/world-tile/world-tile.types';

export type Terrain = 'plain' | 'forest' | 'mountain' | 'ore';

export interface HexCell {
  readonly q: number;
  readonly r: number;
  terrain: Terrain;

  owner: EmpireId;

  harvested?: number;
  building: Building | null;
}

export type HexGrid = AxialGrid<HexCell>;
