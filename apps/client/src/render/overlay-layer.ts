

import { Container, Graphics } from 'pixi.js';
import type { OverlayState } from './overlay-layer.types';
import type { EmpireId } from '../game/empire/empire.types';
import type { Front, FrontSide } from '../game/front/front.types';
import type { Axial, Pixel } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { axialToPixel, distance, hexCorners, ring } from '@the-big-war/game-engine/world-tile/world-tile.service';
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

export type * from './overlay-layer.types';

const BADGE_HALF = 0.62; 
const BADGE_MAX_TROOPS = 120; 

export class OverlayLayer {
  
  readonly container: Container;
  private readonly gfx: Graphics;

  constructor() {
    this.container = new Container();
    this.gfx = new Graphics();
    this.gfx.eventMode = 'none';
    this.container.eventMode = 'none';
    this.container.addChild(this.gfx);
  }

  draw(state: OverlayState, hexSize: number): void {
    const g = this.gfx;
    g.clear();

    for (const front of state.fronts) this.drawFrontBadge(g, front, hexSize);

    if (state.selected) this.drawOutline(g, state.selected, hexSize, SELECTION_COLOR, SELECTION_WIDTH, 1);
    if (state.hovered && !sameHex(state.hovered, state.selected)) {
      this.drawOutline(g, state.hovered, hexSize, HOVER_COLOR, HOVER_WIDTH, 0.6);
    }

    if (state.ghost && !state.ghost.valid) {
      this.drawOutline(g, state.ghost.hex, hexSize, DANGER_COLOR, HOVER_WIDTH, 0.8);
    }

    if (state.cannonFrom) {
      this.drawRangeRing(g, state.cannonFrom, state.cannonRange, hexSize);
      if (state.cannonTarget) this.drawReticle(g, state.cannonTarget, hexSize);
    }
  }

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

  private drawFrontBadge(g: Graphics, front: Front, hexSize: number): void {
    const a = axialToPixel(front.hexA, hexSize);
    const b = axialToPixel(front.hexB, hexSize);
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;
    
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const reach = hexSize * BADGE_HALF;
    const thickness = Math.max(2.5, hexSize * 0.12);

    drawSideBar(g, midX, midY, nx, ny, reach, front.sideA, thickness);
    drawSideBar(g, midX, midY, -nx, -ny, reach, front.sideB, thickness);

    g.circle(midX, midY, thickness * 0.6);
    g.fill({ color: ACCENT_COLOR, alpha: 0.9 });
  }

  private drawRangeRing(g: Graphics, from: Axial, range: number, hexSize: number): void {
    
    const center = axialToPixel(from, hexSize);
    for (const hex of ring(from, range)) {
      g.poly(hexPolygon(axialToPixel(hex, hexSize), hexSize * 0.9));
    }
    g.stroke({ width: 1.5, color: INFO_COLOR, alpha: 0.35 });
    g.circle(center.x, center.y, 3);
    g.fill({ color: INFO_COLOR, alpha: 0.9 });
  }

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

function hexPolygon(center: Pixel, size: number): number[] {
  return hexCorners(center, size).flatMap(corner => [corner.x, corner.y]);
}

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
  
  g.moveTo(midX, midY);
  g.lineTo(ex, ey);
  g.stroke({ width: thickness, color, alpha: 0.95 });
  
  g.circle(ex, ey, thickness * 0.65);
  g.fill({ color, alpha: 0.95 });
  
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

function sameHex(a: Axial, b: Axial | null): boolean {
  return b !== null && a.q === b.q && a.r === b.r;
}

export function inCannonRange(from: Axial, target: Axial, range: number): boolean {
  return distance(from, target) <= range;
}

export function frontEmpires(front: Front): readonly EmpireId[] {
  return [front.sideA.empire, front.sideB.empire];
}
