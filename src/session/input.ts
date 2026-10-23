/**
 * Input: turns raw pointer/touch/wheel/key events on the canvas into INTENTS.
 *
 * This file knows nothing about the game. It decides whether a gesture was a
 * drag (pan), a tap (select/attack), a long press (context menu), or a wheel/pinch
 * (zoom), and reports it. `controllers.ts` interprets the intents using game
 * state; `camera.ts` applies the camera changes.
 *
 * Gesture rules (mirroring the original game's controls):
 * - drag past DRAG_THRESHOLD px  → pan (and NOT a tap)
 * - press + release under it     → tap
 * - press + hold HELD_LONG_MS    → long press (context menu) at that point
 * - wheel                        → zoom about the cursor
 * - two-finger pinch             → zoom about the pinch midpoint
 * - right click                  → context menu (a "secondary tap")
 */

import type { Pixel } from '../game/hex';

export type InputIntent =
  | { readonly kind: 'pan'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'zoom'; readonly factor: number; readonly anchor: Pixel }
  | { readonly kind: 'tap'; readonly at: Pixel; readonly button: 'primary' | 'secondary' }
  | { readonly kind: 'longPress'; readonly at: Pixel }
  | { readonly kind: 'hover'; readonly at: Pixel }
  | { readonly kind: 'leave' }
  | { readonly kind: 'panEnd' }
  | { readonly kind: 'key'; readonly key: string };

export interface InputHost {
  /** Element that receives pointer events (the PIXI canvas wrapper). */
  readonly element: HTMLElement;
  /** Viewport size in CSS px, queried lazily so resizes are picked up. */
  readonly viewport: () => Pixel;
  /** Called for every intent, in order. */
  readonly onIntent: (intent: InputIntent) => void;
}

/** Pointer travel (px) that turns a press into a drag. */
export const DRAG_THRESHOLD = 6;
/** Hold time (ms) that opens the context menu on touch/left button. */
export const HELD_LONG_MS = 420;
/** Wheel notch → zoom factor. */
const WHEEL_STEP = 1.0015;
/** Pinch sensitivity: scale change per px of pinch-span change. */
const PINCH_STEP = 0.006;

interface PointerState {
  id: number;
  /** Where the pointer went down (screen px). */
  startX: number;
  startY: number;
  /** Last observed position. */
  lastX: number;
  lastY: number;
  /** True once travel passed DRAG_THRESHOLD. */
  dragging: boolean;
  /** Button that started the gesture. */
  button: 'primary' | 'secondary';
  /** Timer for long press, cleared on move/release. */
  timer: ReturnType<typeof setTimeout> | null;
  /** Set when the long press fired so the release is swallowed. */
  consumed: boolean;
}

/**
 * Attach input handling. Returns a detach function.
 */
export function attachInput(host: InputHost): () => void {
  const pointers = new Map<number, PointerState>();
  let pinchSpan = 0;

  const localPoint = (event: PointerEvent): Pixel => {
    const rect = host.element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const clearTimer = (state: PointerState) => {
    if (state.timer !== null) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    const at = localPoint(event);
    const button = event.button === 2 ? 'secondary' : 'primary';
    const state: PointerState = {
      id: event.pointerId,
      startX: at.x,
      startY: at.y,
      lastX: at.x,
      lastY: at.y,
      dragging: false,
      button,
      timer: null,
      consumed: false,
    };
    pointers.set(event.pointerId, state);
    host.element.setPointerCapture?.(event.pointerId);

    if (pointers.size === 2) {
      // Entering a pinch: cancel any pending tap/long press semantics.
      const [a, b] = [...pointers.values()];
      if (a && b) {
        pinchSpan = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
        for (const pointer of pointers.values()) {
          clearTimer(pointer);
          pointer.dragging = true;
        }
      }
      return;
    }

    if (button === 'primary') {
      state.timer = setTimeout(() => {
        state.timer = null;
        if (!state.dragging) {
          state.consumed = true;
          host.onIntent({ kind: 'longPress', at: { x: state.startX, y: state.startY } });
        }
      }, HELD_LONG_MS);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const at = localPoint(event);
    const state = pointers.get(event.pointerId);

    if (pointers.size >= 2) {
      const ids = [...pointers.keys()];
      const first = pointers.get(ids[0]!);
      const second = pointers.get(ids[1]!);
      if (first && second) {
        // Update the moved pointer before measuring the span.
        if (state) {
          state.lastX = at.x;
          state.lastY = at.y;
          state.dragging = true;
        }
        const span = Math.hypot(first.lastX - second.lastX, first.lastY - second.lastY);
        if (pinchSpan > 0 && span > 0) {
          host.onIntent({
            kind: 'zoom',
            factor: 1 + (span - pinchSpan) * PINCH_STEP,
            anchor: { x: (first.lastX + second.lastX) / 2, y: (first.lastY + second.lastY) / 2 },
          });
        }
        pinchSpan = span;
      }
      return;
    }

    if (!state) {
      host.onIntent({ kind: 'hover', at });
      return;
    }

    const dx = at.x - state.lastX;
    const dy = at.y - state.lastY;
    const travelled = Math.hypot(at.x - state.startX, at.y - state.startY);
    state.lastX = at.x;
    state.lastY = at.y;

    if (!state.dragging && travelled > DRAG_THRESHOLD) {
      state.dragging = true;
      clearTimer(state);
    }
    if (state.dragging) host.onIntent({ kind: 'pan', dx, dy });
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    const state = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    host.element.releasePointerCapture?.(event.pointerId);
    if (!state) return;

    clearTimer(state);
    if (pointers.size < 2) pinchSpan = 0;

    if (cancelled) return;
    if (state.consumed) return;

    if (state.dragging) {
      if (pointers.size === 0) host.onIntent({ kind: 'panEnd' });
      return;
    }

    const at = localPoint(event);
    if (state.button === 'secondary') {
      host.onIntent({ kind: 'tap', at, button: 'secondary' });
      return;
    }
    // A clean press without drag or long press is a tap.
    if (Math.hypot(at.x - state.startX, at.y - state.startY) <= DRAG_THRESHOLD) {
      host.onIntent({ kind: 'tap', at, button: 'primary' });
    }
  };

  const onPointerUp = (event: PointerEvent) => finish(event, false);
  const onPointerCancel = (event: PointerEvent) => finish(event, true);
  const onPointerLeave = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) host.onIntent({ kind: 'leave' });
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = host.element.getBoundingClientRect();
    host.onIntent({
      kind: 'zoom',
      factor: Math.pow(WHEEL_STEP, -event.deltaY),
      anchor: { x: event.clientX - rect.left, y: event.clientY - rect.top },
    });
  };
  const onContextMenu = (event: MouseEvent) => event.preventDefault();
  const onKeyDown = (event: KeyboardEvent) => {
    // Ignore keys typed into UI fields (the UI owns those).
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    host.onIntent({ kind: 'key', key: event.key });
  };

  host.element.addEventListener('pointerdown', onPointerDown);
  host.element.addEventListener('pointermove', onPointerMove);
  host.element.addEventListener('pointerup', onPointerUp);
  host.element.addEventListener('pointercancel', onPointerCancel);
  host.element.addEventListener('pointerleave', onPointerLeave);
  host.element.addEventListener('wheel', onWheel, { passive: false });
  host.element.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    for (const state of pointers.values()) clearTimer(state);
    pointers.clear();
    host.element.removeEventListener('pointerdown', onPointerDown);
    host.element.removeEventListener('pointermove', onPointerMove);
    host.element.removeEventListener('pointerup', onPointerUp);
    host.element.removeEventListener('pointercancel', onPointerCancel);
    host.element.removeEventListener('pointerleave', onPointerLeave);
    host.element.removeEventListener('wheel', onWheel);
    host.element.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
  };
}
