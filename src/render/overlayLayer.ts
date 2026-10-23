/**
 * Overlay layer — selection, hover, front badges, and cannon targeting.
 *
 * Everything here is vector-only: no PIXI `Text` (all textual UI is Solid, per
 * ARCHITECTURE §5). Front badges are bisected bars whose length encodes the two
 * sides' committed troops and whose chevrons encode each side's resolved
 * modifiers. The cannon overlay draws a hex-shaped range ring plus an aim reticle.
 *
 * The layer is fully cleared and redrawn each frame it is given data; the cost is
 * bounded by (1 selection + 1 hover + incident fronts + cannon ring), not by the
 * map size, so it is cheap even on a 3000-hex map.
 */

import { Container, Graphics } from 'pixi.js';
import { axialToPixel, distance } from '../game/hex';
import type { Axial, Pixel } from '../game/hex';
import type { EmpireId, Front, FrontSide } from '../game/types';
import {
  ACCENT_COLOR,
  DANGER_COLOR,
  HOVER_COLOR,
  HOVER_WIDTH,
  INFO_COLOR,
  SELECTION_COLOR,
  SELECTION_WIDTH,
  ownerColor,
} from './theme';

/** Overlay inputs for one frame. All optional; omitted fields draw nothing. */
export interface OverlayState {
  /** Selected hex (empire-owned or not). */
  selected: Axial | null;
  /** Hovered hex; drawn only when different from `selected`. */
  hovered: Axial | null;
  /** Fronts to badge (world.ts passes the visible subset). */
  fronts: readonly Front[];
  /** Cannon source hex (ring centre). Null hides the ring + reticle. */
  cannonFrom: Axial | null;
  /** Cannon range in hexes. */
  cannonRange: number;
  /** Aim target hex for the reticle, or null before a target is chosen. */
  cannonTarget: Axial | null;
}

const BADGE_HALF = 0.62; // Fraction of hex size the troop bar extends either side.
const BADGE_MAX_TROOPS = 120; // Troop count that saturates a badge bar.

/**
 * Overlay layer. Stateless between frames — `draw` clears and rebuilds, and the
 * data set is small enough that caching would add complexity for no gain.
 */
export class OverlayLayer {
  /** Parent container (added to the stage by world.ts). */
  readonly container: Container;
  private readonly gfx: Graphics;

  constructor() {
    this.container = new Container();
    this.gfx = new Graphics();
    this.gfx.eventMode = 'none';
    this.container.eventMode = 'none';
    this.container.addChild(this.gfx);
  }

  /** Redraw the overlay for `state` at the given hex scale. */
  draw(state: OverlayState, hexSize: number): void {
    const g = this.gfx;
    g.clear();

    for (const front of state.fronts) this.drawFrontBadge(g, front, hexSize);

    if (state.selected) this.drawOutline(g, state.selected, hexSize, SELECTION_COLOR, SELECTION_WIDTH, 1);
    if (state.hovered && !sameHex(state.hovered, state.selected)) {
      this.drawOutline(g, state.hovered, hexSize, HOVER_COLOR, HOVER_WIDTH, 0.6);
    }

    if (state.cannonFrom) {
      this.drawRangeRing(g, state.cannonFrom, state.cannonRange, hexSize);
      if (state.cannonTarget) this.drawReticle(g, state.cannonTarget, hexSize);
    }
  }

  /** A hex outline (slightly oversized so it sits on top of the fill border). */
  private drawOutline(
    g: Graphics,
    hex: Axial,
    hexSize: number,
    color: number,
    width: number,
    alpha: number,
  ): void {
    const center = axialToPixel(hex, hexSize);
    const points = hexPolygon(center, hexSize * 0.98);
    g.poly(points);
    g.stroke({ width, color, alpha });
  }

  /**
   * Two-sided front badge across the shared edge: a bar from the midpoint toward
   * each side, coloured by that side's empire and scaled by committed troops, with
   * small chevrons sized from each side's resolved attack/defence modifiers.
   */
  private drawFrontBadge(g: Graphics, front: Front, hexSize: number): void {
    const a = axialToPixel(front.hexA, hexSize);
    const b = axialToPixel(front.hexB, hexSize);
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;
    // Edge normal: perpendicular to A→B, used to lay the bar across the border.
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const reach = hexSize * BADGE_HALF;
    const thickness = Math.max(2.5, hexSize * 0.12);

    drawSideBar(g, midX, midY, nx, ny, reach, front.sideA, thickness);
    drawSideBar(g, midX, midY, -nx, -ny, reach, front.sideB, thickness);

    // Contested marker dot in the middle.
    g.circle(midX, midY, thickness * 0.6);
    g.fill({ color: ACCENT_COLOR, alpha: 0.9 });
  }

  /**
   * Hex-shaped range ring: outline every hex at exactly `range` distance from the
   * cannon, giving a footprint that reads correctly against the pointy-top tiling.
   */
  private drawRangeRing(g: Graphics, from: Axial, range: number, hexSize: number): void {
    // Centre dot + a soft filled disk at low alpha for readability.
    const center = axialToPixel(from, hexSize);
    for (let r = 0; r <= range; r++) {
      for (let q = -range; q <= range; q++) {
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) !== range) continue;
        const hex = { q: from.q + q, r: from.r + r };
        const c = axialToPixel(hex, hexSize);
        g.poly(hexPolygon(c, hexSize * 0.94));
      }
    }
    g.stroke({ width: 1.5, color: INFO_COLOR, alpha: 0.35 });
    g.circle(center.x, center.y, 3);
    g.fill({ color: INFO_COLOR, alpha: 0.9 });
  }

  /** Crosshair reticle on the aim target, red when the target is in range. */
  private drawReticle(g: Graphics, target: Axial, hexSize: number): void {
    const center = axialToPixel(target, hexSize);
    const outer = hexSize * 0.85;
    const inner = hexSize * 0.4;
    g.moveTo(center.x - outer, center.y);
    g.lineTo(center.x - inner, center.y);
    g.moveTo(center.x + inner, center.y);
    g.lineTo(center.x + outer, center.y);
    g.moveTo(center.x, center.y - outer);
    g.lineTo(center.x, center.y - inner);
    g.moveTo(center.x, center.y + inner);
    g.lineTo(center.x, center.y + outer);
    g.stroke({ width: 2, color: DANGER_COLOR, alpha: 0.95 });
    g.circle(center.x, center.y, inner);
    g.stroke({ width: 1.5, color: DANGER_COLOR, alpha: 0.8 });
  }
}

/** Build a point array for a hex centred on `center`. Allocates; overlay-only. */
function hexPolygon(center: Pixel, size: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i + 30) * Math.PI) / 180;
    points.push(center.x + size * Math.cos(angle), center.y + size * Math.sin(angle));
  }
  return points;
}

/** Draw one side's troop bar + modifier chevrons from the edge midpoint. */
function drawSideBar(
  g: Graphics,
  midX: number,
  midY: number,
  dirX: number,
  dirY: number,
  reach: number,
  side: FrontSide,
  thickness: number,
): void {
  const strength = clamp01(side.troops / BADGE_MAX_TROOPS);
  const barLen = reach * (0.35 + 0.65 * strength);
  const ex = midX + dirX * barLen;
  const ey = midY + dirY * barLen;
  const color = ownerColor(side.empire);
  // Troop bar.
  g.moveTo(midX, midY);
  g.lineTo(ex, ey);
  g.stroke({ width: thickness, color, alpha: 0.95 });
  // End pip.
  g.circle(ex, ey, thickness * 0.65);
  g.fill({ color, alpha: 0.95 });
  // Mode + modifier chevrons: more = stronger resolved attack/defence.
  const modifierStrength = clamp01((side.modifiers.attack + side.modifiers.defence) / 2 - 0.85);
  const chevrons = Math.round(modifierStrength * 3);
  for (let i = 0; i < chevrons; i++) {
    const t = 0.35 + i * 0.2;
    const px = midX + dirX * barLen * t;
    const py = midY + dirY * barLen * t;
    const sideX = -dirY;
    const sideY = dirX;
    const size = thickness * 0.5;
    g.moveTo(px + sideX * size, py + sideY * size);
    g.lineTo(px + dirX * size, py + dirY * size);
    g.lineTo(px - sideX * size, py - sideY * size);
  }
  if (chevrons > 0) g.stroke({ width: 1.2, color: 0xffffff, alpha: 0.85 });
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** True when two axial coords are the same hex. */
function sameHex(a: Axial, b: Axial | null): boolean {
  return b !== null && a.q === b.q && a.r === b.r;
}

/** True when `target` is within `range` hexes of `from`. Pure; reused by session. */
export function inCannonRange(from: Axial, target: Axial, range: number): boolean {
  return distance(from, target) <= range;
}

/** Convenience: the empire ids present on a front, in A/B order. */
export function frontEmpires(front: Front): readonly EmpireId[] {
  return [front.sideA.empire, front.sideB.empire];
}
