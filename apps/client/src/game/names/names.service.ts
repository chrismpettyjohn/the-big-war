import { NATION_NAMES } from './names.constants';
import type { Rng } from '@the-big-war/game-engine/rng/rng.types';
import { createRng, nextInt } from '@the-big-war/game-engine/rng/rng.service';

export function pickNationNames(rng: Rng, count: number): string[] {
  const pool = [...NATION_NAMES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = nextInt(rng, pool.length);
    picked.push(pool[index]!);
    pool[index] = pool[pool.length - 1]!;
    pool.pop();
  }
  return picked;
}

export function empireNames(seed: number, count: number): string[] {
  return pickNationNames(createRng(seed ^ 0x4e414d45), count);
}
