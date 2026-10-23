import { DIRECTIONS } from './world-tile.constants';
import type { Axial, AxialGrid, Pixel } from './world-tile.types';

export function neighbor(hex: Axial, direction: number): Axial {
  const dir = DIRECTIONS[direction];
  if (!dir) return { q: hex.q, r: hex.r };
  return { q: hex.q + dir.q, r: hex.r + dir.r };
}

export function neighbors(hex: Axial): Axial[] {
  return DIRECTIONS.map(dir => ({ q: hex.q + dir.q, r: hex.r + dir.r }));
}

export function isAxialInt(hex: Axial): boolean {
  return Number.isInteger(hex.q) && Number.isInteger(hex.r);
}

export function distance(a: Axial, b: Axial): number {
  return Math.max(0, Math.ceil(Math.hypot(a.q - b.q, a.r - b.r) - 1e-9));
}

export function hexRound(frac: Axial): Axial {
  return { q: Math.round(frac.q) + 0, r: Math.round(frac.r) + 0 };
}

export function axialToPixel(hex: Axial, size: number): Pixel {
  return { x: (hex.q + 0.5) * size, y: (hex.r + 0.5) * size };
}

export function pixelToAxialFractional(pixel: Pixel, size: number): Axial {
  return { q: pixel.x / size - 0.5, r: pixel.y / size - 0.5 };
}

export function pixelToHex(pixel: Pixel, size: number): Axial {
  return { q: Math.floor(pixel.x / size) + 0, r: Math.floor(pixel.y / size) + 0 };
}

export function hexCorners(center: Pixel, size: number): Pixel[] {
  const half = size / 2;
  return [
    { x: center.x - half, y: center.y - half },
    { x: center.x + half, y: center.y - half },
    { x: center.x + half, y: center.y + half },
    { x: center.x - half, y: center.y + half },
  ];
}

export function ring(center: Axial, radius: number): Axial[] {
  if (radius <= 0) return [{ q: center.q, r: center.r }];
  const results: Axial[] = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      const hex = { q: center.q + q, r: center.r + r };
      if (distance(center, hex) === radius) results.push(hex);
    }
  }
  return results;
}

export function area(center: Axial, radius: number): Axial[] {
  const results: Axial[] = [{ q: center.q, r: center.r }];
  for (let k = 1; k <= radius; k++) results.push(...ring(center, k));
  return results;
}

export function gridInBounds<T>(grid: AxialGrid<T>, q: number, r: number): boolean {
  return q >= 0 && r >= 0 && q < grid.width && r < grid.height;
}

export function gridIndex<T>(grid: AxialGrid<T>, q: number, r: number): number {
  return r * grid.width + q;
}

export function gridAt<T>(grid: AxialGrid<T>, hex: Axial): T | undefined {
  if (!gridInBounds(grid, hex.q, hex.r)) return undefined;
  return grid.cells[gridIndex(grid, hex.q, hex.r)];
}

export function gridCoord<T>(grid: AxialGrid<T>, index: number): Axial {
  return { q: index % grid.width, r: Math.floor(index / grid.width) };
}

export function makeGrid<T>(width: number, height: number, fill: (hex: Axial) => T): AxialGrid<T> {
  const cells: T[] = [];
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) cells.push(fill({ q, r }));
  }
  return { width, height, cells };
}
