/**
 * FX layer — transient PIXI-only effects (cannon puff, capture flash, elimination
 * fade). No text, no persistent state: an effect is spawned with a hex + duration
 * and removes itself when its clock runs out.
 *
 * The layer owns a bounded pool of `Graphics` objects so a burst of cannon fire
 * does not allocate per effect. Effects are advanced with a real delta in
 * seconds, independent of the fixed sim timestep, because they are pure juice.
 */

import { Container, Graphics } from 'pixi.js';
import { axialToPixel } from '../game/hex';
import type { Axial } from '../game/hex';
import { ACCENT_COLOR, DANGER_COLOR, ownerColor } from './theme';

/** The kinds of transient effect the renderer understands. */
export type FxKind = 'cannonPuff' | 'captureFlash' | 'eliminationFade';

/** A single in-flight effect. Mutable: `age` advances each frame. */
interface Fx {
  readonly object: Graphics;
  kind: FxKind;
  hex: Axial;
  /** Hex size captured at spawn so zoom changes do not warp an effect mid-life. */
  size: number;
  age: number;
  /** Lifetime in seconds. */
  life: number;
  color: number;
}

/** Cannon smoke hangs around a little longer than a capture flash. */
const LIFETIMES: Readonly<Record<FxKind, number>> = {
  cannonPuff: 0.6,
  captureFlash: 0.5,
  eliminationFade: 1.4,
};

/** Hard cap on simultaneous effects; extra spawns are dropped, never queued. */
const MAX_EFFECTS = 64;

/**
 * Transient effects layer. Spawned by `world.spawnFx`, advanced by `world`'s
 * ticker, auto-releasing pooled objects on expiry.
 */
export class FxLayer {
  /** Parent container (added to the stage by world.ts). */
  readonly container: Container;
  private readonly active: Fx[] = [];
  private readonly free: Graphics[] = [];

  constructor() {
    this.container = new Container();
    this.container.eventMode = 'none';
  }

  /** Queue an effect on `hex`. `color` defaults per-kind; owner tints flushes. */
  spawn(kind: FxKind, hex: Axial, hexSize: number, color?: number): void {
    if (this.active.length >= MAX_EFFECTS) return;
    const object = this.free.pop() ?? new Graphics();
    object.eventMode = 'none';
    object.clear();
    this.container.addChild(object);
    this.active.push({
      object,
      kind,
      hex: { q: hex.q, r: hex.r },
      size: hexSize,
      age: 0,
      life: LIFETIMES[kind],
      color: color ?? defaultColor(kind),
    });
  }

  /** Advance every effect by `dt` real seconds, redrawing and expiring. */
  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      if (!fx) continue;
      fx.age += dt;
      if (fx.age >= fx.life) {
        this.container.removeChild(fx.object);
        this.free.push(fx.object);
        this.active.splice(i, 1);
        continue;
      }
      this.render(fx);
    }
  }

  /** Drop every effect and return their objects to the pool. */
  clear(): void {
    for (const fx of this.active) {
      this.container.removeChild(fx.object);
      this.free.push(fx.object);
    }
    this.active.length = 0;
  }

  /** Number of effects currently in flight (diagnostics/tests). */
  get activeCount(): number {
    return this.active.length;
  }

  private render(fx: Fx): void {
    const g = fx.object;
    const t = fx.age / fx.life; // 0 → 1
    g.clear();
    const center = axialToPixel(fx.hex, fx.size);
    const alpha = 1 - t;
    switch (fx.kind) {
      case 'cannonPuff': {
        const radius = fx.size * (0.3 + t * 0.9);
        g.circle(center.x, center.y, radius);
        g.fill({ color: fx.color, alpha: alpha * 0.4 });
        g.circle(center.x, center.y, radius * 0.6);
        g.stroke({ width: 2, color: ACCENT_COLOR, alpha: alpha * 0.8 });
        break;
      }
      case 'captureFlash': {
        const radius = fx.size * (1.0 - t * 0.3);
        g.poly(hexagon(center, radius));
        g.fill({ color: fx.color, alpha: alpha * 0.45 });
        g.stroke({ width: 3, color: fx.color, alpha: alpha });
        break;
      }
      case 'eliminationFade': {
        const radius = fx.size * (0.4 + t * 0.8);
        g.poly(hexagon(center, radius));
        g.stroke({ width: 4 * (1 - t) + 1, color: fx.color, alpha: alpha * 0.7 });
        break;
      }
    }
    g.alpha = alpha;
  }
}

function defaultColor(kind: FxKind): number {
  if (kind === 'cannonPuff') return 0x555555;
  if (kind === 'captureFlash') return ACCENT_COLOR;
  return DANGER_COLOR;
}

/** Convenience for callers that have an empire id (capture/elimination tint). */
export function fxColorForOwner(owner: number): number {
  return ownerColor(owner);
}

function hexagon(center: { x: number; y: number }, size: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i + 30) * Math.PI) / 180;
    points.push(center.x + size * Math.cos(angle), center.y + size * Math.sin(angle));
  }
  return points;
}
