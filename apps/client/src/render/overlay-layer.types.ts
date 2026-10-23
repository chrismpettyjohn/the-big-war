import type { Front } from '../game/front/front.types';
import type { BuildingKind } from '../game/building/building.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';

export interface PlacementGhost {
  readonly hex: Axial;
  readonly kind: BuildingKind;
  readonly valid: boolean;
}

export interface OverlayState {
  
  selected: Axial | null;
  
  hovered: Axial | null;
  
  fronts: readonly Front[];
  
  cannonFrom: Axial | null;
  
  cannonRange: number;
  
  cannonTarget: Axial | null;

  ghost: PlacementGhost | null;
}
