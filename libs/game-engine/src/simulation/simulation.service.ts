import { FIXED_DT } from './simulation.constants';
import type { SimulationState, Stepper, System } from './simulation.types';

export function createStepper<S extends SimulationState>(systems: readonly System<S>[]): Stepper<S> {
  return (state: S, dt: number = FIXED_DT): void => {
    if (state.status !== 'playing') return;

    state.elapsed += dt;
    state.tick += 1;

    for (const system of systems) system(state, dt);
  };
}
