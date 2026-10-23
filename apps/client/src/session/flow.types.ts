import type { Accessor } from 'solid-js';

export type Screen = 'menu' | 'match' | 'end';

export type MapSize = 'small' | 'medium' | 'large';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type NeutralStates = 'none' | 'few' | 'many';

export interface MatchSettings {
  readonly bots: readonly string[];
  readonly mapSize: MapSize;
  readonly difficulty: Difficulty;
  readonly neutralStates: NeutralStates;
  readonly seed: number;
}

export interface MatchResult {
  readonly winner: number | null;
  readonly playerWon: boolean;
}

export interface MatchFlow {
  readonly screen: Accessor<Screen>;
  readonly settings: Accessor<MatchSettings>;
  readonly playerFaction: Accessor<string>;
  readonly playerName: Accessor<string>;
  readonly lastResult: Accessor<MatchResult | null>;

  backToMenu(): void;
  updateSettings(patch: Partial<MatchSettings>): void;
  chooseFaction(factionId: string): void;
  setPlayerName(name: string): void;
  
  enterMatch(): void;
  
  showResult(winner: number | null, playerEmpire: number): void;
}
