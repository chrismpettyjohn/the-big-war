import { describe, expect, test } from 'bun:test';
import {
  area,
  axialToPixel,
  distance,
  DIRECTIONS,
  gridAt,
  gridCoord,
  gridInBounds,
  gridIndex,
  hexCorners,
  hexRound,
  makeGrid,
  neighbor,
  neighbors,
  pixelToHex,
  ring,
} from './hex';

describe('hex math', () => {
  test('distance is0 for same hex and symmetric elsewhere', () => {
    expect(distance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(distance({ q: 0, r: 0 }, { q: 3, r: -2 })).toBe(3);
    expect(distance({ q: 3, r: -2 }, { q: 0, r: 0 })).toBe(3);
    expect(distance({ q: -4, r: 1 }, { q: 2, r: -3 })).toBe(6);
  });

  test('all six neighbours are distance1 and distinct', () => {
    const ns = neighbors({ q: 2, r: -1 });
    expect(ns.length).toBe(6);
    const seen = new Set(ns.map(n => `${n.q},${n.r}`));
    expect(seen.size).toBe(6);
    for (const n of ns) expect(distance({ q: 2, r: -1 }, n)).toBe(1);
  });

  test('neighbor uses stable DIRECTIONS order', () => {
    expect(neighbor({ q: 0, r: 0 }, 0)).toEqual({ q: 1, r: 0 });
    expect(neighbor({ q: 0, r: 0 }, 3)).toEqual({ q: -1, r: 0 });
    expect(DIRECTIONS.length).toBe(6);
  });

  test('ring returns hexes at exactly the given radius', () => {
    const r1 = ring({ q: 0, r: 0 }, 1);
    expect(r1.length).toBe(6);
    for (const hex of r1) expect(distance({ q: 0, r: 0 }, hex)).toBe(1);
    const r3 = ring({ q: 4, r: -2 }, 3);
    expect(r3.length).toBe(18);
    for (const hex of r3) expect(distance({ q: 4, r: -2 }, hex)).toBe(3);
  });

  test('area is an inclusive disk of the correct size', () => {
    expect(area({ q: 0, r: 0 }, 0).length).toBe(1);
    // Hex number of a disk of radius n is1 +3n(n+1).
    for (const radius of [1, 2, 4]) {
      const hexes = area({ q: 1, r: -1 }, radius);
      expect(hexes.length).toBe(1 + 3 * radius * (radius + 1));
      for (const hex of hexes) expect(distance({ q: 1, r: -1 }, hex)).toBeLessThanOrEqual(radius);
    }
  });

  test('hexRound snaps fractional coords to the nearest hex', () => {
    expect(hexRound({ q: 0.4, r: -0.2 })).toEqual({ q: 0, r: 0 });
    expect(hexRound({ q: 2.6, r: -1.4 })).toEqual({ q: 3, r: -2 });
    expect(hexRound({ q: -1.2, r: 0.9 })).toEqual({ q: -1, r: 1 });
  });

  test('axialToPixel / pixelToHex round-trip on integer hexes', () => {
    const size = 32;
    for (const hex of area({ q: 0, r: 0 }, 3)) {
      const pixel = axialToPixel(hex, size);
      expect(pixelToHex(pixel, size)).toEqual(hex);
    }
  });

  test('pointy-top orientation: q axis is horizontal, r axis is60° down', () => {
    const a = axialToPixel({ q: 0, r: 0 }, 10);
    const b = axialToPixel({ q: 1, r: 0 }, 10);
    const c = axialToPixel({ q: 0, r: 1 }, 10);
    expect(a).toEqual({ x: 0, y: 0 });
    expect(b.y).toBeCloseTo(0, 6);
    expect(b.x).toBeCloseTo(Math.sqrt(3) * 10, 6);
    expect(c.x).toBeCloseTo((Math.sqrt(3) / 2) * 10, 6);
    expect(c.y).toBeCloseTo(15, 6);
  });

  test('hexCorners returns6 points at distance size from centre', () => {
    const corners = hexCorners({ x: 100, y: 50 }, 8);
    expect(corners.length).toBe(6);
    for (const corner of corners) {
      const dx = corner.x - 100;
      const dy = corner.y - 50;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(8, 6);
    }
    // Pointy-top with y-down pixels: corner0 is at30° → down-right of centre,
    // and the top point of the hex is corner4 (270°).
    expect(corners[0]!.x).toBeGreaterThan(100);
    expect(corners[0]!.y).toBeGreaterThan(50);
    expect(corners[4]!.y).toBeLessThan(50);
    expect(corners[4]!.x).toBeCloseTo(100, 6);
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
