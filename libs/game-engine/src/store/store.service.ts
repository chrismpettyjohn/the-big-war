import { createSignal } from 'solid-js';
import type { Agent } from '../agent/agent.types';
import type { GameStore, StoreEngine } from './store.types';
import type { CommandLike } from '../commands/command.types';
import { FIXED_DT } from '../simulation/simulation.constants';
import { MAX_GAME_SECONDS_PER_STEP } from './store.constants';
import type { MatchStatus, SimulationState } from '../simulation/simulation.types';

export function createGameStore<S extends SimulationState, C extends CommandLike, R extends { readonly ok: boolean }, Config>(
  engine: StoreEngine<S, C, R, Config>,
): GameStore<S, C, R, Config> {
  const bootState = engine.createMatch(engine.config);
  if (engine.startInMenu ?? true) bootState.status = 'menu';

  let current = bootState;
  const [version, setVersion] = createSignal(0);
  const [paused, setPausedSignal] = createSignal(false);

  let accumulator = 0;
  const bump = (): void => {
    setVersion(v => v + 1);
  };

  let agents: readonly Agent<S, C>[] = [];
  const load = (state: S, status?: MatchStatus): void => {
    if (status) state.status = status;
    current = state;
    accumulator = 0;
    agents = engine.createAgents(state);
    state.agentAccumulator = 0;
  };
  load(current);

  const runAgents = (dt: number): void => {
    for (const agent of agents) {
      for (const command of agent(current, dt)) engine.dispatch(current, command);
    }
  };

  const advance = (dtSeconds: number): void => {
    if (current.status !== 'playing' || paused()) return;
    accumulator += Math.max(0, dtSeconds) * current.speed;

    accumulator = Math.min(accumulator, MAX_GAME_SECONDS_PER_STEP);
    while (accumulator >= FIXED_DT) {
      accumulator -= FIXED_DT;
      engine.step(current, FIXED_DT);

      current.agentAccumulator += FIXED_DT;
      if (current.agentAccumulator >= engine.agentTickSeconds(current)) {
        const elapsed = current.agentAccumulator;
        current.agentAccumulator = 0;
        runAgents(elapsed);
      }
    }
  };

  return {
    get state() {
      return current;
    },
    version,
    dispatch(command: C): R {
      const result = engine.dispatch(current, command);
      if (result.ok) bump();
      return result;
    },
    step(dtSeconds: number): void {
      advance(dtSeconds);
      bump();
    },
    reset(next: S): void {
      load(next);
      bump();
    },
    startMatch(nextConfig?: Config): void {
      load(engine.createMatch(nextConfig ?? engine.config), 'playing');
      setPausedSignal(false);
      bump();
    },
    returnToMenu(): void {
      load(engine.createMatch(engine.config), 'menu');
      setPausedSignal(false);
      bump();
    },
    setPaused(next: boolean): void {
      setPausedSignal(next);
      bump();
    },
    paused,
    setSpeed(speed: S['speed']): void {
      current.speed = speed;
      bump();
    },
    status: () => current.status,
    winner: () => current.winner,
  };
}
