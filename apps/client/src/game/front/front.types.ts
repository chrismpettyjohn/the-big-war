import type { EmpireId } from '../empire/empire.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';

export type FrontId = string;

export type FrontSideKey = 'A' | 'B';
export type FrontMode = 'attack' | 'defence' | 'counterattack';

export interface ModifierLine {
  readonly label: string;

  readonly attack: number;
  readonly defence: number;
}

export interface FrontModifiers {
  readonly attack: number;
  readonly defence: number;

  readonly lines: readonly ModifierLine[];
}

export interface FrontSide {
  readonly empire: EmpireId;

  troops: number;
  mode: FrontMode;

  modifiers: FrontModifiers;
}

export interface FrontResolution {

  readonly at: number;

  readonly lossesA: number;
  readonly lossesB: number;

  readonly capturedBy: EmpireId | null;
}

export interface Front {
  readonly id: FrontId;
  readonly hexA: Axial;
  readonly hexB: Axial;
  readonly sideA: FrontSide;
  readonly sideB: FrontSide;

  cluster: number;

  resolution: FrontResolution | null;

  capture: { by: EmpireId; progress: number; duration: number } | null;

  lastAttackAt: number;
}

