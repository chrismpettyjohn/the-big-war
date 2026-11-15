

import { Container, Graphics } from 'pixi.js';
import type { GameState } from '../game/state/state.types';
import { captureSecondsFor } from '../game/unit/unit.service';
import type { OverlayState, SpawnPlot } from './overlay-layer.types';
import { PLOT_BEFORE, START_PLOT } from '../game/state/setup.constants';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { axialToPixel, cornerPoints, ring } from '@the-big-war/game-engine/world-tile/world-tile.service';
import {
  DANGER_COLOR,
  HOVER_COLOR,
  HOVER_WIDTH,
  INFO_COLOR,
  mixColor,
  ownerColor,
  SELECTION_COLOR,
  SELECTION_WIDTH,
} from './theme';

export type * from './overlay-layer.types';


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

  draw(state: OverlayState, hexSize: number, focusHexes: readonly Axial[] = [], now = 0): void {
    const g = this.gfx;
    g.clear();

    if (focusHexes.length > 0) this.drawFocus(g, focusHexes, hexSize, now);

    for (const plot of state.spawnPlots) this.drawSpawnPlot(g, plot, hexSize);

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

  drawCaptures(state: GameState, hexSize: number, now: number): void {
    const g = this.gfx;
    const seen = new Map<number, { empire: number; progress: number }>();
    for (const unit of state.units) {
      if (unit.captureAt < 0) continue;
      const known = seen.get(unit.captureAt);
      if (!known || unit.capture > known.progress) seen.set(unit.captureAt, { empire: unit.empire, progress: unit.capture });
    }
    const pulse = 0.5 + 0.5 * Math.sin(now / 140);
    for (const [at, capture] of seen) {
      const cell = state.grid.cells[at];
      if (!cell) continue;
      const attacker = ownerColor(capture.empire);
      const points = cornerPoints(axialToPixel(cell, hexSize), hexSize * 0.98);
      const filled = Math.min(1, capture.progress / captureSecondsFor(cell));
      g.poly(points);
      g.fill({ color: attacker, alpha: 0.1 + 0.35 * filled });
      g.poly(points);
      g.stroke({ width: CAPTURE_WIDTH, color: mixColor(ownerColor(cell.owner), attacker, pulse), alpha: 0.95 });
    }
  }

  private drawFocus(g: Graphics, hexes: readonly Axial[], hexSize: number, now: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    for (const hex of hexes) g.poly(cornerPoints(axialToPixel(hex, hexSize), hexSize * 0.98));
    g.fill({ color: SELECTION_COLOR, alpha: 0.15 + 0.15 * pulse });
    for (const hex of hexes) g.poly(cornerPoints(axialToPixel(hex, hexSize), hexSize * 0.98));
    g.stroke({ width: SELECTION_WIDTH, color: SELECTION_COLOR, alpha: 0.6 + 0.4 * pulse });
  }

  private drawSpawnPlot(g: Graphics, plot: SpawnPlot, hexSize: number): void {
    const center = axialToPixel(plot.hex, hexSize);
    const left = center.x - hexSize * (PLOT_BEFORE + 0.5);
    const top = center.y - hexSize * (PLOT_BEFORE + 0.5);
    const side = hexSize * START_PLOT;
    g.rect(left, top, side, side);
    g.fill({ color: plot.color, alpha: plot.own ? 0.85 : 0.6 });
    g.rect(left, top, side, side);
    g.stroke({ width: hexSize * (plot.own ? 0.5 : 0.25), color: plot.own ? 0xffffff : plot.color, alpha: 1 });
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
    const points = cornerPoints(center, hexSize * 0.98);
    g.poly(points);
    g.stroke({ width, color, alpha });
  }

  private drawRangeRing(g: Graphics, from: Axial, range: number, hexSize: number): void {
    
    const center = axialToPixel(from, hexSize);
    for (const hex of ring(from, range)) {
      g.poly(cornerPoints(axialToPixel(hex, hexSize), hexSize * 0.9));
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


const CAPTURE_WIDTH = 2;

function sameHex(a: Axial, b: Axial | null): boolean {
  return b !== null && a.q === b.q && a.r === b.r;
}
