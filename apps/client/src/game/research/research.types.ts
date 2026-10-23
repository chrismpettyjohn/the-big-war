import type { Modifier } from '../modifier/modifier.types';

export type ResearchBranch = 'economy' | 'military' | 'territory';

export type ResearchNodeKind = 'modifier' | 'unlock' | 'choice';

export interface UnlockEffect {
  readonly kind: 'unlock';
  readonly key: string;
  readonly label: string;
}

export interface ModifierEffect {
  readonly kind: 'modifier';
  readonly modifiers: readonly Modifier[];
}

export interface ResearchOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly effects: readonly ResearchEffect[];
}

export type ResearchEffect = ModifierEffect | UnlockEffect;

export interface ResearchNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: ResearchNodeKind;
  readonly branch: ResearchBranch;

  readonly cost: number;

  readonly duration: number;

  readonly requires: readonly string[];

  readonly position: { readonly col: number; readonly row: number };

  readonly effects: readonly ResearchEffect[];

  readonly options?: readonly ResearchOption[];
}

