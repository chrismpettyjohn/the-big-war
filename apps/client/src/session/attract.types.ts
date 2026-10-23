import type { MatchSettings } from './flow.types';
import type { WorldRenderer } from '../render/world.types';

export interface AttractSequence {
  readonly settings: MatchSettings;

  readonly seconds: number;

  readonly speed: 1 | 2 | 4;
}

export interface AttractOptions {
  readonly world: WorldRenderer;

  readonly sequences?: readonly AttractSequence[];
}

export interface AttractMode {
  start(): void;

  stop(): void;
}
