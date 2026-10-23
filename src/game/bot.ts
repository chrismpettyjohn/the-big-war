/**
 * Bots — AI opponents driven through the SAME command bus as the player.
 *
 * A bot never mutates `GameState` directly. Each tick it inspects a read-only
 * view of the state and returns a list of `Command`s; the store dispatches them
 * (see store.step). That keeps bots replayable, testable, and impossible to
 * use for cheating that the player couldn't do.
 *
 * Determinism: each bot owns a private rng seeded from the match seed and its
 * empire id, so bot behaviour is reproducible and independent of iteration
 * order across bots.
 */

import { createRng } from './rng';
import type { Rng } from './rng';
import type { Command } from './commands';
import type { EmpireId, GameState } from './types';

/** Personality: where the bot spends its attention. Values are0..1. */
export interface BotPersonality {
  /** 0 = turtle,1 = always pressing an attack. */
  readonly aggression: number;
  /** 0 = all-in military,1 = build markets/farms/labs first. */
  readonly economy: number;
  /** Optional flair,0..1 — how much the bot values expansion over turtling. */
  readonly expansion?: number;
}

/** Named preset personalities, picked per bot slot at match creation. */
export const BOT_PERSONALITIES: readonly BotPersonality[] = [
  { aggression: 0.3, economy: 0.7, expansion: 0.5 },
  { aggression: 0.6, economy: 0.4, expansion: 0.5 },
  { aggression: 0.85, economy: 0.2, expansion: 0.7 },
  { aggression: 0.5, economy: 0.5, expansion: 0.3 },
];

/** A bot instance: plain data + a frozen decision function. */
export interface Bot {
  readonly empire: EmpireId;
  readonly personality: BotPersonality;
  /** Private rng — never shares `state.rng`, so bot order can't perturb the sim. */
  readonly rng: Rng;
}

/** Options for createBot. */
export interface BotOptions {
  readonly empire: EmpireId;
  /** Match seed; the bot derives a stable private seed from it + empire id. */
  readonly seed: number;
  readonly personality?: BotPersonality;
}

/**
 * Create a bot for `empire`.
 *
 * TODO(ICT3-A): pick a personality deterministically from `seed`/`empire` when
 * one is not supplied (e.g. `BOT_PERSONALITIES[(seed + empire) % length]`).
 * Keep the derivation simple and documented — integration recipes may rely on
 * a specific bot being aggressive.
 */
export function createBot(options: BotOptions): Bot {
  const personality =
    options.personality ?? BOT_PERSONALITIES[options.empire % BOT_PERSONALITIES.length]!;
  return {
    empire: options.empire,
    personality,
    rng: createRng(options.seed + options.empire * 0x9e3779b9),
  };
}

/**
 * Decide what this bot does this tick.
 *
 * Returned commands are dispatched by the caller in order; a rejected command
 * is simply ignored (the bot retries next tick).
 *
 * TODO(ICT3-A): implement the decision loop — typical shape:
 * 1. Build if affordable and a good site exists (`PlaceBuilding`), weighted by
 *    `personality.economy` (markets/farms/labs) vs military buildings.
 * 2. Start research when science is banked (`StartResearch`).
 * 3. Send troops on a nearby hostile edge (`SendTroops`) when aggression and
 *    reserve permit; prefer weak defenders/undefended hexes.
 * 4. Decide defend-vs-counterattack mode per front (`SetFrontMode`).
 * 5. Occasionally upgrade a city.
 * Budget the work: this runs every `state.config.bot.tickSeconds` of game time.
 */
export function botTick(bot: Bot, state: GameState, dt: number): Command[] {
  void bot;
  void state;
  void dt;
  return [];
}
