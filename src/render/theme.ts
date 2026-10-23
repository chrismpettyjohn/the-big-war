/**
 * Render-side colour + shape vocabulary for the world layer.
 *
 * Single source of truth: the faction palette and the sea colour are read from
 * the CSS custom properties in `src/ui/kit/tokens.css` at module-load time (once,
 * via `getComputedStyle(document.documentElement)`), so a hex in PIXI and a swatch
 * in the overlay UI are guaranteed to be the same colour. Hardcoded fallbacks
 * mirror `tokens.css` exactly so this module still works before styles are loaded
 * (tests, the dev preview, or a headless smoke check).
 *
 * Colours are PIXI-usable 0xRRGGBB numbers. Everything here is presentation only;
 * nothing in this file touches sim state.
 */

import type { Terrain } from '../game/types';

/** Parse `#rgb`, `#rrggbb`, or `rgb(a, b, c)` into a 0xRRGGBB number. */
export function parseCssColor(value: string): number | null {
  const text = value.trim();
  if (text.length === 0) return null;
  if (text.startsWith('#')) {
    const hex = text.slice(1);
    if (hex.length === 3) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      if (r === undefined || g === undefined || b === undefined) return null;
      return (parseInt(r + r, 16) << 16) | (parseInt(g + g, 16) << 8) | parseInt(b + b, 16);
    }
    if (hex.length === 6 || hex.length === 8) {
      const value6 = parseInt(hex.slice(0, 6), 16);
      return Number.isNaN(value6) ? null : value6;
    }
    return null;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(text);
  if (rgb) {
    const r = Math.round(Number(rgb[1]));
    const g = Math.round(Number(rgb[2]));
    const b = Math.round(Number(rgb[3]));
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  }
  return null;
}

/** Read a CSS custom property off `:root`, falling back when unset/unparseable. */
function cssVar(name: string, fallback: number): number {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const root = document.documentElement;
  if (!root) return fallback;
  const raw = getComputedStyle(root).getPropertyValue(name);
  return parseCssColor(raw) ?? fallback;
}

/* --------------------------------------------------------------- palette ---- */

/**
 * Fallbacks duplicate `tokens.css` verbatim. Keep these in sync if the kit
 * palette ever changes — but the live values always come from the CSS vars, so
 * the map cannot drift from the UI in a running app.
 */
const FACTION_FALLBACKS: readonly number[] = [
  0xe0523c, 0x4a9de0, 0x7bc95a, 0xd8b24a, 0xb06fd8, 0x4ec9b0, 0xe07ab5, 0x9b9b9b,
];

/** `--street-map-sea` (#1f3342). */
const SEA_FALLBACK = 0x1f3342;

/** Empire colour slot → 0xRRGGBB. Index clamps into the 8-slot palette. */
export const FACTION_COLORS: readonly number[] = FACTION_FALLBACKS.map((fallback, index) =>
  cssVar(`--faction-${index}`, fallback),
);

/** Deep water fill colour (`--street-map-sea`). */
export const SEA_COLOR = cssVar('--street-map-sea', SEA_FALLBACK);

/** Colour for hexes with no owner (NEUTRAL_OWNER). */
export const NEUTRAL_COLOR = 0x3a4148;

/** Terrain tint applied over the owner fill for each non-plain terrain. */
export const TERRAIN_TINTS: Readonly<Record<Terrain, number>> = {
  plain: 0x000000,
  forest: 0x1d4a2a,
  mountain: 0x4d4a44,
  water: SEA_COLOR,
};

/** How strongly the owner colour reads on each terrain (water ignores owner). */
export const TERRAIN_FILL_MIX: Readonly<Record<Terrain, number>> = {
  plain: 1.0,
  forest: 0.72,
  mountain: 0.6,
  water: 0.0,
};

/* ------------------------------------------------------------------ shape ---- */

/** Subtle per-hex brightness jitter so large fields read as terrain, not flat fill. */
export const HEX_SHADE_MIN = -0.06;
export const HEX_SHADE_MAX = 0.06;

/** Border strokes. */
export const HEX_BORDER_WIDTH = 1;
export const HEX_BORDER_DARKEN = 0.55;
export const NEUTRAL_BORDER_COLOR = 0x2a2f34;

/** Contested/front edge marker. */
export const FRONT_EDGE_COLOR = 0xff6a3d;
export const FRONT_EDGE_WIDTH = 2.5;

/** Selection + hover outlines. */
export const SELECTION_COLOR = 0xffffff;
export const SELECTION_WIDTH = 3;
export const HOVER_COLOR = 0xf0f0f0;
export const HOVER_WIDTH = 1.5;

/** Overlay accents reused from the kit semantics. */
export const ACCENT_COLOR = 0xf0c850;
export const DANGER_COLOR = 0xe03232;
export const INFO_COLOR = 0x5db6e5;
export const SUCCESS_COLOR = 0x72cc72;

/** Dimming for buildings that are being demolished. */
export const DEMOLISH_DIM = 0.35;

/**
 * Return the 0xRRGGBB fill colour for an owner id, clamping into the palette.
 * Neutral (negative) owners get `NEUTRAL_COLOR`.
 */
export function ownerColor(owner: number): number {
  if (owner < 0) return NEUTRAL_COLOR;
  const color = FACTION_COLORS[owner % FACTION_COLORS.length];
  return color ?? NEUTRAL_COLOR;
}

/** Mix two 0xRRGGBB colours; `t` 0 → `a`, 1 → `b`. Allocation-free. */
export function mixColor(a: number, b: number, t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = (ar + (br - ar) * clamped) | 0;
  const g = (ag + (bg - ag) * clamped) | 0;
  const bl = (ab + (bb - ab) * clamped) | 0;
  return (r << 16) | (g << 8) | bl;
}

/** Scale a colour's brightness by `factor` (1 = unchanged), clamped to 0..255. */
export function shadeColor(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

/**
 * Deterministic per-hex brightness factor in [1+MIN, 1+MAX], from a cheap hash
 * of (q, r). Stable across frames and machines so the terrain does not shimmer.
 */
export function hexShade(q: number, r: number): number {
  // Integer hash (Wang-style mix) kept in 32-bit range, folded to [0, 1).
  let h = (q * 374761393 + r * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  const unit = h / 0xffffffff;
  return 1 + HEX_SHADE_MIN + unit * (HEX_SHADE_MAX - HEX_SHADE_MIN);
}
