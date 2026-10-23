/**
 * Dev-only preview entry for the world renderer.
 *
 * Not part of the shipped app: it renders `createDevState()` so the PIXI layers
 * can be eyeballed without touching `src/main.tsx`. Served by Vite at
 * `/dev/preview.html` (any HTML under the project root is a Vite entry).
 *
 * It also drives a minimal camera (drag to pan, wheel to zoom), a hover
 * highlight, and a pulsing demo selection so overlay/FX code paths are visible.
 */

import '../ui/kit/tokens.css';
import { createDevState } from '../game/devstate';
import { DEFAULT_GAME_CONFIG } from '../game/config';
import type { Axial } from '../game/hex';
import { createWorld } from './world';

const host = document.getElementById('world');
const hud = document.getElementById('hud');

if (!host) {
  throw new Error('devPreview: #world host missing');
}

const state = createDevState(DEFAULT_GAME_CONFIG);
const world = createWorld({ host, initialScale: 0.9, background: 0x0c0e11 });

void world.init().then(() => {
  // Centre the camera on the map.
  const { hexSize, width, height } = state.config.map;
  const centerX = hexSize * (Math.sqrt(3) * (width / 2) + (Math.sqrt(3) / 2) * (height / 2));
  const centerY = hexSize * 1.5 * (height / 2);
  world.camera.set({
    x: centerX - world.size.width / (2 * 0.9),
    y: centerY - world.size.height / (2 * 0.9),
    scale: 0.9,
  });

  // A demo selection so the selection outline + cannon ring are visible.
  const demoHex: Axial = { q: Math.floor(width / 2), r: Math.floor(height / 2) };
  world.setOverlay({ selected: demoHex, cannonFrom: demoHex, cannonTarget: { q: demoHex.q + 3, r: demoHex.r } });

  // Drag to pan, wheel to zoom (the real session owns this; this is a smoke UI).
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  host.addEventListener('pointerdown', event => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener('pointermove', event => {
    if (dragging) {
      world.camera.x -= (event.clientX - lastX) / world.camera.scale;
      world.camera.y -= (event.clientY - lastY) / world.camera.scale;
      lastX = event.clientX;
      lastY = event.clientY;
    }
    const hex = world.screenToHex(event.clientX, event.clientY);
    world.setOverlay({ hovered: hex });
  });
  host.addEventListener('pointerup', event => {
    dragging = false;
    host.releasePointerCapture?.(event.pointerId);
  });
  host.addEventListener(
    'wheel',
    event => {
      event.preventDefault();
      // zoomBy takes canvas-local coords; the host fills the viewport so its rect
      // origin is what we subtract.
      const rect = host.getBoundingClientRect();
      world.camera.zoomBy(
        event.deltaY < 0 ? 1.1 : 1 / 1.1,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    { passive: false },
  );

  let frames = 0;
  let lastHud = performance.now();
  const tick = (): void => {
    world.render(state);
    frames += 1;
    const now = performance.now();
    if (now - lastHud > 500) {
      const fps = (frames * 1000) / (now - lastHud);
      const hovered = world.screenToHex(world.size.width / 2, world.size.height / 2);
      if (hud) {
        hud.textContent = `fps ${fps.toFixed(0)} · map ${width}×${height} · hex ${hexSize} · scale ${world.camera.scale.toFixed(2)} · centre hex ${hovered.q},${hovered.r}`;
      }
      frames = 0;
      lastHud = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Fire a demo FX burst at the selection every couple of seconds.
  setInterval(() => {
    world.spawnFx('cannonPuff', demoHex);
    world.spawnFx('captureFlash', { q: demoHex.q + 1, r: demoHex.r });
  }, 1800);
});
