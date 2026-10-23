/**
 * Axial-coordinate, pointy-top hex math.
 *
 * Pure functions only — no game state, no DOM, no PIXI. The renderer converts
 * hex coords to pixels with `axialToPixel`; input code converts pointer
 * positions back with `pixelToHex`. Flat grid storage is an `AxialGrid<T>`
 * (see below); `GameState.grid` is an `AxialGrid<HexCell>`.
 *
 * Conventions:
 * - Axial coords (q, r); the third cube coordinate s is always -q - r.
 * - q grows to the "east", r grows to the "south-east" (pointy-top layout).
 * - Pixel space: x right, y down (matches PIXI and the DOM).
 */

/** Axial hex coordinate. q = column-ish, r = row-ish. */
export interface Axial {
  q: number;
  r: number;
}

/** A pixel-space point (PIXI/DOM coordinates: y grows down). */
export interface Pixel {
  x: number;
  y: number;
}

/** The six neighbour directions, in stable order (used for deterministic ties). */
export const DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Neighbour of `hex` in direction index0..5 (see DIRECTIONS). */
export function neighbor(hex: Axial, direction: number): Axial {
  const dir = DIRECTIONS[direction];
  if (!dir) return { q: hex.q, r: hex.r };
  return { q: hex.q + dir.q, r: hex.r + dir.r };
}

/** All six neighbours, in DIRECTIONS order. */
export function neighbors(hex: Axial): Axial[] {
  return DIRECTIONS.map(dir => ({ q: hex.q + dir.q, r: hex.r + dir.r }));
}

/** True when both coords are integers. */
export function isAxialInt(hex: Axial): boolean {
  return Number.isInteger(hex.q) && Number.isInteger(hex.r);
}

/** Chebrect distance in hexes (cube-coordinate max norm). */
export function distance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/** Round a fractional axial coord to the nearest integer hex (cube rounding). */
export function hexRound(frac: Axial): Axial {
  let q = frac.q;
  let r = frac.r;
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // Normalise -0 (Math.round of a small negative) so results compare cleanly.
  return { q: rq === 0 ? 0 : rq, r: rr === 0 ? 0 : rr };
}

/**
 * Pixel centre of a hex for pointy-top layout.
 * `size` is the circumradius (centre → corner) in pixels.
 */
export function axialToPixel(hex: Axial, size: number): Pixel {
  const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = size * ((3 / 2) * hex.r);
  return { x, y };
}

/** Fractional axial coord of a pixel position (pointy-top). Not yet rounded. */
export function pixelToAxialFractional(pixel: Pixel, size: number): Axial {
  const q = ((Math.sqrt(3) / 3) * pixel.x - (1 / 3) * pixel.y) / size;
  const r = ((2 / 3) * pixel.y) / size;
  return { q, r };
}

/** The integer hex under a pixel position (pointy-top). */
export function pixelToHex(pixel: Pixel, size: number): Axial {
  return hexRound(pixelToAxialFractional(pixel, size));
}

/** The six corner points (pixels) of a hex centred on `center` (pointy-top). */
export function hexCorners(center: Pixel, size: number): Pixel[] {
  const corners: Pixel[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i + 30) * Math.PI) / 180;
    corners.push({ x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) });
  }
  return corners;
}

/** The `radius`-th ring around `center`: hexes at exactly that distance. */
export function ring(center: Axial, radius: number): Axial[] {
  if (radius <= 0) return [{ q: center.q, r: center.r }];
  const results: Axial[] = [];
  // Start one step along direction4, walk the6 sides.
  let hex = { q: center.q + DIRECTIONS[4]!.q * radius, r: center.r + DIRECTIONS[4]!.r * radius };
  for (let i = 0; i < 6; i++) {
    const dir = DIRECTIONS[i]!;
    for (let step = 0; step < radius; step++) {
      results.push({ q: hex.q, r: hex.r });
      hex = { q: hex.q + dir.q, r: hex.r + dir.r };
    }
  }
  return results;
}

/** All hexes within `radius` of `center` (inclusive disk, unordered). */
export function area(center: Axial, radius: number): Axial[] {
  const results: Axial[] = [{ q: center.q, r: center.r }];
  for (let k = 1; k <= radius; k++) results.push(...ring(center, k));
  return results;
}

/**
 * Flat rectangular grid of cells indexed by `r * width + q`.
 * `HexGrid` in types.ts is `AxialGrid<HexCell>`; the generic keeps hex.ts free
 * of game types.
 */
export interface AxialGrid<T> {
  readonly width: number;
  readonly height: number;
  /** Length is always width * height; `cells[r * width + q]`. */
  readonly cells: T[];
}

/** True when (q, r) is inside the grid. */
export function gridInBounds<T>(grid: AxialGrid<T>, q: number, r: number): boolean {
  return q >= 0 && r >= 0 && q < grid.width && r < grid.height;
}

/** Flat index of (q, r). No bounds check — validate with gridInBounds first. */
export function gridIndex<T>(grid: AxialGrid<T>, q: number, r: number): number {
  return r * grid.width + q;
}

/** Cell at (q, r), or undefined when out of bounds. */
export function gridAt<T>(grid: AxialGrid<T>, hex: Axial): T | undefined {
  if (!gridInBounds(grid, hex.q, hex.r)) return undefined;
  return grid.cells[gridIndex(grid, hex.q, hex.r)];
}

/** Axial coord of a flat cell index (inverse of gridIndex). */
export function gridCoord<T>(grid: AxialGrid<T>, index: number): Axial {
  return { q: index % grid.width, r: Math.floor(index / grid.width) };
}

/** Build a grid from a fill function. */
export function makeGrid<T>(width: number, height: number, fill: (hex: Axial) => T): AxialGrid<T> {
  const cells: T[] = [];
  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) cells.push(fill({ q, r }));
  }
  return { width, height, cells };
}
