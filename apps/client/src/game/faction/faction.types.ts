import type { Modifier } from '../modifier/modifier.types';

export interface FactionDef {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;

  readonly colorIndex: number;
  readonly bonuses: readonly Modifier[];
}
