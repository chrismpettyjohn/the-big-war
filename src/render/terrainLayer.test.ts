import { describe, expect, test } from 'bun:test';
import type { AxialGrid } from '../game/hex';
import { axialToPixel, makeGrid } from '../game/hex';
import type { HexCell } from '../game/types';
import { NEUTRAL_OWNER } from '../game/types';
import { visibleHexRange, terrainSignature } from './terrainLayer';

function makeCellGrid(width: number, height: number): AxialGrid<HexCell> {
  return makeGrid<HexCell>(width, height, hex => ({
    q: hex.q,
    r: hex.r,
    terrain: 'plain',
    owner: NEUTRAL_OWNER,
    building: null,
  }));
}

describe('visibleHexRange', () => {
  test('returns null when the rect misses the grid entirely', () => {
    const grid = makeCellGrid(8, 6);
    // Far to the left of the origin hex.
    const range = visibleHexRange(grid, 32, -100000, -100000, -99900, -99900);
    expect(range).toBeNull();
  });

  test('clamps the range to grid bounds', () => {
    const grid = makeCellGrid(8, 6);
    const range = visibleHexRange(grid, 32, -10000, -10000, 10000, 10000);
    expect(range).toEqual({ minQ: 0, maxQ: 7, minR: 0, maxR: 5 });
  });

  test('a rect around one hex centre includes that hex', () => {
    const grid = makeCellGrid(20, 20);
    const center = axialToPixel({ q: 10, r: 8 }, 32);
    const range = visibleHexRange(grid, 32, center.x - 1, center.y - 1, center.x + 1, center.y + 1);
    expect(range).not.toBeNull();
    if (!range) return;
    expect(range.minQ).toBeLessThanOrEqual(10);
    expect(range.maxQ).toBeGreaterThanOrEqual(10);
    expect(range.minR).toBeLessThanOrEqual(8);
    expect(range.maxR).toBeGreaterThanOrEqual(8);
  });
});

describe('terrainSignature', () => {
  test('is stable for identical visible slices', () => {
    const grid = makeCellGrid(10, 10);
    const range = { minQ: 2, maxQ: 5, minR: 1, maxR: 4 };
    expect(terrainSignature(grid, range)).toBe(terrainSignature(grid, range));
  });

  test('changes when an owner inside the range changes', () => {
    const grid = makeCellGrid(10, 10);
    const range = { minQ: 2, maxQ: 5, minR: 1, maxR: 4 };
    const before = terrainSignature(grid, range);
    const cell = grid.cells[2 * grid.width + 3];
    if (cell) cell.owner = 4;
    expect(terrainSignature(grid, range)).not.toBe(before);
  });

  test('ignores cells outside the range', () => {
    const grid = makeCellGrid(10, 10);
    const range = { minQ: 0, maxQ: 2, minR: 0, maxR: 2 };
    const before = terrainSignature(grid, range);
    const outside = grid.cells[9 * grid.width + 9];
    if (outside) outside.owner = 6;
    expect(terrainSignature(grid, range)).toBe(before);
  });
});
