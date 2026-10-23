/**
 * Terrain layer — owner-coloured, flat-shaded hex fills with terrain glyphs.
 *
 * Two `Graphics` passes under one `Container`:
 *  1. fills  — one `Graphics` rebuilt per redraw, walking only the visible hex
 *     range. Each hex is a pointy-top polygon filled with its owner colour mixed
 *     with the terrain tint and a deterministic per-hex brightness jitter, then
 *     stroked with a darkened owner border.
 *  2. glyphs — a second `Graphics` for terrain detail (trees / mountain facets /
 *     water rim), drawn at a coarser cadence than fills so dense maps stay cheap.
 *
 * Batching: PIXI 8's `Graphics` accumulates one geometry batch per `.fill()`/
 * `.stroke()` run; chaining shapes between a single `fill`/`stroke` pair keeps the
 * visible pass to a handful of draw calls. We deliberately avoid per-hex `Text`.
 *
 * Culling: `visibleHexRange` (pure, unit-tested) maps the camera's screen rect
 * back to axial bounds via `pixelToHex` on the corners, then clamps to the grid.
 */

import { Container, Graphics } from 'pixi.js';
import type { AxialGrid } from '../game/hex';
import type { Pixel } from '../game/hex';
import { axialToPixel, hexCorners, pixelToHex } from '../game/hex';
import type { HexCell } from '../game/types';
import {
  HEX_BORDER_DARKEN,
  HEX_BORDER_WIDTH,
  NEUTRAL_BORDER_COLOR,
  SEA_COLOR,
  TERRAIN_FILL_MIX,
  TERRAIN_TINTS,
  hexShade,
  mixColor,
  ownerColor,
  shadeColor,
} from './theme';

/** Inclusive axial-range of hexes that intersect a world-space rect. */
export interface HexRange {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
}

/**
 * Compute the axial range covering a world-space rect, clamped to grid bounds.
 * Pure + allocation-light so it can be unit-tested without PIXI. Returns null
 * when the rect misses the grid entirely (nothing to draw).
 *
 * The four rect corners are converted with `pixelToHex`, then the range is
 * padded by one hex on every side: the pointy-top hex tiling means a corner hex
 * can be up to one cell away from the hex visually under that corner.
 */
export function visibleHexRange(
  grid: Pick<AxialGrid<unknown>, 'width' | 'height'>,
  hexSize: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): HexRange | null {
  const corners: Pixel[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
  ];
  let minQ = Infinity;
  let maxQ = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const corner of corners) {
    const hex = pixelToHex(corner, hexSize);
    if (hex.q < minQ) minQ = hex.q;
    if (hex.q > maxQ) maxQ = hex.q;
    if (hex.r < minR) minR = hex.r;
    if (hex.r > maxR) maxR = hex.r;
  }
  // Pad for the corner-hex offset, then clamp to the grid.
  const clamped: HexRange = {
    minQ: Math.max(0, minQ - 1),
    maxQ: Math.min(grid.width - 1, maxQ + 1),
    minR: Math.max(0, minR - 1),
    maxR: Math.min(grid.height - 1, maxR + 1),
  };
  if (clamped.minQ > clamped.maxQ || clamped.minR > clamped.maxR) return null;
  return clamped;
}

/**
 * A cheap signature of the visible terrain slice: owner + terrain per visible
 * cell. The layer rebuilds its fills only when this signature changes, so a
 * static camera with static ownership costs zero geometry per frame.
 */
export function terrainSignature(
  grid: AxialGrid<HexCell>,
  range: HexRange,
): number {
  let hash = 2166136261;
  const width = grid.width;
  for (let r = range.minR; r <= range.maxR; r++) {
    for (let q = range.minQ; q <= range.maxQ; q++) {
      const cell = grid.cells[r * width + q];
      if (!cell) continue;
      const terrainBits =
        cell.terrain === 'plain'
          ? 0
          : cell.terrain === 'forest'
            ? 1
            : cell.terrain === 'mountain'
              ? 2
              : 3;
      // Fold owner (offset so NEUTRAL_OWNER's -1 is stable) with the terrain bits.
      const packed = ((cell.owner + 2) << 2) | terrainBits;
      hash = ((hash ^ packed) * 16777619) >>> 0;
    }
  }
  return hash;
}

/** Colour a single hex should be filled with (owner × terrain × jitter). */
function hexFillColor(cell: HexCell, q: number, r: number): number {
  const mix = TERRAIN_FILL_MIX[cell.terrain];
  if (mix <= 0) return shadeColor(SEA_COLOR, hexShade(q, r));
  const base = ownerColor(cell.owner);
  const tinted = mixColor(base, TERRAIN_TINTS[cell.terrain], 1 - mix);
  return shadeColor(tinted, hexShade(q, r));
}

/** Stroke colour for a hex: darkened owner, or neutral for unowned land. */
function hexBorderColor(cell: HexCell): number {
  if (cell.owner < 0) return NEUTRAL_BORDER_COLOR;
  return shadeColor(ownerColor(cell.owner), HEX_BORDER_DARKEN);
}

/**
 * Reusable flat point buffer for a hex polygon — six corners × (x, y). Mutated in
 * place each hex so the fill pass allocates nothing per cell.
 */
const HEX_POINTS: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Pointy-top corner angles (30° + 60°·i), precomputed once for the fill pass. */
const INNER_COS: number[] = [];
const INNER_SIN: number[] = [];
for (let i = 0; i < 6; i++) {
  const angle = ((60 * i + 30) * Math.PI) / 180;
  INNER_COS.push(Math.cos(angle));
  INNER_SIN.push(Math.sin(angle));
}

/** Terrain glyph size as a fraction of the hex circumradius. */
const GLYPH_SIZE_RATIO = 0.3;

/**
 * Owner + terrain fill pass and terrain glyph pass. One instance per
 * `Application`; created by `world.ts` and driven by `TerrainLayer.draw`.
 */
export class TerrainLayer {
  /** Parent container holding both passes (added to the stage by world.ts). */
  readonly container: Container;
  private readonly fills: Graphics;
  private readonly glyphs: Graphics;
  private signature = -1;
  private glyphRangeKey = '';

  constructor() {
    this.container = new Container();
    this.fills = new Graphics();
    this.glyphs = new Graphics();
    this.glyphs.eventMode = 'none';
    this.fills.eventMode = 'none';
    this.container.addChild(this.fills, this.glyphs);
  }

  /**
   * Redraw the visible slice for `state` with the given world-space rect. Fills
   * are rebuilt only when the visible owner/terrain slice changes; glyphs only
   * when the range or terrain slice changes. Cheap to call every frame.
   */
  draw(grid: AxialGrid<HexCell>, hexSize: number, range: HexRange | null): void {
    this.fills.clear();
    this.glyphs.clear();
    if (!range) {
      this.signature = -1;
      this.glyphRangeKey = '';
      return;
    }

    const signature = terrainSignature(grid, range);
    const rangeKey = `${range.minQ},${range.minR},${range.maxQ},${range.maxR},${hexSize},${signature}`;
    const redrawFills = signature !== this.signature;
    const redrawGlyphs = rangeKey !== this.glyphRangeKey;

    if (redrawFills) {
      this.signature = signature;
      this.drawFills(grid, hexSize, range);
    }
    if (redrawGlyphs) {
      this.glyphRangeKey = rangeKey;
      this.drawGlyphs(grid, hexSize, range);
    }
  }

  /** Drop cached signatures so the next `draw` rebuilds everything. */
  invalidate(): void {
    this.signature = -1;
    this.glyphRangeKey = '';
  }

  /**
   * Two contiguous passes — all fills, then all borders — so PIXI batches the
   * visible slice into two long geometry runs instead of interleaving fill/stroke
   * per hex (which would double the batch count). Hexes are emitted as
   * pointy-top polygons from a precomputed corner table.
   */
  private drawFills(grid: AxialGrid<HexCell>, hexSize: number, range: HexRange): void {
    const width = grid.width;
    const inner = hexSize * 0.94;
    const cos = INNER_COS;
    const sin = INNER_SIN;
    // Pass 1: fills.
    for (let r = range.minR; r <= range.maxR; r++) {
      for (let q = range.minQ; q <= range.maxQ; q++) {
        const cell = grid.cells[r * width + q];
        if (!cell) continue;
        const cx = hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
        const cy = hexSize * 1.5 * r;
        for (let i = 0; i < 6; i++) {
          HEX_POINTS[i * 2] = cx + cos[i]! * inner;
          HEX_POINTS[i * 2 + 1] = cy + sin[i]! * inner;
        }
        this.fills.poly(HEX_POINTS);
        this.fills.fill({ color: hexFillColor(cell, q, r) });
      }
    }
    // Pass 2: owner borders.
    for (let r = range.minR; r <= range.maxR; r++) {
      for (let q = range.minQ; q <= range.maxQ; q++) {
        const cell = grid.cells[r * width + q];
        if (!cell) continue;
        const cx = hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
        const cy = hexSize * 1.5 * r;
        for (let i = 0; i < 6; i++) {
          HEX_POINTS[i * 2] = cx + cos[i]! * inner;
          HEX_POINTS[i * 2 + 1] = cy + sin[i]! * inner;
        }
        this.fills.poly(HEX_POINTS);
        this.fills.stroke({
          width: HEX_BORDER_WIDTH,
          color: hexBorderColor(cell),
          alpha: cell.owner < 0 ? 0.35 : 0.75,
        });
      }
    }
  }

  /**
   * Terrain detail. Trees and mountain facets are small polygons; water gets a
   * lighter inner rim. Kept to a coarser cadence via the signature cache above.
   */
  private drawGlyphs(grid: AxialGrid<HexCell>, hexSize: number, range: HexRange): void {
    const width = grid.width;
    const g = this.glyphs;
    for (let r = range.minR; r <= range.maxR; r++) {
      for (let q = range.minQ; q <= range.maxQ; q++) {
        const cell = grid.cells[r * width + q];
        if (!cell) continue;
        const terrain = cell.terrain;
        if (terrain === 'plain') continue;
        const center = axialToPixel({ q, r }, hexSize);
        const scale = hexSize * GLYPH_SIZE_RATIO;
        if (terrain === 'water') {
          this.drawWaterRim(g, center, hexSize);
        } else if (terrain === 'forest') {
          this.drawTrees(g, center, scale, q, r);
        } else {
          this.drawMountain(g, center, scale);
        }
      }
    }
  }

  private drawWaterRim(g: Graphics, center: Pixel, hexSize: number): void {
    const corners = hexCorners(center, hexSize * 0.72);
    this.polyFrom(g, corners);
    g.stroke({ width: 1.5, color: mixColor(SEA_COLOR, 0xffffff, 0.28), alpha: 0.5 });
  }

  private drawTrees(g: Graphics, center: Pixel, scale: number, q: number, r: number): void {
    // Three clustered triangles, offsets hashed off (q, r) so clusters vary.
    const jitter = (hexShade(q, r) - 1) * 2;
    const offsets: readonly [number, number][] = [
      [-scale * 0.55, scale * 0.2],
      [scale * 0.5, scale * 0.35],
      [scale * 0.0, -scale * 0.55],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      if (!offset) continue;
      const x = center.x + offset[0] + jitter * (i - 1) * 0.5;
      const y = center.y + offset[1];
      const half = scale * 0.42;
      const height = scale * 0.86;
      g.poly([x, y - height, x - half, y, x + half, y]);
    }
    g.fill({ color: 0x245c33 });
    // Trunks as thin stems under each canopy.
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      if (!offset) continue;
      const x = center.x + offset[0] + jitter * (i - 1) * 0.5;
      const y = center.y + offset[1];
      g.rect(x - 1, y, 2, scale * 0.3);
    }
    g.fill({ color: 0x3c2a1c });
  }

  private drawMountain(g: Graphics, center: Pixel, scale: number): void {
    const half = scale * 1.05;
    const height = scale * 1.35;
    // Two overlapping faceted triangles: lit face + shadow face.
    g.poly([
      center.x - half,
      center.y + height * 0.5,
      center.x,
      center.y - height * 0.5,
      center.x + half,
      center.y + height * 0.5,
    ]);
    g.fill({ color: 0x6b665e });
    g.poly([
      center.x,
      center.y - height * 0.5,
      center.x + half,
      center.y + height * 0.5,
      center.x,
      center.y + height * 0.5,
    ]);
    g.fill({ color: 0x524d46 });
    // Snow cap.
    g.poly([
      center.x - scale * 0.3,
      center.y - height * 0.14,
      center.x,
      center.y - height * 0.5,
      center.x + scale * 0.3,
      center.y - height * 0.14,
    ]);
    g.fill({ color: 0xdfe3e6 });
  }

  private polyFrom(g: Graphics, corners: readonly Pixel[]): void {
    const points: number[] = [];
    for (const corner of corners) points.push(corner.x, corner.y);
    g.poly(points);
  }
}
