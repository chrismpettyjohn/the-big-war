/**
 * The UI-facing store: the one place `src/session` and `src/ui` talk to.
 *
 * WHAT THIS FILE IS
 * A tiny observable wrapper around the mutable `GameState`. Solid components
 * read plain fields off `store.state` and wrap the ones they render in a getter
 * that first reads `store.version()`; the store bumps `version` once per frame
 * after stepping the sim. See ARCHITECTURE.md §UI observation for why a single
 * version signal (rather than deep proxies) is the right call at this scale.
 *
 * WHAT THIS FILE IS NOT
 * No rendering, no input, no match rules. Stepping the sim is `engine.step`
 * (fixed timestep); starting a match is `MatchFactory` (setup.ts, gameplay
 * engineer) — this file only orchestrates them.
 */

import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import { step, FIXED_DT } from './engine';
import { dispatch } from './commands';
import type { Command, CommandResult } from './commands';
import { createBot, botTick } from './bot';
import type { Bot } from './bot';
import { DEFAULT_GAME_CONFIG } from './config';
import { createDevState } from './devstate';
import type { GameConfig, GameSpeed, GameState, MatchStatus } from './types';

/**
 * Builds a fresh match state. The real implementation lives with the gameplay
 * code (`src/game/setup.ts` → `createInitialState`); until it exists the store
 * falls back to the throwaway `createDevState`. Signature mirrors
 * `CreateState` in types.ts so swapping it is a one-line change.
 */
export type MatchFactory = (config: GameConfig) => GameState;

/**
 * The store surface consumed by `src/session` and `src/ui`. Nothing else in the
 * app may mutate the sim or advance time.
 */
export interface GameStore {
  /** Live `GameState`. Read fields freely; never mutate from UI code. */
  readonly state: GameState;
  /** Bumped once per advance (per rendered frame) — the Solid change token. */
  readonly version: Accessor<number>;
  /**
   * Apply a command from the player or a bot. Returns the result so the caller
   * can show a toast/highlight; invalid commands never throw.
   */
  dispatch(command: Command): CommandResult;
  /**
   * Advance the simulation by `dtSeconds` of REAL time. Multiplied by
   * `state.speed` and consumed in whole `FIXED_DT` steps, so gameplay is
   * frame-rate independent and game speed is a pure multiplier.
   */
  step(dtSeconds: number): void;
  /** Replace the whole state (match start / return to menu). Bumps version. */
  reset(state: GameState, factory?: MatchFactory): void;
  /** Create a fresh match with the given config (defaults to DEFAULT_GAME_CONFIG). */
  startMatch(config?: GameConfig): void;
  /** Tear the match down and go back to the menu. */
  returnToMenu(): void;
  /** Pause/resume; a paused store ignores `step`'s time (version still bumps). */
  setPaused(paused: boolean): void;
  readonly paused: Accessor<boolean>;
  /** Change game speed. */
  setSpeed(speed: GameSpeed): void;
  /** Match phase: menu / playing / ended. */
  readonly status: Accessor<MatchStatus>;
  /** Winner id when the match ended, else null. */
  readonly winner: Accessor<number | null>;
}

/** Options for `createGameStore` — lets `session`/tests inject a match factory. */
export interface StoreOptions {
  /** Defaults to `createDevState` until `setup.ts` lands. */
  readonly createMatch?: MatchFactory;
  /** Defaults to `DEFAULT_GAME_CONFIG`. */
  readonly config?: GameConfig;
  /** When true, starts in the menu with a dev state available for previews. */
  readonly startInMenu?: boolean;
}

/**
 * Maximum game-time (in seconds) the accumulator may consume in ONE `step`
 * call. Prevents a backgrounded tab (or a long GC pause) from simulating minutes
 * of game time in a single frame. Frame loops call `step` at ~60 Hz, so the
 * normal per-call budget is far below this; the clamp only bites after a stall.
 */
export const MAX_GAME_SECONDS_PER_STEP = 0.25;

/**
 * Create the store. One per app instance (module-level singleton in app code:
 * `main.tsx`/`session` creates it and passes it down). Never re-created during
 * a match.
 */
export function createGameStore(options: StoreOptions = {}): GameStore {
  const factory: MatchFactory = options.createMatch ?? createDevState;
  const config = options.config ?? DEFAULT_GAME_CONFIG;

  // The boot state is a dev state in the 'menu' phase so a preview render works
  // before a match starts. `startMatch` swaps in the real factory's state.
  const bootState = factory(config);
  if (options.startInMenu ?? true) bootState.status = 'menu';

  let current = bootState;
  const [version, setVersion] = createSignal(0);
  const [paused, setPausedSignal] = createSignal(false);

  /** Real-time accumulator for the fixed timestep. Not part of GameState. */
  let accumulator = 0;
  const bump = (): void => {
    setVersion(v => v + 1);
  };

  /**
   * Bots for the current match, one per non-human empire. Rebuilt by `attach`
   * whenever a fresh state replaces `current`, so a bot's private rng and
   * personality are stable for the whole match but never leak across matches
   * (`createBot` derives both from the match seed + empire id).
   */
  let bots: readonly Bot[] = [];
  const attachBots = (state: GameState): void => {
    bots = state.empires
      .filter(empire => !empire.isHuman)
      .map(empire => createBot({ empire: empire.id, seed: state.config.map.seed }));
    state.botAccumulator = 0;
  };
  attachBots(current);

  /**
   * Run every bot once, in empire-id order (stable, so replays match), and
   * dispatch whatever commands they return through the ordinary command bus.
   * A rejected command is dropped — the bot simply retries on its next tick.
   */
  const runBots = (dt: number): void => {
    for (const bot of bots) {
      if (!current.empires[bot.empire]?.alive) continue;
      for (const command of botTick(bot, current, dt)) {
        dispatch(current, command);
      }
    }
  };

  const advance = (dtSeconds: number): void => {
    if (current.status !== 'playing' || paused()) return;
    accumulator += Math.max(0, dtSeconds) * current.speed;
    // Guard against a tab-switch spiral of death: never more than
    // MAX_GAME_SECONDS_PER_STEP of game time per advance call.
    accumulator = Math.min(accumulator, MAX_GAME_SECONDS_PER_STEP);
    while (accumulator >= FIXED_DT) {
      accumulator -= FIXED_DT;
      step(current, FIXED_DT);
      // Bots think on game time, not frames: one batch of decisions per
      // `config.bot.tickSeconds` of simulated time, so speed multipliers and
      // frame-rate changes never alter AI cadence.
      current.botAccumulator += FIXED_DT;
      if (current.botAccumulator >= current.config.bot.tickSeconds) {
        const elapsed = current.botAccumulator;
        current.botAccumulator = 0;
        runBots(elapsed);
      }
    }
  };

  return {
    get state() {
      return current;
    },
    version,
    dispatch(command: Command): CommandResult {
      const result = dispatch(current, command);
      // Any accepted command changes what the UI should show.
      if (result.ok) bump();
      return result;
    },
    step(dtSeconds: number): void {
      advance(dtSeconds);
      bump();
    },
    reset(next: GameState): void {
      current = next;
      accumulator = 0;
      attachBots(current);
      bump();
    },
    startMatch(nextConfig?: GameConfig): void {
      const state = factory(nextConfig ?? config);
      state.status = 'playing';
      current = state;
      accumulator = 0;
      attachBots(current);
      setPausedSignal(false);
      bump();
    },
    returnToMenu(): void {
      const state = factory(config);
      state.status = 'menu';
      current = state;
      accumulator = 0;
      attachBots(current);
      setPausedSignal(false);
      bump();
    },
    setPaused(next: boolean): void {
      setPausedSignal(next);
      bump();
    },
    paused,
    setSpeed(speed: GameSpeed): void {
      current.speed = speed;
      bump();
    },
    status: () => current.status,
    winner: () => current.winner,
  };
}

/**
 * App-wide store singleton. `src/session` owns the lifecycle; `src/ui` and
 * controllers import this accessor. Kept as a lazy function (not a module-level
 * const) so tests can build isolated stores with `createGameStore`.
 */
let singleton: GameStore | null = null;

/** Get (or lazily create) the app singleton store. */
export function gameStore(): GameStore {
  if (!singleton) singleton = createGameStore();
  return singleton;
}

/** Test/session hook: replace the singleton (returns the previous one). */
export function setGameStore(store: GameStore | null): GameStore | null {
  const previous = singleton;
  singleton = store;
  return previous;
}
