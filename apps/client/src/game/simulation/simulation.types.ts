import type { ModifierLine } from '../front/front.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';

export interface FrontModifiersResult {
  readonly attack: number;
  readonly defence: number;
  readonly lines: ModifierLine[];
}

export interface FrontTickContext {
  readonly sideA: FrontModifiersResult;
  readonly sideB: FrontModifiersResult;
  readonly terrainDefenceA: number;
  readonly terrainDefenceB: number;
  readonly attackerA: boolean;
  readonly attackerB: boolean;
}

export interface FrontierScan {
  candidates: Axial[];
  barracks: number;
  forts: number;
}
