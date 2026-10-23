/**
 * Deterministic RNG for the simulation.
 *
 * The sim must be fully deterministic given a seed (bots, replays, tests).
 * Rule for every gameplay system: never call `Math.random()` inside `src/game`
 * — pull numbers from the `Rng` stored on `GameState.rng` (or a bot-private
 * rng created from a derived seed). The state is a plain mutable object so it
 * stays trivially serialisable later if we ever want replays.
 */

/** Mutable rng state. Serialisable (one number), deterministic given a seed. */
export interface Rng {
  /** Current xorshift state. Never zero. */
  state: number;
}

/** Create an rng from a32-bit seed. Seed0 is remapped so state is never 0. */
export function createRng(seed: number): Rng {
  const s = seed >>> 0;
  return { state: s === 0 ? 0x9e3779b9 : s };
}

/** Next raw32-bit unsigned integer. Mutates `rng.state`. */
export function nextUint(rng: Rng): number {
  // mulberry32 — tiny, fast, good enough for gameplay,32-bit state.
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Float in [0, 1). */
export function nextFloat(rng: Rng): number {
  return nextUint(rng) / 4294967296;
}

/** Integer in [0, exclusiveMax). Returns0 when exclusiveMax <= 0. */
export function nextInt(rng: Rng, exclusiveMax: number): number {
  if (exclusiveMax <= 0) return 0;
  return nextUint(rng) % exclusiveMax;
}

/** True with the given probability (0..1). */
export function chance(rng: Rng, probability: number): boolean {
  return nextFloat(rng) < probability;
}

/** Pick one element of a non-empty array (returns undefined when empty). */
export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[nextInt(rng, items.length)];
}
