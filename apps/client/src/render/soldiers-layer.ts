import { ownerColor } from './theme';
import type { SoldierFrame } from './pixel-sprites';
import { Container, Sprite, Text, Texture } from 'pixi.js';
import type { Front, FrontSide } from '../game/front/front.types';
import { columnLegDuration } from '../game/simulation/systems/columns.system';
import type { Column, Expedition, GameState } from '../game/state/state.types';
import { SOLDIER_SIZE, SOLDIER_SPRITES, SPRITE_PALETTE } from './pixel-sprites';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { axialToPixel } from '@the-big-war/game-engine/world-tile/world-tile.service';

const MAX_SOLDIERS_PER_SIDE = 30;
const SOLDIER_SCALE = 0.32;
const ATTACK_CYCLE = 0.6;
const MARCH_CYCLE = 0.5;
const LUNGE = 0.12;
const MAX_COLUMN_SOLDIERS = 12;
const COUNT_SIZE = 0.34;
const GATHERER_SCALE = 0.26;
const GATHERER_COLOR = 0x8a5a2b;

export class SoldiersLayer {

  readonly container: Container;
  private readonly textures = new Map<string, Texture>();
  private readonly pool: Sprite[] = [];
  private used = 0;
  private readonly labels: Text[] = [];
  private labelsUsed = 0;

  constructor() {
    this.container = new Container();
    this.container.eventMode = 'none';
  }

  draw(state: GameState, hexSize: number): void {
    const { fronts, expeditions, elapsed } = state;
    this.used = 0;
    this.labelsUsed = 0;
    for (const front of fronts) {
      this.drawSide(front, front.sideA, front.hexA, front.hexB, hexSize, elapsed);
      this.drawSide(front, front.sideB, front.hexB, front.hexA, hexSize, elapsed);
    }
    for (const expedition of expeditions) this.drawSquads(expedition, hexSize, elapsed);
    for (const column of state.columns) this.drawColumn(state, column, hexSize, elapsed);
    this.drawGatherers(state, hexSize, elapsed);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.visible = false;
    for (let i = this.labelsUsed; i < this.labels.length; i++) this.labels[i]!.visible = false;
  }

  reset(): void {
    for (const sprite of this.pool) sprite.destroy();
    this.pool.length = 0;
    for (const label of this.labels) label.destroy();
    this.labels.length = 0;
    this.labelsUsed = 0;
    this.used = 0;
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
  }

  private drawSide(front: Front, side: FrontSide, from: Axial, to: Axial, hexSize: number, elapsed: number): void {
    const count = Math.min(MAX_SOLDIERS_PER_SIDE, Math.ceil(side.troops));
    if (count <= 0) return;
    const a = axialToPixel(from, hexSize);
    const b = axialToPixel(to, hexSize);
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const px = -dy;
    const py = dx;
    const attacking = side.mode !== 'defence';
    const color = ownerColor(side.empire);
    const pixel = (hexSize * SOLDIER_SCALE) / SOLDIER_SIZE;
    const columns = Math.ceil(Math.sqrt(count * 2));
    const spacing = (hexSize * 0.8) / columns;
    const seed = hashId(front.id);
    let sumX = 0;
    let topY = Number.POSITIVE_INFINITY;

    for (let i = 0; i < count; i++) {
      const col = i % columns;
      const rank = Math.floor(i / columns);
      const lateral = (col - (columns - 1) / 2) * spacing + (rank % 2) * spacing * 0.5;
      let depth = hexSize * 0.38 - rank * spacing * 0.8;
      const phase = (elapsed + ((seed + i * 37) % 100) / 100);
      let frame: SoldierFrame;
      if (attacking) {
        const t = (phase / ATTACK_CYCLE) % 1;
        frame = t < 0.45 ? 'windup' : 'strike';
        if (frame === 'strike') depth += hexSize * LUNGE * Math.sin(((t - 0.45) / 0.55) * Math.PI);
      } else {
        frame = Math.floor(phase / MARCH_CYCLE) % 4 === 0 ? 'step' : 'idle';
      }
      const sprite = this.acquire();
      sprite.texture = this.texture(color, frame);
      sprite.scale.set(dx < 0 ? -pixel : pixel, pixel);
      sprite.position.set(a.x + dx * depth + px * lateral, a.y + dy * depth + py * lateral);
      sprite.zIndex = sprite.position.y;
      sumX += sprite.position.x;
      topY = Math.min(topY, sprite.position.y);
    }
    const headroom = SOLDIER_SIZE * pixel * 0.85 + hexSize * 0.08;
    this.drawCount(Math.ceil(side.troops), color, sumX / count, topY - headroom, hexSize);
  }

  private drawCount(troops: number, color: number, x: number, y: number, hexSize: number): void {
    let label = this.labels[this.labelsUsed];
    if (!label) {
      label = new Text({
        text: '',
        resolution: 4,
        style: { fontFamily: 'Ubuntu, sans-serif', fontWeight: '700', fontSize: 24, fill: 0xffffff, stroke: { color: 0x1b1330, width: 5 } },
      });
      label.anchor.set(0.5, 1);
      label.eventMode = 'none';
      label.zIndex = Number.MAX_SAFE_INTEGER;
      this.labels.push(label);
      this.container.addChild(label);
    }
    this.labelsUsed++;
    const text = String(troops);
    if (label.text !== text) label.text = text;
    label.tint = mixTowardWhite(color);
    label.scale.set((hexSize * COUNT_SIZE) / 24);
    label.position.set(x, y);
    label.visible = true;
  }

  private drawColumn(state: GameState, column: Column, hexSize: number, elapsed: number): void {
    const here = column.path[column.step];
    if (!here) return;
    const next = column.path[column.step + 1] ?? here;
    const a = axialToPixel(here, hexSize);
    const b = axialToPixel(next, hexSize);
    const t = Math.min(1, column.progress / columnLegDuration(state, column));
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const color = ownerColor(column.empire);
    const pixel = (hexSize * SOLDIER_SCALE) / SOLDIER_SIZE;
    const count = Math.max(1, Math.min(MAX_COLUMN_SOLDIERS, Math.ceil(column.troops)));
    const perRank = 3;
    const spacing = hexSize * 0.22;
    for (let i = 0; i < count; i++) {
      const rank = Math.floor(i / perRank);
      const lateral = ((i % perRank) - (perRank - 1) / 2) * spacing;
      const behind = rank * spacing;
      const phase = elapsed + i * 0.13;
      const sprite = this.acquire();
      sprite.texture = this.texture(color, Math.floor(phase / (MARCH_CYCLE / 2)) % 2 === 0 ? 'step' : 'idle');
      sprite.scale.set(dx < 0 ? -pixel : pixel, pixel);
      sprite.position.set(x - (dx / len) * behind - (dy / len) * lateral, y - (dy / len) * behind + (dx / len) * lateral);
      sprite.zIndex = sprite.position.y;
    }
  }

  private drawSquads(expedition: Expedition, hexSize: number, elapsed: number): void {
    const color = ownerColor(expedition.empire);
    const pixel = (hexSize * SOLDIER_SCALE) / SOLDIER_SIZE;
    expedition.squads.forEach((squad, i) => {
      const toward = squad.claiming ? squad.goal : squad.from;
      const facing = toward ? toward.q - squad.pos.q : squad.heading.q;
      const moving = squad.goal !== null;
      const phase = elapsed + i * 0.17;
      const frame = moving && Math.floor(phase / (MARCH_CYCLE / 2)) % 2 === 0 ? 'step' : 'idle';
      const sprite = this.acquire();
      sprite.texture = this.texture(color, frame);
      sprite.scale.set(facing < 0 ? -pixel : pixel, pixel);
      const at = axialToPixel(squad.pos, hexSize);
      sprite.position.set(at.x, at.y);
      sprite.zIndex = at.y;
    });
  }

  private drawGatherers(state: GameState, hexSize: number, elapsed: number): void {
    const pixel = (hexSize * GATHERER_SCALE) / SOLDIER_SIZE;
    for (const cell of state.grid.cells) {
      const building = cell.building;
      if (!building || building.gatherers.length === 0) continue;
      building.gatherers.forEach((gatherer, i) => {
        if (gatherer.phase === 'idle') return;
        const at = axialToPixel(gatherer.pos, hexSize);
        const phase = elapsed + i * 0.29;
        let frame: SoldierFrame;
        if (gatherer.phase === 'working') frame = Math.floor(phase / ATTACK_CYCLE) % 2 === 0 ? 'windup' : 'strike';
        else frame = Math.floor(phase / (MARCH_CYCLE / 2)) % 2 === 0 ? 'step' : 'idle';
        const toward = gatherer.phase === 'returning' ? cell.q - gatherer.pos.q : (gatherer.target?.q ?? cell.q) - cell.q;
        const sprite = this.acquire();
        sprite.texture = this.texture(GATHERER_COLOR, frame);
        sprite.scale.set(toward < 0 ? -pixel : pixel, pixel);
        const offset = (i - (building.gatherers.length - 1) / 2) * hexSize * 0.25;
        sprite.position.set(at.x + offset, at.y + hexSize * 0.1);
        sprite.zIndex = sprite.position.y;
      });
    }
  }

  private acquire(): Sprite {
    let sprite = this.pool[this.used];
    if (!sprite) {
      sprite = new Sprite();
      sprite.anchor.set(0.5, 0.85);
      sprite.eventMode = 'none';
      this.pool.push(sprite);
      this.container.addChild(sprite);
    }
    sprite.visible = true;
    this.used++;
    return sprite;
  }

  private texture(color: number, frame: SoldierFrame): Texture {
    const key = `${color},${frame}`;
    const cached = this.textures.get(key);
    if (cached) return cached;
    const rows = SOLDIER_SPRITES[frame];
    const width = Math.max(...rows.map(row => row.length));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = rows.length;
    const ctx = canvas.getContext('2d')!;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x]!;
        const value = ch === 'c' ? color : SPRITE_PALETTE[ch];
        if (value === undefined) continue;
        ctx.fillStyle = `#${value.toString(16).padStart(6, '0')}`;
        ctx.fillRect(x, y, 1, 1);
      }
    });
    const texture = Texture.from(canvas);
    texture.source.scaleMode = 'nearest';
    this.textures.set(key, texture);
    return texture;
  }
}

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function mixTowardWhite(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lift = (channel: number): number => Math.round(channel + (255 - channel) * 0.45);
  return (lift(r) << 16) | (lift(g) << 8) | lift(b);
}
