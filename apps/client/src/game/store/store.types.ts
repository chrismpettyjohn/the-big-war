import type { GameState } from '../state/state.types';
import type { GameConfig } from '../config/config.types';
import type { Command, CommandResult } from '../commands/commands.types';
import type { GameStore as EngineGameStore } from '@the-big-war/game-engine/store/store.types';

export type MatchFactory = (config: GameConfig) => GameState;

export type GameStore = EngineGameStore<GameState, Command, CommandResult, GameConfig>;

export interface StoreOptions {
  readonly createMatch?: MatchFactory;

  readonly config?: GameConfig;

  readonly startInMenu?: boolean;
}
