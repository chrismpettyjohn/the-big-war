/**
 * World renderer — one PIXI `Application`, four layers, one canvas.
 *
 * Public surface (the session drives all of this; nothing here touches sim state):
 *
 *   const world = createWorld({ host: element });
 *   await world.init();
 *   world.camera.set({ x, y, scale });        // or mutate world.camera.x/y/scale
 *   world.render(store.state);                 // call once per frame
 *   world.spawnFx('cannonPuff', hex, color);   // transient juice
 *   const hex = world.screenToHex(e.clientX, e.clientY);
 *
 * Coordinate conventions:
 *   - `camera.toScreen/toWorld/zoomBy` use CANVAS-LOCAL pixels (origin = canvas
 *     top-left). `camera` is a pure transform with no DOM knowledge.
 *   - `WorldRenderer.screenToHex/screenToWorld/worldToScreen` use CLIENT pixels
 *     (origin = viewport top-left, i.e. what pointer events report), subtracting
 *     the canvas offset internally.
 *
 * Layering (bottom → top), matching ARCHITECTURE §5:
 *   terrainLayer → buildingsLayer → overlayLayer → fxLayer.
 *
 * The camera is a plain mutable object with world↔screen helpers and zoom
 * clamping, so `src/session` can own pan/zoom input without importing anything
 * from here beyond the `Camera` type.
 *
 * Culling + redraw: the visible hex range is derived from the camera rect each
 * frame; terrain rebuilds only when the visible owner/terrain slice changes,
 * buildings sync per-`Building.id`, overlay/FX are small bounded passes.
 */

import { Application, Container, Ticker } from 'pixi.js';
import type { Axial, Pixel } from '../game/hex';
import { pixelToHex } from '../game/hex';
import type { GameState } from '../game/types';
import { BuildingsLayer } from './buildingsLayer';
import { FxLayer } from './fxLayer';
import type { FxKind } from './fxLayer';
import { OverlayLayer } from './overlayLayer';
import type { OverlayState } from './overlayLayer';
import { TerrainLayer, visibleHexRange } from './terrainLayer';

/* --------------------------------------------------------------- camera ---- */

/** Minimum / maximum zoom, in screen pixels per world pixel. */
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 3.0;

/**
 * Camera transform: world → screen is `(world - (x, y)) * scale`. `x`/`y` are the
 * world-space point at the top-left of the viewport (i.e. the camera's scroll
 * offset), `scale` is zoom. Mutate directly for pan, or call `set`/`zoomBy`.
 */
export interface Camera {
  /** World-space x of the viewport's top-left corner. */
  x: number;
  /** World-space y of the viewport's top-left corner. */
  y: number;
  /** Zoom in screen pixels per world pixel, clamped to [MIN_ZOOM, MAX_ZOOM]. */
  scale: number;
}

/** A camera plus the operations the session needs; `camera.set` clamps zoom. */
export interface CameraController extends Camera {
  /** Assign pan/zoom in one call; `scale` is clamped to the legal range. */
  set(next: Partial<Camera>): void;
  /** Multiply zoom by `factor` about a canvas-local anchor, keeping it fixed. */
  zoomBy(factor: number, canvasX: number, canvasY: number): void;
  /** World → canvas-local screen for a point. */
  toScreen(worldX: number, worldY: number): Pixel;
  /** Canvas-local screen → world for a point. */
  toWorld(canvasX: number, canvasY: number): Pixel;
}

function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/* ---------------------------------------------------------------- world ---- */

/** Options for `createWorld`. */
export interface WorldOptions {
  /** Element the canvas is appended to. The renderer sizes to its box. */
  readonly host: HTMLElement;
  /** Initial zoom (screen px per world px). Defaults to 1. */
  readonly initialScale?: number;
  /** Background colour behind the map. Defaults to a dark neutral. */
  readonly background?: number;
  /** When true, `Application` renders on its own ticker. Defaults to true. */
  readonly autoStart?: boolean;
}

/**
 * The renderer facade. Create with `createWorld`, then `await init()` before the
 * first `render`. One instance owns exactly one canvas.
 */
export interface WorldRenderer {
  /** The camera. Mutable fields; use `set`/`zoomBy` for clamped changes. */
  readonly camera: CameraController;
  /** Resize + attach the PIXI canvas and start the ticker. Idempotent. */
  init(): Promise<void>;
  /** Draw one frame of `state` from the current camera. Never mutates state. */
  render(state: GameState): void;
  /**
   * Provide overlay inputs (selection, hover, cannon targeting). The session owns
   * this state; pass `null` to clear a field. Fronts are drawn from `state`.
   */
  setOverlay(overlay: Partial<Omit<OverlayState, 'fronts'>>): void;
  /** Queue a transient effect at `hex`. `color` defaults per kind. */
  spawnFx(kind: FxKind, hex: Axial, color?: number): void;
  /** Client point (viewport coords) → integer hex under it. For UI hit-testing. */
  screenToHex(screenX: number, screenY: number): Axial;
  /** Client point (viewport coords) → world point. */
  screenToWorld(screenX: number, screenY: number): Pixel;
  /** World point → client point (viewport coords). */
  worldToScreen(worldX: number, worldY: number): Pixel;
  /** Current viewport size in CSS pixels. */
  readonly size: { readonly width: number; readonly height: number };
  /** Destroy the Application and detach the canvas. Safe to call twice. */
  destroy(): void;
}

/**
 * Create the world renderer bound to `options.host`. Does no work until `init()`
 * resolves (PIXI 8's `Application.init` is async), which also makes it safe to
 * await before reading `world.size`.
 */
export function createWorld(options: WorldOptions): WorldRenderer {
  const app = new Application();
  const initialized = { done: false };
  const size = { width: 1, height: 1 };

  const cameraState: Camera = { x: 0, y: 0, scale: clampZoom(options.initialScale ?? 1) };

  const stage = new Container();
  const terrain = new TerrainLayer();
  const buildings = new BuildingsLayer();
  const overlay = new OverlayLayer();
  const fx = new FxLayer();

  let lastFxTime = 0;

  const camera: CameraController = {
    get x() {
      return cameraState.x;
    },
    set x(value: number) {
      cameraState.x = value;
    },
    get y() {
      return cameraState.y;
    },
    set y(value: number) {
      cameraState.y = value;
    },
    get scale() {
      return cameraState.scale;
    },
    set scale(value: number) {
      cameraState.scale = clampZoom(value);
    },
    set(next: Partial<Camera>): void {
      if (next.x !== undefined) cameraState.x = next.x;
      if (next.y !== undefined) cameraState.y = next.y;
      if (next.scale !== undefined) cameraState.scale = clampZoom(next.scale);
    },
    zoomBy(factor: number, screenX: number, screenY: number): void {
      const before = toWorld(cameraState, screenX, screenY);
      cameraState.scale = clampZoom(cameraState.scale * factor);
      const after = toWorld(cameraState, screenX, screenY);
      // Keep the world point under the anchor fixed.
      cameraState.x += before.x - after.x;
      cameraState.y += before.y - after.y;
    },
    toScreen(worldX: number, worldY: number): Pixel {
      return {
        x: (worldX - cameraState.x) * cameraState.scale,
        y: (worldY - cameraState.y) * cameraState.scale,
      };
    },
    toWorld(screenX: number, screenY: number): Pixel {
      return toWorld(cameraState, screenX, screenY);
    },
  };

  // Overlay inputs live on a scratch object the session fills incrementally.
  const overlayState: OverlayState = {
    selected: null,
    hovered: null,
    fronts: [],
    cannonFrom: null,
    cannonRange: 6,
    cannonTarget: null,
  };

  /** Latest state handed to `render`; the ticker's FX pass needs it for fronts. */
  let lastState: GameState | null = null;

  const measure = (): void => {
    const rect = options.host.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    size.width = width;
    size.height = height;
  };

  /** One frame: compute the visible range, then draw each layer bottom→top. */
  const drawFrame = (state: GameState, dtSeconds: number): void => {
    // Camera transform on the root container — two assignments, not geometry.
    stage.scale.set(cameraState.scale);
    stage.position.set(-cameraState.x * cameraState.scale, -cameraState.y * cameraState.scale);
    const hexSize = state.config.map.hexSize;
    const range = visibleHexRange(
      state.grid,
      hexSize,
      cameraState.x,
      cameraState.y,
      cameraState.x + size.width / cameraState.scale,
      cameraState.y + size.height / cameraState.scale,
    );
    terrain.draw(state.grid, hexSize, range);
    buildings.draw(state.grid, hexSize, range, state.elapsed);
    overlayState.fronts = state.fronts;
    overlay.draw(overlayState, hexSize);
    fx.update(dtSeconds);
  };

  const onTick = (ticker: Ticker): void => {
    if (!lastState) return;
    const now = ticker.lastTime;
    const dt = lastFxTime === 0 ? 0 : Math.min(0.1, (now - lastFxTime) / 1000);
    lastFxTime = now;
    resizeIfNeeded();
    drawFrame(lastState, dt);
  };

  let resizeObserver: ResizeObserver | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  /** Canvas origin in client space; screen helpers accept client coordinates. */
  let canvasLeft = 0;
  let canvasTop = 0;
  const resizeIfNeeded = (): void => {
    const rect = options.host.getBoundingClientRect();
    canvasLeft = rect.left;
    canvasTop = rect.top;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    size.width = width;
    size.height = height;
    app.renderer.resize(width, height);
  };

  const world: WorldRenderer = {
    camera,
    async init(): Promise<void> {
      if (initialized.done) return;
      measure();
      lastWidth = size.width;
      lastHeight = size.height;
      await app.init({
        width: size.width,
        height: size.height,
        background: options.background ?? 0x14181c,
        antialias: true,
        autoStart: options.autoStart ?? true,
        resolution: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
        autoDensity: true,
      });
      stage.addChild(terrain.container, buildings.container, overlay.container, fx.container);
      app.stage.addChild(stage);
      options.host.appendChild(app.canvas);
      app.canvas.style.display = 'block';
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      // Capture the canvas origin in client space for the screen-coord helpers.
      const rect = options.host.getBoundingClientRect();
      canvasLeft = rect.left;
      canvasTop = rect.top;
      // PIXI draws the map in world space; the camera transform is applied to the
      // root container so zoom/pan never rebuild geometry.
      initialized.done = true;
      if (options.autoStart ?? true) {
        app.ticker.add(onTick);
      }
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resizeIfNeeded());
        resizeObserver.observe(options.host);
      }
    },
    render(state: GameState): void {
      if (!initialized.done) return;
      lastState = state;
      // When autoStart is off the caller drives frames; run FX off wall clock.
      if (!(options.autoStart ?? true)) {
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        const dt = lastFxTime === 0 ? 0 : Math.min(0.1, (now - lastFxTime) / 1000);
        lastFxTime = now;
        resizeIfNeeded();
        drawFrame(state, dt);
      }
    },
    setOverlay(next: Partial<Omit<OverlayState, 'fronts'>>): void {
      if (next.selected !== undefined) overlayState.selected = next.selected;
      if (next.hovered !== undefined) overlayState.hovered = next.hovered;
      if (next.cannonFrom !== undefined) overlayState.cannonFrom = next.cannonFrom;
      if (next.cannonRange !== undefined) overlayState.cannonRange = next.cannonRange;
      if (next.cannonTarget !== undefined) overlayState.cannonTarget = next.cannonTarget;
    },
    spawnFx(kind: FxKind, hex: Axial, color?: number): void {
      const hexSize = lastState?.config.map.hexSize ?? 32;
      fx.spawn(kind, hex, hexSize, color);
    },
    screenToHex(screenX: number, screenY: number): Axial {
      const hexSize = lastState?.config.map.hexSize ?? 32;
      return pixelToHex(camera.toWorld(screenX - canvasLeft, screenY - canvasTop), hexSize);
    },
    screenToWorld(screenX: number, screenY: number): Pixel {
      return camera.toWorld(screenX - canvasLeft, screenY - canvasTop);
    },
    worldToScreen(worldX: number, worldY: number): Pixel {
      const point = camera.toScreen(worldX, worldY);
      return { x: point.x + canvasLeft, y: point.y + canvasTop };
    },
    get size() {
      return size;
    },
    destroy(): void {
      if (!initialized.done) return;
      initialized.done = false;
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (options.autoStart ?? true) app.ticker.remove(onTick);
      buildings.reset();
      fx.clear();
      terrain.invalidate();
      app.destroy(true, { children: true });
      lastState = null;
      lastFxTime = 0;
    },
  };

  return world;
}

/** Free-function world→screen used before the controller exists (zoom anchor). */
function toWorld(cameraState: Camera, screenX: number, screenY: number): Pixel {
  return {
    x: cameraState.x + screenX / cameraState.scale,
    y: cameraState.y + screenY / cameraState.scale,
  };
}
