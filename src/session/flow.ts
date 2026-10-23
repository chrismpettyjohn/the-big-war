/**
 * Match flow: menu → faction picker → match → end screen.
 *
 * The store already owns "start a match / go back to the menu"; this module adds
 * the *settings* the player chooses in the menu (empire count, map size, speed,
 * time limit) and turns them into a `GameConfig`, plus the small amount of state
 * the shell needs to render the right screen.
 *
 * Kept separate from `main.tsx` so the shell stays a thin composition root and
 * this logic is testable without a DOM.
 */

import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import { DEFAULT_GAME_CONFIG, FACTIONS } from '../game/config';
import type { GameConfig } from '../game/types';

export type Screen = 'menu' | 'faction' | 'match' | 'end';

export type MapSize = 'small' | 'medium' | 'large';

export interface MatchSettings {
  readonly empires: number;
  readonly mapSize: MapSize;
  readonly speed: 1 | 2 | 4;
  readonly timeLimitMinutes: number;
  readonly seed: number;
}

const MAP_SIZES: Readonly<Record<MapSize, { readonly width: number; readonly height: number }>> = {
  // 40*24 = 960 hexes, 56*32 = 1792, 72*42 = 3024 (the stated perf target).
  small: { width: 40, height: 24 },
  medium: { width: 56, height: 32 },
  large: { width: 72, height: 42 },
};

export const MAP_SIZE_ORDER: readonly MapSize[] = ['small', 'medium', 'large'];

export const MIN_EMPIRES = 2;
export const MAX_EMPIRES = 8;
export const TIME_LIMIT_OPTIONS: readonly number[] = [5, 10, 15, 20];

/** Default settings match the shipped game: medium map, 15 minutes, normal speed. */
export function defaultSettings(seed = Math.floor(Math.random() * 1_000_000)): MatchSettings {
  return { empires: 4, mapSize: 'medium', speed: 1, timeLimitMinutes: 15, seed };
}

/** Turn menu settings into the immutable config a match runs with. */
export function configFromSettings(settings: MatchSettings): GameConfig {
  const size = MAP_SIZES[settings.mapSize];
  return {
    ...DEFAULT_GAME_CONFIG,
    map: { width: size.width, height: size.height, hexSize: DEFAULT_GAME_CONFIG.map.hexSize, seed: settings.seed },
    start: { ...DEFAULT_GAME_CONFIG.start, empireCount: clampEmpires(settings.empires) },
    timeLimitSeconds: settings.timeLimitMinutes * 60,
  };
}

export function clampEmpires(count: number): number {
  return Math.min(MAX_EMPIRES, Math.max(MIN_EMPIRES, Math.round(count)));
}

/** Faction ids the bots are handed (the human picks theirs in the picker). */
export function botFactionIds(count: number, playerFactionId: string, rng: () => number): string[] {
  const pool = FACTIONS.filter(faction => faction.id !== playerFactionId).map(faction => faction.id);
  const picks: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(rng() * pool.length) % Math.max(1, pool.length);
    picks.push(pool[index] ?? FACTIONS[0]!.id);
  }
  return picks;
}

export interface MatchFlow {
  readonly screen: Accessor<Screen>;
  readonly settings: Accessor<MatchSettings>;
  readonly playerFaction: Accessor<string>;
  readonly lastResult: Accessor<{ readonly winner: number | null; readonly playerWon: boolean } | null>;

  openFactionPicker(): void;
  backToMenu(): void;
  updateSettings(patch: Partial<MatchSettings>): void;
  chooseFaction(factionId: string): void;
  /** Called by the shell once the store has started the match. */
  enterMatch(): void;
  /** Called when `store.status()` becomes 'ended'. */
  showResult(winner: number | null, playerEmpire: number): void;
}

/**
 * `random` is injectable so tests are deterministic; the browser passes
 * `Math.random` by default.
 */
export function createMatchFlow(random: () => number = Math.random): MatchFlow {
  const [screen, setScreen] = createSignal<Screen>('menu');
  const [settings, setSettings] = createSignal<MatchSettings>(defaultSettings(Math.floor(random() * 1_000_000)));
  const [playerFaction, setPlayerFaction] = createSignal(FACTIONS[0]!.id);
  const [lastResult, setLastResult] = createSignal<MatchFlow['lastResult'] extends Accessor<infer T> ? T : never>(null);

  return {
    screen,
    settings,
    playerFaction,
    lastResult,
    openFactionPicker: () => setScreen('faction'),
    backToMenu: () => setScreen('menu'),
    updateSettings: patch => setSettings(current => ({ ...current, ...patch })),
    chooseFaction: factionId => {
      setPlayerFaction(factionId);
    },
    enterMatch: () => setScreen('match'),
    showResult: (winner, playerEmpire) => {
      setLastResult({ winner, playerWon: winner === playerEmpire });
      setScreen('end');
    },
  };
}
