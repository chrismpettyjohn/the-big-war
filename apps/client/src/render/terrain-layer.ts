

import { Container, Graphics } from 'pixi.js';
import type { HexCell } from '../game/map/map.types';
import type { BuildingKind } from '../game/building/building.types';
import type { Pixel } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { DIRECTIONS } from '@the-big-war/game-engine/world-tile/world-tile.constants';
import type { AxialGrid } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { axialToPixel, gridAt, pixelToHex } from '@the-big-war/game-engine/world-tile/world-tile.service';
import {
  HEX_BORDER_DARKEN,
  HEX_BORDER_WIDTH,
  NEUTRAL_BORDER_COLOR,
  PAVE_CURB,
  PAVE_MORTAR,
  PAVE_OWNER_TINT,
  PAVE_STONES,
  PAVE_STREET,
  SEA_COLOR,
  TERRAIN_FILL_MIX,
  TERRAIN_TINTS,
  hexShade,
  mixColor,
  ownerColor,
  shadeColor,
} from './theme';

export interface HexRange {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
}

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
  
  const clamped: HexRange = {
    minQ: Math.max(0, minQ - 1),
    maxQ: Math.min(grid.width - 1, maxQ + 1),
    minR: Math.max(0, minR - 1),
    maxR: Math.min(grid.height - 1, maxR + 1),
  };
  if (clamped.minQ > clamped.maxQ || clamped.minR > clamped.maxR) return null;
  return clamped;
}

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
      
      const packed = ((cell.owner + 2) << 3) | (isPaved(cell) ? 4 : 0) | terrainBits;
      hash = ((hash ^ packed) * 16777619) >>> 0;
    }
  }
  return hash;
}

const UNPAVED: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['trench', 'tank']);

function isPaved(cell: HexCell | undefined): boolean {
  return !!cell?.building && !UNPAVED.has(cell.building.kind);
}

function stoneHash(q: number, r: number, row: number, col: number): number {
  let h = (q * 73856093) ^ (r * 19349663) ^ (row * 83492791) ^ (col * 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % PAVE_STONES.length;
}

function hexFillColor(cell: HexCell): number {
  const mix = TERRAIN_FILL_MIX[cell.terrain];
  if (mix <= 0) return SEA_COLOR;
  const base = ownerColor(cell.owner);
  return mixColor(base, TERRAIN_TINTS[cell.terrain], 1 - mix);
}

function hexBorderColor(cell: HexCell): number {
  if (cell.owner < 0) return NEUTRAL_BORDER_COLOR;
  return shadeColor(ownerColor(cell.owner), HEX_BORDER_DARKEN);
}

const GLYPH_SIZE_RATIO = 0.3;

export class TerrainLayer {
  
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

  draw(grid: AxialGrid<HexCell>, hexSize: number, range: HexRange | null): void {
    if (!range) {
      this.fills.clear();
      this.glyphs.clear();
      this.signature = -1;
      this.glyphRangeKey = '';
      return;
    }

    const signature = terrainSignature(grid, range);
    const rangeKey = `${range.minQ},${range.minR},${range.maxQ},${range.maxR},${hexSize},${signature}`;
    const redrawFills = signature !== this.signature;
    const redrawGlyphs = rangeKey !== this.glyphRangeKey;

    if (redrawFills) {
      this.fills.clear();
      this.signature = signature;
      this.drawFills(grid, hexSize, range);
    }
    if (redrawGlyphs) {
      this.glyphs.clear();
      this.glyphRangeKey = rangeKey;
      this.drawGlyphs(grid, hexSize, range);
    }
  }

  invalidate(): void {
    this.signature = -1;
    this.glyphRangeKey = '';
  }

  private drawFills(grid: AxialGrid<HexCell>, hexSize: number, range: HexRange): void {
    const width = grid.width;
    const owners = (q: number, r: number): number | null =>
      q < 0 || r < 0 || q >= width || r >= grid.height ? null : (grid.cells[r * width + q]?.owner ?? null);

    for (let r = range.minR; r <= range.maxR; r++) {
      for (let q = range.minQ; q <= range.maxQ; q++) {
        const cell = grid.cells[r * width + q];
        if (!cell) continue;
        this.fills.rect(q * hexSize, r * hexSize, hexSize, hexSize);
        this.fills.fill({ color: hexFillColor(cell) });
      }
    }

    for (let r = range.minR; r <= range.maxR; r++) {
      for (let q = range.minQ; q <= range.maxQ; q++) {
        const cell = grid.cells[r * width + q];
        if (cell && isPaved(cell)) this.drawPavement(grid, cell, hexSize);
      }
    }

    for (let r = range.minR; r <= range.maxR; r++) {
      for (let q = range.minQ; q <= range.maxQ; q++) {
        const cell = grid.cells[r * width + q];
        if (!cell || cell.owner < 0) continue;
        const x = q * hexSize;
        const y = r * hexSize;
        for (const dir of DIRECTIONS) {
          if (owners(q + dir.q, r + dir.r) === cell.owner) continue;
          const x0 = dir.q === 1 ? x + hexSize : x;
          const y0 = dir.r === 1 ? y + hexSize : y;
          const x1 = dir.q === 0 ? x + hexSize : x0;
          const y1 = dir.r === 0 ? y + hexSize : y0;
          this.fills.moveTo(x0, y0);
          this.fills.lineTo(x1, y1);
        }
        this.fills.stroke({ width: HEX_BORDER_WIDTH, color: hexBorderColor(cell), alpha: 1 });
      }
    }
  }

  private drawPavement(grid: AxialGrid<HexCell>, cell: HexCell, hexSize: number): void {
    const g = this.fills;
    const { q, r } = cell;
    const x = q * hexSize;
    const y = r * hexSize;
    const unit = hexSize / 16;
    const tint = (color: number) => (cell.owner >= 0 ? mixColor(color, ownerColor(cell.owner), PAVE_OWNER_TINT) : color);

    g.rect(x, y, hexSize, hexSize);
    g.fill({ color: tint(PAVE_MORTAR) });
    PAVE_STONES.forEach((stone, shade) => {
      for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 1 ? -2.5 : 0;
        for (let col = 0, left = offset; left < 16; col++, left += 5) {
          if (stoneHash(q, r, row, col) !== shade) continue;
          const from = Math.max(0, left) + 0.5;
          const to = Math.min(16, left + 5) - 0.5;
          if (to <= from) continue;
          g.rect(x + from * unit, y + (row * 4 + 0.5) * unit, (to - from) * unit, 3 * unit);
        }
      }
      g.fill({ color: tint(stone) });
    });

    const links = DIRECTIONS.filter(dir => isPaved(gridAt(grid, { q: q + dir.q, r: r + dir.r })));
    if (links.length === 0) return;
    const cx = x + hexSize / 2;
    const cy = y + hexSize / 2;
    const street = (pad: number) => {
      const half = 2 * unit + pad;
      g.rect(cx - half, cy - half, half * 2, half * 2);
      for (const dir of links) {
        if (dir.q !== 0) g.rect(dir.q > 0 ? cx : x, cy - half, hexSize / 2, half * 2);
        else g.rect(cx - half, dir.r > 0 ? cy : y, half * 2, hexSize / 2);
      }
    };
    street(unit * 0.75);
    g.fill({ color: tint(PAVE_CURB) });
    street(0);
    g.fill({ color: tint(PAVE_STREET) });
  }

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
        if (terrain === 'forest') {
          this.drawTrees(g, center, scale, q, r);
        } else if (terrain === 'ore') {
          this.drawOre(g, center, scale);
        } else {
          this.drawMountain(g, center, scale);
        }
      }
    }
  }

  private drawTrees(g: Graphics, center: Pixel, scale: number, q: number, r: number): void {
    
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
    
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      if (!offset) continue;
      const x = center.x + offset[0] + jitter * (i - 1) * 0.5;
      const y = center.y + offset[1];
      g.rect(x - 1, y, 2, scale * 0.3);
    }
    g.fill({ color: 0x3c2a1c });
  }

  private drawOre(g: Graphics, center: Pixel, scale: number): void {
    const rocks: readonly [number, number, number][] = [
      [-0.5, 0.25, 0.55],
      [0.45, 0.3, 0.5],
      [0.0, -0.35, 0.6],
    ];
    for (const [dx, dy, size] of rocks) {
      const x = center.x + dx * scale;
      const y = center.y + dy * scale;
      const half = size * scale;
      g.poly([x - half, y + half * 0.6, x - half * 0.5, y - half * 0.6, x + half * 0.6, y - half * 0.5, x + half, y + half * 0.6]);
    }
    g.fill({ color: 0x3a3530 });
    for (const [dx, dy, size] of rocks) {
      const x = center.x + dx * scale;
      const y = center.y + dy * scale;
      const fleck = Math.max(1.5, size * scale * 0.35);
      g.rect(x - fleck, y - fleck * 0.5, fleck, fleck);
      g.rect(x + fleck * 0.4, y + fleck * 0.3, fleck * 0.8, fleck * 0.8);
    }
    g.fill({ color: 0xf2c94c });
  }

  private drawMountain(g: Graphics, center: Pixel, scale: number): void {
    const half = scale * 1.05;
    const height = scale * 1.35;
    
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
}
