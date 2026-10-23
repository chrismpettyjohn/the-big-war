/**
 * Buildings layer — procedural vector glyphs, one pooled `Graphics` per building.
 *
 * Each visible building gets a `Graphics` object keyed by `Building.id`. The
 * glyph is redrawn only when the building's identity, level, kind, or
 * `demolishAt` changes; position-only changes (camera pan/zoom) just move the
 * pooled object, so panning a dense map costs nothing but a matrix update.
 *
 * No image assets: every glyph is drawn from primitives, so the look matches the
 * flat/vector kit and nothing has to be loaded. `demolishAt` non-null switches
 * the glyph to a dimmed, pulsing form (driven by `GameState.elapsed`).
 */

import { Container, Graphics } from 'pixi.js';
import type { Building, BuildingKind, BuildingId, HexCell } from '../game/types';
import type { AxialGrid } from '../game/hex';
import { axialToPixel } from '../game/hex';
import { DEMOLISH_DIM } from './theme';
import type { HexRange } from './terrainLayer';

/** Per-building cached visual key; a change forces a glyph redraw. */
interface GlyphEntry {
  readonly object: Graphics;
  id: BuildingId;
  kind: BuildingKind;
  level: number;
  demolishAt: number | null;
  demolishing: boolean;
}

/** Stable per-building colour accents (independent of owner colour for legibility). */
const KIND_COLORS: Readonly<Record<BuildingKind, number>> = {
  city: 0xe8e0cc,
  market: 0xf0c850,
  lumberjack: 0x8a5a34,
  miner: 0x9aa0a6,
  farm: 0x8fc45a,
  lab: 0x7fb2e5,
  barracks: 0xc0503c,
  fort: 0x8b8b8b,
  cannon: 0x4a4a4a,
};

/** Wall/roof outline colour shared by all glyphs. */
const GLYPH_STROKE = 0x111111;

/**
 * Buildings layer. One pooled `Graphics` per visible building, keyed by
 * `Building.id`, so a demolish-and-replace reuses the freed slot cleanly.
 */
export class BuildingsLayer {
  /** Parent container (added to the stage by world.ts). */
  readonly container: Container;
  private readonly entries = new Map<BuildingId, GlyphEntry>();
  private readonly free: Graphics[] = [];
  private elapsed = 0;

  constructor() {
    this.container = new Container();
    this.container.eventMode = 'none';
  }

  /**
   * Sync visible building glyphs for the given grid slice. `elapsed` is game
   * time, used only for the demolition pulse. Allocation-free when nothing
   * changed beyond camera position.
   */
  draw(grid: AxialGrid<HexCell>, hexSize: number, range: HexRange | null, elapsed: number): void {
    this.elapsed = elapsed;
    if (!range) {
      this.releaseAll();
      return;
    }
    const width = grid.width;
    const seen = new Set<BuildingId>();
    for (let r = range.minR; r <= range.maxR; r++) {
      for (let q = range.minQ; q <= range.maxQ; q++) {
        const cell = grid.cells[r * width + q];
        const building = cell?.building ?? null;
        if (!building) continue;
        seen.add(building.id);
        const entry = this.acquire(building);
        const center = axialToPixel({ q, r }, hexSize);
        entry.object.position.set(center.x, center.y);
        const demolishing = building.demolishAt !== null;
        const levelChanged = entry.level !== building.level;
        const kindChanged = entry.kind !== building.kind;
        const demolishChanged = entry.demolishAt !== building.demolishAt;
        if (levelChanged || kindChanged || demolishChanged || entry.id !== building.id) {
          entry.id = building.id;
          entry.kind = building.kind;
          entry.level = building.level;
          entry.demolishAt = building.demolishAt;
          entry.demolishing = demolishing;
          this.redraw(entry, hexSize);
        }
        // Pulse alpha only while demolishing; otherwise the glyph is static.
        entry.object.alpha = demolishing ? this.demolishAlpha() : 1;
      }
    }
    // Release glyphs for buildings no longer visible (kept in the pool for reuse).
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      this.release(id, entry);
    }
  }

  /** Drop every pooled glyph (e.g. on match reset). */
  reset(): void {
    this.releaseAll();
  }

  /** Free any pooled glyphs whose buildings are no longer in the grid. */
  private releaseAll(): void {
    for (const [id, entry] of this.entries) this.release(id, entry);
  }

  private release(id: BuildingId, entry: GlyphEntry): void {
    this.container.removeChild(entry.object);
    entry.demolishing = false;
    this.free.push(entry.object);
    this.entries.delete(id);
  }

  private acquire(building: Building): GlyphEntry {
    const existing = this.entries.get(building.id);
    if (existing) return existing;
    const object = this.free.pop() ?? new Graphics();
    object.eventMode = 'none';
    this.container.addChild(object);
    const entry: GlyphEntry = {
      object,
      id: building.id,
      kind: building.kind,
      level: building.level,
      demolishAt: building.demolishAt,
      demolishing: building.demolishAt !== null,
    };
    this.entries.set(building.id, entry);
    return entry;
  }

  /** 0.4 .. 1 alpha sine pulse, period ~1.2 s, from game time. */
  private demolishAlpha(): number {
    const phase = Math.sin((this.elapsed / 1.2) * Math.PI * 2);
    return DEMOLISH_DIM + (1 - DEMOLISH_DIM) * (0.5 + phase * 0.35);
  }

  private redraw(entry: GlyphEntry, hexSize: number): void {
    const g = entry.object;
    g.clear();
    const scale = hexSize * 0.62;
    switch (entry.kind) {
      case 'city':
        this.drawCity(g, scale, entry.level);
        break;
      case 'market':
        this.drawMarket(g, scale);
        break;
      case 'lumberjack':
        this.drawLumberjack(g, scale);
        break;
      case 'miner':
        this.drawMiner(g, scale);
        break;
      case 'farm':
        this.drawFarm(g, scale);
        break;
      case 'lab':
        this.drawLab(g, scale);
        break;
      case 'barracks':
        this.drawBarracks(g, scale);
        break;
      case 'fort':
        this.drawFort(g, scale);
        break;
      case 'cannon':
        this.drawCannon(g, scale);
        break;
    }
  }

  /* ------------------------------------------------------------- glyphs ---- */
  // All glyphs draw in local space centred on (0, 0); world position is set on
  // the pooled object. Small helper for a filled + outlined polygon.

  private poly(g: Graphics, points: number[], color: number): void {
    g.poly(points);
    g.fill({ color });
    g.stroke({ width: 1.5, color: GLYPH_STROKE, alpha: 0.8 });
  }

  private drawCity(g: Graphics, s: number, level: number): void {
    // A keep; extra towers per level (1..3).
    const w = s * 0.9;
    const h = s * 0.9;
    this.poly(g, [-w, h, w, h, w, -h * 0.2, 0, -h, -w, -h * 0.2], KIND_COLORS.city);
    for (let i = 0; i < Math.min(3, level); i++) {
      const x = -w * 0.7 + i * w * 0.7;
      this.poly(g, [x - s * 0.16, -h * 0.2, x + s * 0.16, -h * 0.2, x, -h * 0.7], 0xcfc7b3);
    }
    // Banner marking the capital.
    g.rect(-1, -h * 1.35, 2, h * 0.4);
    g.fill({ color: GLYPH_STROKE });
  }

  private drawMarket(g: Graphics, s: number): void {
    // Awning: alternating stripes over a stall.
    const w = s * 1.0;
    this.poly(g, [-w, 0, w, 0, w, s * 0.7, -w, s * 0.7], 0x6b5636);
    for (let i = 0; i < 4; i++) {
      const x0 = -w + (i * (w * 2)) / 4;
      const x1 = x0 + (w * 2) / 4;
      this.poly(g, [x0, -s * 0.35, x1, -s * 0.35, x1, 0, x0, 0], i % 2 === 0 ? KIND_COLORS.market : 0xe8e0cc);
    }
    g.rect(-2, 0, 4, s * 0.7);
    g.fill({ color: GLYPH_STROKE });
  }

  private drawLumberjack(g: Graphics, s: number): void {
    // Two crossed logs + an axe head.
    this.poly(g, [-s, s * 0.4, s, s * 0.4, s, s * 0.7, -s, s * 0.7], 0x6b4a2a);
    this.poly(g, [-s * 0.7, -s * 0.3, 0, s * 0.3, -s * 0.3, s * 0.3], KIND_COLORS.lumberjack);
    this.poly(g, [s * 0.1, -s * 0.6, s * 0.8, -s * 0.2, s * 0.1, s * 0.1], 0xb0b6bb);
  }

  private drawMiner(g: Graphics, s: number): void {
    // Pick over a rock mound.
    this.poly(g, [-s, s * 0.6, 0, -s * 0.1, s, s * 0.6], 0x6f6a62);
    g.moveTo(-s * 0.8, -s * 0.7);
    g.lineTo(s * 0.8, s * 0.1);
    g.stroke({ width: 2.5, color: 0x8a5a34 });
    this.poly(g, [-s * 0.95, -s * 0.95, -s * 0.45, -s * 0.75, -s * 0.75, -s * 0.4], KIND_COLORS.miner);
  }

  private drawFarm(g: Graphics, s: number): void {
    // Field rows + a small barn.
    this.poly(g, [-s, s * 0.2, s, s * 0.2, s, s * 0.9, -s, s * 0.9], 0x4c7a2e);
    for (let i = 0; i < 3; i++) {
      const y = s * (0.3 + i * 0.2);
      g.rect(-s * 0.9, y, s * 1.8, 1.5);
    }
    g.fill({ color: 0x76a844 });
    this.poly(g, [-s * 0.7, -s * 0.2, 0, -s * 0.8, s * 0.7, -s * 0.2], 0xa8503c);
    g.rect(-s * 0.5, -s * 0.2, s, s * 0.4);
    g.fill({ color: 0xd8c9a0 });
  }

  private drawLab(g: Graphics, s: number): void {
    // Flask silhouette.
    this.poly(g, [-s * 0.25, -s * 0.8, s * 0.25, -s * 0.8, s * 0.25, -s * 0.2, s * 0.7, s * 0.7, -s * 0.7, s * 0.7, -s * 0.25, -s * 0.2], 0xdfe6ec);
    this.poly(g, [-s * 0.55, s * 0.3, s * 0.55, s * 0.3, s * 0.7, s * 0.7, -s * 0.7, s * 0.7], KIND_COLORS.lab);
    g.circle(0, -s * 0.45, s * 0.16);
    g.fill({ color: 0x5db6e5 });
  }

  private drawBarracks(g: Graphics, s: number): void {
    // Rectangle with a peaked roof and a crossed-swords mark.
    this.poly(g, [-s, -s * 0.1, s, -s * 0.1, s, s * 0.7, -s, s * 0.7], 0x8f8779);
    this.poly(g, [-s * 1.1, -s * 0.1, 0, -s * 0.9, s * 1.1, -s * 0.1], KIND_COLORS.barracks);
    g.moveTo(-s * 0.4, s * 0.5);
    g.lineTo(s * 0.4, s * 0.1);
    g.moveTo(s * 0.4, s * 0.5);
    g.lineTo(-s * 0.4, s * 0.1);
    g.stroke({ width: 2, color: 0x2a2a2a });
  }

  private drawFort(g: Graphics, s: number): void {
    // Bastion: crenellated wall band with a star outline.
    this.poly(g, [-s, s * 0.2, s, s * 0.2, s, s * 0.8, -s, s * 0.8], 0x6f6a62);
    for (let i = 0; i < 3; i++) {
      const x = -s + i * s;
      g.rect(x, -s * 0.05, s * 0.5, s * 0.3);
    }
    g.fill({ color: KIND_COLORS.fort });
    const star: number[] = [];
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? s * 0.8 : s * 0.34;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      star.push(Math.cos(angle) * radius, Math.sin(angle) * radius - s * 0.3);
    }
    g.poly(star);
    g.fill({ color: 0xb8b8b8 });
    g.stroke({ width: 1, color: GLYPH_STROKE });
  }

  private drawCannon(g: Graphics, s: number): void {
    // Barrel on a wheeled carriage.
    g.rect(-s * 0.8, s * 0.25, s * 1.6, s * 0.35);
    g.fill({ color: 0x8a5a34 });
    g.circle(-s * 0.5, s * 0.65, s * 0.2);
    g.circle(s * 0.5, s * 0.65, s * 0.2);
    g.fill({ color: 0x3a3a3a });
    // Barrel pointing up-right.
    g.moveTo(-s * 0.6, s * 0.25);
    g.lineTo(s * 0.5, -s * 0.6);
    g.lineTo(s * 0.9, -s * 0.2);
    g.lineTo(-s * 0.2, s * 0.55);
    g.closePath();
    g.fill({ color: KIND_COLORS.cannon });
    g.stroke({ width: 1.5, color: GLYPH_STROKE, alpha: 0.8 });
  }
}
