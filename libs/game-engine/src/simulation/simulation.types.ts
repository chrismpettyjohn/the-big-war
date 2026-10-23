export type MatchStatus = 'menu' | 'playing' | 'ended';

export interface SimulationState {
  status: MatchStatus;

  elapsed: number;

  tick: number;

  speed: number;
  winner: number | null;

  agentAccumulator: number;
}

export type System<S extends SimulationState> = (state: S, dt: number) => void;

export type Stepper<S extends SimulationState> = (state: S, dt?: number) => void;
