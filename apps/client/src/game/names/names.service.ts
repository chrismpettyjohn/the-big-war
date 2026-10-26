import { NATION_NAMES } from './names.constants';
import type { Rng } from '@the-big-war/game-engine/rng/rng.types';
import { createRng, nextInt } from '@the-big-war/game-engine/rng/rng.service';

export function pickNationNames(rng: Rng, count: number, taken: readonly string[] = []): string[] {
  const reserved = new Set(taken.map(name => name.trim().toLowerCase()));
  const pool = [...new Set(NATION_NAMES)].filter(name => !reserved.has(name.toLowerCase()));
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = nextInt(rng, pool.length);
    picked.push(pool[index]!);
    pool[index] = pool[pool.length - 1]!;
    pool.pop();
  }
  return picked;
}

export function empireNames(seed: number, count: number, taken: readonly string[] = []): string[] {
  return pickNationNames(createRng(seed ^ 0x4e414d45), count, taken);
}
