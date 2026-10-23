/**
 * Match runtime: the glue that makes the three layers into one game.
 *
 * It owns the frame loop and nothing else:
 *   requestAnimationFrame → clock delta
 *     → store.step(dt)                  (fixed-step sim, speed-scaled)
 *     → world.render(store.state)       (draw from the mutable state)
 *     → overlay + camera                (selection/hover/cannon aiming)
 *
 * Input intents arrive from `attachInput` (canvas-local points) and are routed to
 * the camera (pan/zoom) or the controllers (tap/long press). Note the coordinate
 * handoff: the renderer's public `screenToHex` takes CLIENT pixels, while input
 * reports CANVAS-LOCAL pixels — this file bridges the two in one place so no
 * other module has to care.
 */

import type { Axial, Pixel } from '../game/hex';
import { axialToPixel, gridInBounds } from '../game/hex';
import type { GameStore } from '../game/store';
import type { WorldRenderer } from '../render/world';
import { panBy } from './camera';
import { createControllers, type Controllers } from './controllers';
import { attachInput, type InputIntent } from './input';

export interface MatchRuntimeOptions {
  readonly store: GameStore;
  readonly world: WorldRenderer;
  /** Element that receives pointer input (the canvas host). */
  readonly host: HTMLElement;
  readonly onEnded?: (winner: number | null) => void;
}

export interface MatchRuntime {
  readonly controllers: Controllers;
  /** Start the frame loop + input. */
  start(): void;
  /** Stop everything (leaving the match / hot reload). */
  stop(): void;
  /** Centre the camera on an empire's territory (match start / "centre on me"). */
  centreOnEmpire(empire: number): void;
  /** Centre on a hex. */
  centreOnHex(hex: Axial): void;
}

/** Cap on simulated seconds per frame — the store has its own spiral guard too. */
const MAX_FRAME_SECONDS = 0.1;

export function createMatchRuntime(options: MatchRuntimeOptions): MatchRuntime {
  const { store, world, host } = options;

  /* ------------------------------------------------------ coordinates ---- */

  /**
   * Canvas-local point → hex. `world.screenToHex` wants client coords, so add the
   * host's viewport offset (measured per call — the host can move).
   */
  const localToHex = (at: Pixel): Axial | null => {
    const rect = host.getBoundingClientRect();
    const hex = world.screenToHex(at.x + rect.left, at.y + rect.top);
    if (!gridInBounds(store.state.grid, hex.q, hex.r)) return null;
    return hex;
  };

  const controllers = createControllers({
    store,
    viewport: () => ({ x: world.size.width, y: world.size.height }),
    screenToHex: localToHex,
    onTroopsSent: (from, target) => {
      world.spawnFx('captureFlash', target, undefined);
      void from;
    },
  });

  /* ---------------------------------------------------------- camera ---- */

  const centreOnWorld = (point: Pixel) => {
    const scale = world.camera.scale;
    world.camera.set({
      x: point.x - world.size.width / (2 * scale),
      y: point.y - world.size.height / (2 * scale),
    });
  };

  /** Average world position of an empire's hexes; null when it holds none. */
  const empireCentroid = (empire: number): Pixel | null => {
    const grid = store.state.grid;
    const hexSize = store.state.config.map.hexSize;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const cell of grid.cells) {
      if (cell.owner !== empire) continue;
      const pixel = axialToPixel({ q: cell.q, r: cell.r }, hexSize);
      sumX += pixel.x;
      sumY += pixel.y;
      count++;
    }
    return count === 0 ? null : { x: sumX / count, y: sumY / count };
  };

  /* ----------------------------------------------------------- input ---- */

  const handleIntent = (intent: InputIntent) => {
    switch (intent.kind) {
      case 'pan':
        panBy(world.camera, intent.dx, intent.dy);
        return;
      case 'zoom':
        // Camera helpers are canvas-local; input anchors already are.
        world.camera.zoomBy(intent.factor, intent.anchor.x, intent.anchor.y);
        return;
      case 'tap':
        controllers.tap(intent.at, intent.button);
        return;
      case 'longPress':
        controllers.secondary(intent.at);
        return;
      case 'hover':
        controllers.setHover(localToHex(intent.at));
        return;
      case 'leave':
        controllers.setHover(null);
        return;
      case 'panEnd':
        return;
      case 'key':
        controllers.key(intent.key);
        return;
    }
  };

  /* ------------------------------------------------------------ loop ---- */

  let detach: (() => void) | null = null;
  let frame = 0;
  let lastTime = 0;
  let endedNotified = false;

  const loop = (time: number) => {
    frame = requestAnimationFrame(loop);
    const dt = lastTime === 0 ? 0 : Math.min(MAX_FRAME_SECONDS, (time - lastTime) / 1000);
    lastTime = time;

    store.step(dt);

    const tool = controllers.tool();
    world.setOverlay({
      selected: controllers.selectedHex(),
      hovered: controllers.hoverHex(),
      cannonFrom: tool.kind === 'cannon' ? tool.from : null,
      cannonRange: store.state.config.cannon.range,
      cannonTarget: tool.kind === 'cannon' ? controllers.hoverHex() : null,
    });
    world.render(store.state);

    if (!endedNotified && store.status() === 'ended') {
      endedNotified = true;
      options.onEnded?.(store.winner());
    }
  };

  return {
    controllers,
    start(): void {
      detach = attachInput({ element: host, viewport: () => ({ x: world.size.width, y: world.size.height }), onIntent: handleIntent });
      lastTime = 0;
      endedNotified = false;
      world.render(store.state);
      frame = requestAnimationFrame(loop);
    },
    stop(): void {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      detach?.();
      detach = null;
    },
    centreOnEmpire(empire: number): void {
      const point = empireCentroid(empire);
      if (point) centreOnWorld(point);
    },
    centreOnHex(hex: Axial): void {
      centreOnWorld(axialToPixel(hex, store.state.config.map.hexSize));
    },
  };
}
