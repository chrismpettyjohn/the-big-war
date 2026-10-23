/**
 * Camera: the single source of truth for "what part of the world is on screen".
 *
 * The renderer owns drawing, the session owns the camera, and input moves it —
 * so the camera lives here as a plain mutable object with pure helpers, rather
 * than inside either of them. `Pixel` is world-space; screen-space is what the
 * pointer reports. The renderer applies `(world - camera) * scale`.
 */

import type { Pixel } from '../game/hex';

export interface Camera {
  /** World position (px) at the centre of the viewport. */
  x: number;
  y: number;
  /** Zoom multiplier: 1 = default hex size. */
  scale: number;
}

export const MIN_SCALE = 0.35;
export const MAX_SCALE = 2.6;

/** Default zoom, tuned so a 72x42 map reads as a map rather than a field. */
export const DEFAULT_SCALE = 0.85;

export function createCamera(x = 0, y = 0, scale = DEFAULT_SCALE): Camera {
  return { x, y, scale: clampScale(scale) };
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Screen (viewport) point → world point. */
export function screenToWorld(camera: Camera, screen: Pixel, viewport: Pixel): Pixel {
  return {
    x: camera.x + (screen.x - viewport.x / 2) / camera.scale,
    y: camera.y + (screen.y - viewport.y / 2) / camera.scale,
  };
}

/** World point → screen (viewport) point. */
export function worldToScreen(camera: Camera, world: Pixel, viewport: Pixel): Pixel {
  return {
    x: (world.x - camera.x) * camera.scale + viewport.x / 2,
    y: (world.y - camera.y) * camera.scale + viewport.y / 2,
  };
}

/** Pan by a screen-space delta (so dragging feels identical at every zoom). */
export function panBy(camera: Camera, dxScreen: number, dyScreen: number): void {
  camera.x -= dxScreen / camera.scale;
  camera.y -= dyScreen / camera.scale;
}

/**
 * Zoom about a screen anchor (the pointer), keeping the world point under the
 * cursor fixed. `factor` is multiplicative (1.1 = zoom in 10%).
 */
export function zoomAt(camera: Camera, factor: number, anchor: Pixel, viewport: Pixel): void {
  const before = screenToWorld(camera, anchor, viewport);
  camera.scale = clampScale(camera.scale * factor);
  const after = screenToWorld(camera, anchor, viewport);
  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
}

/** World-space rect currently visible, used by the renderer to cull hexes. */
export function visibleWorldRect(camera: Camera, viewport: Pixel): {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
} {
  const halfW = viewport.x / 2 / camera.scale;
  const halfH = viewport.y / 2 / camera.scale;
  return {
    minX: camera.x - halfW,
    minY: camera.y - halfH,
    maxX: camera.x + halfW,
    maxY: camera.y + halfH,
  };
}
