/**
 * The simulation tick. Fixed timestep, deterministic, no DOM/PIXI/Solid.
 *
 * Ordering contract (the gameplay engineer fills in the bodies; the ORDER is
 * frozen because it is the one thing that is expensive to change later):
 *
 *   1. economy      — gold/science/civilian growth, farm growth, building upkeep
 *   2. research     — advance the active node's progress; complete at1
 *   3. recruitment  — civilians → soldiers up to the reserve cap
 *   4. cannon       — decrement cannon reloads (+ resolve queued shots if not
 *                     already applied by the FireCannon command)
 *   5. combat       — refresh front modifiers, resolve losses, capture hexes
 *   6. housekeeping — front idle/collapse rules, building demolitions, hexCount,
 *                     elimination; mark it clean so the renderer can rebuild
 *   7. win check    — last standing / 75% land / time limit
 *
 * Determinism rules:
 * - `step` must not read `Math.random()`; use `state.rng`.
 * - Iteration order is array order (never object key order) so two runs with
 *   the same seed and commands produce identical state.
 * - `dt` is fixed (`FIXED_DT`) — the caller (store.step) feeds whole fixed
 *   steps, never a variable frame delta.
 */

import type { GameState } from './types';

/**
 * Fixed simulation timestep in game seconds. The renderer may run at any frame
 * rate; the store consumes accumulated real time in whole `FIXED_DT` steps and
 * multiplies by `state.speed` (see ARCHITECTURE.md §loop).
 */
export const FIXED_DT = 1 / 30;

/**
 * Advance the simulation by one fixed tick.
 *
 * Implemented here: `elapsed`/`tick` bookkeeping and the stage pipeline order.
 * The stage bodies are owned by the gameplay engineer — each carries a
 * `TODO(ICT3-A)` naming the config it reads and the state it must touch.
 */
export function step(state: GameState, dt: number = FIXED_DT): void {
  if (state.status !== 'playing') return;

  state.elapsed += dt;
  state.tick += 1;

  stepEconomy(state, dt); // 1
  stepResearch(state, dt); // 2
  stepRecruitment(state, dt); // 3
  stepBuildings(state, dt); // 4: cannon reload timers, demolition timers
  stepCombat(state, dt); // 5
  stepHousekeeping(state, dt); // 6
  checkWinConditions(state); // 7
}

/* --------------------------------------------------------- 1. economy -- */

/**
 * Gold from markets/lumberjacks/miners, science from labs, civilian growth from
 * cities/farms, farm field growth, and the civilian balance (`civilianBalance`)
 * used by the worker-scarcity tooltip.
 *
 * TODO(ICT3-A): read `state.config.economy`, `state.config.support` and
 * `empire.bonuses` via `resolveModifier` (config.ts). Workers available =
 * min(civilians, jobs); when workers < jobs, scale building output AND bonuses
 * (this is the "recruitment outpaces growth" penalty). Never let civilians go
 * negative. Lumberjack/miner placement bonuses use `lumberjackRadius`/
 * `minerRadius` over `neighbors`/`area` (hex.ts).
 */
function stepEconomy(state: GameState, dt: number): void {
  void state;
  void dt;
}

/* -------------------------------------------------------- 2. research -- */

/**
 * Advance `empire.research.active.progress` by dt / node.duration; on reaching1
 * call `completeResearch(state, empireId)` (research.ts).
 *
 * TODO(ICT3-A): science is SPENT at StartResearch, not here. This stage only
 * advances progress (and stalls nothing — labs stalling is stage1).
 */
function stepResearch(state: GameState, dt: number): void {
  void state;
  void dt;
}

/* ----------------------------------------------------- 3. recruitment -- */

/**
 * Convert civilians → soldiers up to `reserveCap` (base + barracks), raising
 * gold-free but slowing growth when civilians run short.
 *
 * TODO(ICT3-A): use `state.config.recruit` (civiliansPerSoldier,
 * secondsPerSoldier, targetReserveRatio, barracksReserveCap) and
 * `resolveModifier` for `recruitSpeed`/`reserveCap`. Update
 * `empire.civilianBalance` here or in stage1 (one place only).
 */
function stepRecruitment(state: GameState, dt: number): void {
  void state;
  void dt;
}

/* ------------------------------------------------------- 4. buildings -- */

/**
 * Cannon reload timers and demolition timers.
 *
 * TODO(ICT3-A): for every building with a cannon, decrement `cooldown` by dt
 * (never below0). Demolition removal itself belongs to stage6 housekeeping so
 * the building stays fully active for its10s.
 */
function stepBuildings(state: GameState, dt: number): void {
  void state;
  void dt;
}

/* ---------------------------------------------------------- 5. combat -- */

/**
 * The heart of the game: resolve every Front.
 *
 * Per front, per tick (TODO(ICT3-A), read `state.config.combat`):
 * 1. Refresh `side.modifiers` (attack/defence multipliers + tooltip `lines`):
 *    city defence support (`support.cityDefenceRadius`), city attack support for
 *    upgraded cities (`cityAttackLevel`/`cityAttackRadius`), barracks attack
 *    support (`barracksAttackRadius`), fort defence (`fortDefenceRadius`),
 *    terrain defence for the defender's hex (`combat.terrainDefence`),
 *    multi-front bonus (distinct `front.cluster` values against the same enemy),
 *    counterattack multipliers, and `empire.bonuses` (attack/defence/frontAttack/
 *    frontDefence).
 * 2. If both sides are attacking, exchange losses scaled by
 *    `combat.baseLossesPerSecond` and the attack/defence weights.
 * 3. If one side attacks and the other holds, the attacker captures ground when
 *    the defence collapses; a defender losing its hex loses the front.
 * 4. Write `front.resolution = { at, lossesA, lossesB, capturedBy }` for badges.
 * 5. Attacking sides update `front.lastAttackAt`.
 */
function stepCombat(state: GameState, dt: number): void {
  void state;
  void dt;
}

/* ---------------------------------------------------- 6. housekeeping -- */

/**
 * Front lifecycle, demolition removal, bookkeeping and elimination.
 *
 * TODO(ICT3-A):
 * - Assign `front.cluster` per connected border segment between two empires.
 * - End a front (`removeFront`, fronts.ts) when: the edge is no longer hostile;
 *   neither side attacked for `front.idleEndSeconds`; or one side has0 troops
 *   while the other isn't attacking (survivors return to `empire.soldiers`,
 *   clamped to `reserveCap`).
 * - Remove buildings whose `demolishAt !== null && demolishAt <= elapsed`.
 * - Recompute `empire.hexCount` per empire (non-water hexes).
 * - Mark dead empires (`alive = false`, `eliminatedAt = elapsed`) and release
 *   their fronts.
 * - Set a dirty/clean flag for the renderer so it rebuilds only changed cells
 *   (see ARCHITECTURE.md §renderer).
 */
function stepHousekeeping(state: GameState, dt: number): void {
  void state;
  void dt;
}

/* -------------------------------------------------------- 7. win check -- */

/**
 * TODO(ICT3-A):
 * - `status = 'ended'`, `endReason = 'elimination'`, `winner = last alive` when
 *   only one empire remains (and > 1 empire started).
 * - `endReason = 'territory'` when an empire owns >= `territoryWinRatio` (0.75)
 *   of `state.landHexCount`.
 * - `endReason = 'timeLimit'` when `elapsed >= timeLimitSeconds`; largest
 *   territory wins (ties: most troops, then lowest empire id).
 * - Announce it through the store (`state.status` change is observed; see
 *   ARCHITECTURE.md §UI observation).
 */
function checkWinConditions(state: GameState): void {
  void state;
}
