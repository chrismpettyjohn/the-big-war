import type { Rng } from './rng.types';

export function createRng(seed: number): Rng {
  const s = seed >>> 0;
  return { state: s === 0 ? 0x9e3779b9 : s };
}

export function nextUint(rng: Rng): number {
  
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export function nextFloat(rng: Rng): number {
  return nextUint(rng) / 4294967296;
}

export function nextInt(rng: Rng, exclusiveMax: number): number {
  if (exclusiveMax <= 0) return 0;
  return nextUint(rng) % exclusiveMax;
}

export function chance(rng: Rng, probability: number): boolean {
  return nextFloat(rng) < probability;
}

export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[nextInt(rng, items.length)];
}
