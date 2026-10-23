/**
 * Controllers: the layer that turns input intents into game commands.
 *
 * It owns the small amount of UI state that is about *the player's attention*
 * rather than about the world: the selected hex, the current tool (idle / place
 * building / aim cannon), the troop percentage on the slider, and where the
 * context menu is open. Nothing here mutates `GameState` — everything goes
 * through `store.dispatch` (see ARCHITECTURE.md §3).
 *
 * Priority order for a tap (this is the game's core interaction, per the manual):
 *   1. an active tool (placing a building / aiming a cannon) consumes the tap
 *   2. your own hex            → select it (opens the hex panel)
 *   3. foreign land            → send troops at the slider percentage
 *   4. neutral/unclaimed land  → select it (inspect)
 */

import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Axial, Pixel } from '../game/hex';
import { distance, gridAt, neighbors, pixelToHex } from '../game/hex';
import type { BuildingKind, EmpireId, FrontId } from '../game/types';
import type { GameStore } from '../game/store';
import type { CommandError } from '../game/types';

/** What the next map click will do. */
export type Tool =
  | { readonly kind: 'idle' }
  | { readonly kind: 'place'; readonly building: BuildingKind }
  | { readonly kind: 'cannon'; readonly from: Axial };

export interface ContextMenuState {
  readonly at: Pixel;
  readonly hex: Axial;
}

/** A rejected command, surfaced to the UI as a toast/red hint. */
export interface CommandNotice {
  readonly id: number;
  readonly reason: CommandError;
}

export interface Controllers {
  readonly selectedHex: Accessor<Axial | null>;
  readonly hoverHex: Accessor<Axial | null>;
  readonly tool: Accessor<Tool>;
  readonly troopPercent: Accessor<number>;
  readonly contextMenu: Accessor<ContextMenuState | null>;
  readonly notices: Accessor<readonly CommandNotice[]>;

  selectHex(hex: Axial | null): void;
  setHover(hex: Axial | null): void;
  setTroopPercent(percent: number): void;
  setTool(tool: Tool): void;
  cancelTool(): void;
  openContextMenu(at: Pixel, hex: Axial): void;
  closeContextMenu(): void;

  /** Hex under a screen point, or null when off-map. */
  hexAtScreen(at: Pixel): Axial | null;

  /** Main interaction: interpret a tap. Returns true when it was consumed. */
  tap(at: Pixel, button: 'primary' | 'secondary'): void;
  /** Right-click / long-press on a foreign hex: quick-action menu. */
  secondary(at: Pixel): void;
  /** Keyboard shortcuts: space (pause), 1/2/4 (speed), escape (cancel tool). */
  key(key: string): void;
  /** Report a rejected command so the UI can show why. */
  notice(reason: CommandError): void;
  dismissNotice(id: number): void;
}

export interface ControllerDeps {
  readonly store: GameStore;
  /** Viewport size in canvas-local px (for zoom anchoring). */
  readonly viewport: () => Pixel;
  /**
   * Canvas-local point → hex. The session owns this so the controllers never
   * need to know whether the renderer works in client or local coordinates;
   * `runtime.ts` supplies `world.screenToHex` adapted to the host's offset.
   */
  readonly screenToHex: (at: Pixel) => Axial | null;
  /** Called when the player commits troops so the UI can flash the front. */
  readonly onTroopsSent?: (from: Axial, target: Axial) => void;
  /** Cannon aim mode needs to draw a range ring from this hex. */
  readonly onToolChanged?: (tool: Tool) => void;
}

let noticeId = 0;

export function createControllers(deps: ControllerDeps): Controllers {
  const { store } = deps;
  const [selectedHex, setSelectedHex] = createSignal<Axial | null>(null);
  const [hoverHex, setHoverHex] = createSignal<Axial | null>(null);
  const [tool, setToolSignal] = createSignal<Tool>({ kind: 'idle' });
  const [troopPercent, setTroopPercentSignal] = createSignal(50);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(null);
  const [notices, setNotices] = createSignal<readonly CommandNotice[]>([]);

  const state = () => store.state;
  const player = (): EmpireId => state().playerEmpire;

  const notice = (reason: CommandError) => {
    const entry: CommandNotice = { id: ++noticeId, reason };
    setNotices(current => [...current, entry]);
    setTimeout(() => {
      setNotices(current => current.filter(item => item.id !== entry.id));
    }, 2600);
  };

  const dismissNotice = (id: number) => setNotices(current => current.filter(item => item.id !== id));

  const hexAtScreen = (at: Pixel): Axial | null => deps.screenToHex(at);

  const own = (hex: Axial): boolean => gridAt(state().grid, hex)?.owner === player();
  const foreign = (hex: Axial): boolean => {
    const cell = gridAt(state().grid, hex);
    return !!cell && cell.owner !== player() && cell.terrain !== 'water';
  };

  /** The adjacent own hex from which an attack on `target` makes sense. */
  const attackFromFor = (target: Axial): Axial | null => {
    for (const candidate of neighbors(target)) {
      if (gridAt(state().grid, candidate)?.owner === player()) return candidate;
    }
    return null;
  };

  /** Click a foreign hex: commit `troopPercent`% of the free reserve. */
  const sendTroops = (target: Axial) => {
    const from = attackFromFor(target);
    if (!from) {
      notice('invalid_target');
      return;
    }
    const result = store.dispatch({
      type: 'SendTroops',
      empire: player(),
      hex: from,
      target,
      percent: troopPercent(),
      intent: 'attack',
    });
    if (result.ok) deps.onTroopsSent?.(from, target);
    else notice(result.reason);
  };

  const placeBuilding = (hex: Axial, building: BuildingKind) => {
    const result = store.dispatch({ type: 'PlaceBuilding', empire: player(), hex, kind: building });
    if (result.ok) setToolSignal({ kind: 'idle' });
    else notice(result.reason);
  };

  const fireCannon = (from: Axial, target: Axial) => {
    const result = store.dispatch({ type: 'FireCannon', empire: player(), from, target });
    if (result.ok) setToolSignal({ kind: 'idle' });
    else notice(result.reason);
  };

  const selectHex = (hex: Axial | null) => {
    setSelectedHex(hex);
    setContextMenu(null);
  };

  const setTool = (next: Tool) => {
    setToolSignal(next);
    deps.onToolChanged?.(next);
  };

  const cancelTool = () => {
    if (tool().kind !== 'idle') setTool({ kind: 'idle' });
    else setSelectedHex(null);
    setContextMenu(null);
  };

  const tap = (at: Pixel, button: 'primary' | 'secondary') => {
    setContextMenu(null);
    const hex = hexAtScreen(at);
    if (!hex) {
      setSelectedHex(null);
      return;
    }

    if (button === 'secondary') {
      secondary(at);
      return;
    }

    const active = tool();
    if (active.kind === 'place') {
      placeBuilding(hex, active.building);
      return;
    }
    if (active.kind === 'cannon') {
      if (distance(active.from, hex) > state().config.cannon.range) {
        notice('invalid_target');
        return;
      }
      fireCannon(active.from, hex);
      return;
    }

    if (own(hex)) {
      selectHex(hex);
      return;
    }
    if (foreign(hex)) {
      sendTroops(hex);
      return;
    }
    selectHex(hex);
  };

  const secondary = (at: Pixel) => {
    const hex = hexAtScreen(at);
    if (!hex) return;
    setSelectedHex(hex);
    setContextMenu({ at, hex });
  };

  const key = (pressed: string) => {
    if (pressed === 'Escape') {
      cancelTool();
      return;
    }
    if (pressed === ' ') {
      store.setPaused(!store.paused());
      return;
    }
    if (pressed === '1') store.setSpeed(1);
    if (pressed === '2') store.setSpeed(2);
    if (pressed === '4') store.setSpeed(4);
  };

  return {
    selectedHex,
    hoverHex,
    tool,
    troopPercent,
    contextMenu,
    notices,
    selectHex,
    setHover: setHoverHex,
    setTroopPercent: percent => setTroopPercentSignal(Math.round(Math.min(100, Math.max(1, percent)))),
    setTool,
    cancelTool,
    openContextMenu: (at, hex) => {
      setSelectedHex(hex);
      setContextMenu({ at, hex });
    },
    closeContextMenu: () => setContextMenu(null),
    hexAtScreen,
    tap,
    secondary,
    key,
    notice,
    dismissNotice,
  };
}

/** Front id helpers the context menu needs (read-only, no mutation). */
export function frontsTouching(state: { readonly fronts: readonly { readonly id: FrontId; readonly hexA: Axial; readonly hexB: Axial }[] }, hex: Axial): FrontId[] {
  return state.fronts
    .filter(
      front =>
        (front.hexA.q === hex.q && front.hexA.r === hex.r) ||
        (front.hexB.q === hex.q && front.hexB.r === hex.r),
    )
    .map(front => front.id);
}

/** Re-exported so the UI can build a nice hex label without importing game modules. */
export { pixelToHex };
