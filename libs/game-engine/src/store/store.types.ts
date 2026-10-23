import type { Accessor } from 'solid-js';
import type { Agent } from '../agent/agent.types';
import type { CommandLike, Dispatcher } from '../commands/command.types';
import type { MatchStatus, SimulationState, Stepper } from '../simulation/simulation.types';

export type MatchFactory<S, Config> = (config: Config) => S;

export interface StoreEngine<S extends SimulationState, C extends CommandLike, R extends { readonly ok: boolean }, Config> {
  readonly config: Config;

  readonly createMatch: MatchFactory<S, Config>;

  readonly step: Stepper<S>;

  readonly dispatch: Dispatcher<S, C, R>;

  readonly createAgents: (state: S) => readonly Agent<S, C>[];

  readonly agentTickSeconds: (state: S) => number;

  readonly startInMenu?: boolean;
}

export interface GameStore<S extends SimulationState, C extends CommandLike, R, Config> {
  readonly state: S;

  readonly version: Accessor<number>;

  dispatch(command: C): R;

  step(dtSeconds: number): void;

  reset(state: S): void;

  startMatch(config?: Config): void;

  returnToMenu(): void;

  setPaused(paused: boolean): void;
  readonly paused: Accessor<boolean>;

  setSpeed(speed: S['speed']): void;

  readonly status: Accessor<MatchStatus>;

  readonly winner: Accessor<S['winner']>;
}
