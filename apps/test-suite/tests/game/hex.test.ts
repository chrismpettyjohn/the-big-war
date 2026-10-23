import { describe, expect, test } from 'bun:test';
import { DIRECTIONS } from '@the-big-war/game-engine/world-tile/world-tile.constants';
import { area, axialToPixel, distance, gridAt, gridCoord, gridInBounds, gridIndex, hexCorners, hexRound, makeGrid, neighbor, neighbors, pixelToHex, ring } from '@the-big-war/game-engine/world-tile/world-tile.service';

describe('square grid math', () => {
  test('distance is 0 for same cell, symmetric, and rounds Euclid up', () => {
    expect(distance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(distance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(distance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(2);
    expect(distance({ q: 3, r: 4 }, { q: 0, r: 0 })).toBe(5);
  });

  test('four neighbours are distance 1 and distinct', () => {
    const ns = neighbors({ q: 2, r: -1 });
    expect(ns.length).toBe(4);
    expect(new Set(ns.map(n => `${n.q},${n.r}`)).size).toBe(4);
    for (const n of ns) expect(distance({ q: 2, r: -1 }, n)).toBe(1);
  });

  test('neighbor uses stable DIRECTIONS order', () => {
    expect(neighbor({ q: 0, r: 0 }, 0)).toEqual({ q: 1, r: 0 });
    expect(neighbor({ q: 0, r: 0 }, 2)).toEqual({ q: -1, r: 0 });
    expect(DIRECTIONS.length).toBe(4);
  });

  test('ring returns cells at exactly the given radius', () => {
    expect(ring({ q: 0, r: 0 }, 0)).toEqual([{ q: 0, r: 0 }]);
    for (const radius of [1, 3]) {
      const cells = ring({ q: 4, r: -2 }, radius);
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) expect(distance({ q: 4, r: -2 }, cell)).toBe(radius);
    }
  });

  test('area is an inclusive disc', () => {
    expect(area({ q: 0, r: 0 }, 0).length).toBe(1);
    expect(area({ q: 0, r: 0 }, 1).length).toBe(5);
    for (const radius of [1, 2, 4]) {
      const cells = area({ q: 1, r: -1 }, radius);
      expect(new Set(cells.map(c => `${c.q},${c.r}`)).size).toBe(cells.length);
      for (const cell of cells) expect(distance({ q: 1, r: -1 }, cell)).toBeLessThanOrEqual(radius);
    }
  });

  test('hexRound snaps fractional coords to the nearest cell', () => {
    expect(hexRound({ q: 0.4, r: -0.2 })).toEqual({ q: 0, r: 0 });
    expect(hexRound({ q: 2.6, r: -1.4 })).toEqual({ q: 3, r: -1 });
  });

  test('axialToPixel / pixelToHex round-trip and axes are orthogonal', () => {
    const size = 20;
    for (const cell of area({ q: 3, r: 3 }, 3)) {
      expect(pixelToHex(axialToPixel(cell, size), size)).toEqual(cell);
    }
    expect(axialToPixel({ q: 0, r: 0 }, 10)).toEqual({ x: 5, y: 5 });
    expect(axialToPixel({ q: 1, r: 0 }, 10)).toEqual({ x: 15, y: 5 });
    expect(axialToPixel({ q: 0, r: 1 }, 10)).toEqual({ x: 5, y: 15 });
  });

  test('hexCorners returns 4 corners of a square of the given side', () => {
    const corners = hexCorners({ x: 100, y: 50 }, 8);
    expect(corners).toEqual([
      { x: 96, y: 46 },
      { x: 104, y: 46 },
      { x: 104, y: 54 },
      { x: 96, y: 54 },
    ]);
  });

  test('grid helpers index, bounds-check and round-trip coords', () => {
    const grid = makeGrid(5, 4, hex => ({ q: hex.q, r: hex.r }));
    expect(grid.cells.length).toBe(20);
    expect(gridIndex(grid, 2, 1)).toBe(7);
    expect(gridAt(grid, { q: 2, r: 1 })).toEqual({ q: 2, r: 1 });
    expect(gridAt(grid, { q: 5, r: 0 })).toBeUndefined();
    expect(gridAt(grid, { q: -1, r: 0 })).toBeUndefined();
    expect(gridInBounds(grid, 4, 3)).toBe(true);
    expect(gridInBounds(grid, 4, 4)).toBe(false);
    expect(gridCoord(grid, 7)).toEqual({ q: 2, r: 1 });
    expect(gridCoord(grid, 19)).toEqual({ q: 4, r: 3 });
  });
});
