import { Container, Text } from 'pixi.js';
import type { GameState } from '../game/state/state.types';
import type { EmpireId } from '../game/empire/empire.types';
import { NEUTRAL_OWNER } from '../game/empire/empire.constants';
import { axialToPixel, gridCoord } from '@the-big-war/game-engine/world-tile/world-tile.service';

const LABEL_ALPHA = 0.28;
const MIN_HEXES = 6;
const FONT_SCALE = 0.12;
const MAX_SPAN = 0.5;

export class NationLabelsLayer {
  readonly container: Container;
  private readonly labels = new Map<EmpireId, Text>();
  private lastTick = -1;

  constructor() {
    this.container = new Container();
    this.container.eventMode = 'none';
  }

  draw(state: GameState, hexSize: number): void {
    if (state.tick === this.lastTick) return;
    this.lastTick = state.tick;

    const sums = new Map<EmpireId, { x: number; y: number; n: number; minX: number; maxX: number; minY: number; maxY: number }>();
    state.grid.cells.forEach((cell, index) => {
      if (cell.owner === NEUTRAL_OWNER) return;
      const p = axialToPixel(gridCoord(state.grid, index), hexSize);
      const s = sums.get(cell.owner) ?? { x: 0, y: 0, n: 0, minX: p.x, maxX: p.x, minY: p.y, maxY: p.y };
      s.x += p.x;
      s.y += p.y;
      s.n += 1;
      s.minX = Math.min(s.minX, p.x);
      s.maxX = Math.max(s.maxX, p.x);
      s.minY = Math.min(s.minY, p.y);
      s.maxY = Math.max(s.maxY, p.y);
      sums.set(cell.owner, s);
    });

    for (const empire of state.empires) {
      const s = sums.get(empire.id);
      let label = this.labels.get(empire.id);
      if (!s || s.n < MIN_HEXES) {
        if (label) label.visible = false;
        continue;
      }
      if (!label) {
        label = new Text({
          text: empire.name.toUpperCase(),
          style: { fontFamily: 'sans-serif', fontWeight: '900', fill: 0xffffff, letterSpacing: 4, align: 'center' },
        });
        label.anchor.set(0.5);
        label.alpha = LABEL_ALPHA;
        this.labels.set(empire.id, label);
        this.container.addChild(label);
      }
      label.visible = true;
      label.scale.set(1);
      label.style.fontSize = Math.max(8, hexSize * FONT_SCALE * Math.sqrt(s.n));
      const spanW = (s.maxX - s.minX + hexSize) * MAX_SPAN;
      const spanH = (s.maxY - s.minY + hexSize) * MAX_SPAN;
      label.scale.set(Math.min(1, spanW / label.width, spanH / label.height));
      label.position.set((s.minX + s.maxX) / 2, (s.minY + s.maxY) / 2);
    }
  }
}
