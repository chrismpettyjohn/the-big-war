import type { Axial } from './world-tile.types';

export const DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
];
