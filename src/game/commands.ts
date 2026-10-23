/**
 * The command bus: the ONLY way anything mutates the simulation.
 *
 * Both the player UI and the bots go through `dispatch(state, command)`.
 * `dispatch` is the deterministic, synchronous, PIXI/Solid-free entry point:
 * it validates, applies cheap state changes immediately, and reports the
 * change via the returned `CommandResult`. Slow/ordered effects (production,
 * recruitment, combat resolution, research progress) are NOT done here — the
 * engine stages do them, so a command only ever produces one tick of work.
 *
 * Error reporting: `dispatch` never throws for gameplay reasons (bad target,
 * no gold, …). It returns `{ ok: false, reason }` with valid granular reasons
 * so the UI can toast/highlight and bots can retry. Callers must not rely on
 * exceptions for control flow.
 */

import { gridAt } from './hex';
import type { Axial } from './hex';
import { ensureFront, findFront, findFrontByEdge } from './fronts';
import { DEFAULT_GAME_CONFIG, resolveModifier } from './config';
import { RESEARCH_BY_ID, hasUnlock, meetsRequirements } from './research';
import type {
  BuildingId,
  BuildingKind,
  CommandError,
  EmpireId,
  FrontId,
  FrontMode,
  GameState,
  GameSpeed,
} from './types';

/* -------------------------------------------------------- command set -- */

/** Commit troops from the free reserve into (or onto) a front on edge (hex,target). */
export interface SendTroopsCommand {
  readonly type: 'SendTroops';
  readonly empire: EmpireId;
  /** Your hex — must be owned by `empire` and adjacent to `target`. */
  readonly hex: Axial;
  /** The foreign hex being pushed into / held against. */
  readonly target: Axial;
  /** Percentage of the free reserve to commit, 1..100. */
  readonly percent: number;
  /** 'attack' pushes ground; 'defence' reinforces an existing front without pushing. */
  readonly intent: 'attack' | 'defence';
}

/** Change the mode of one side of an existing front. */
export interface SetFrontModeCommand {
  readonly type: 'SetFrontMode';
  readonly empire: EmpireId;
  readonly frontId: FrontId;
  readonly mode: FrontMode;
}

/** Place a building on one of your own hexes. */
export interface PlaceBuildingCommand {
  readonly type: 'PlaceBuilding';
  readonly empire: EmpireId;
  readonly hex: Axial;
  readonly kind: BuildingKind;
}

/** Confirm demolition of one of your buildings (stays active 10s, no refund). */
export interface DemolishBuildingCommand {
  readonly type: 'DemolishBuilding';
  readonly empire: EmpireId;
  readonly hex: Axial;
}

/** Fire the cannon on one of your hexes at a target hex. */
export interface FireCannonCommand {
  readonly type: 'FireCannon';
  readonly empire: EmpireId;
  /** Your hex holding the cannon. */
  readonly from: Axial;
  readonly target: Axial;
}

/** Spend science to start a research node (or a choice node's option). */
export interface StartResearchCommand {
  readonly type: 'StartResearch';
  readonly empire: EmpireId;
  readonly nodeId: string;
  /** Required for `choice` nodes, ignored otherwise. */
  readonly optionId?: string;
}

/** Change game speed (1x/2x/4x). */
export interface SetGameSpeedCommand {
  readonly type: 'SetGameSpeed';
  readonly speed: GameSpeed;
}

/** Pick a faction before/at match start. */
export interface SelectFactionCommand {
  readonly type: 'SelectFaction';
  readonly empire: EmpireId;
  readonly factionId: string;
}

/** Pause/resume a running match (a command so replays/tests can drive it). */
export interface SetPausedCommand {
  readonly type: 'SetPaused';
  readonly paused: boolean;
}

/** Everything the player UI and bots may dispatch. */
export type Command =
  | SendTroopsCommand
  | SetFrontModeCommand
  | PlaceBuildingCommand
  | DemolishBuildingCommand
  | FireCannonCommand
  | StartResearchCommand
  | SetGameSpeedCommand
  | SelectFactionCommand
  | SetPausedCommand;

/** Type tag union, handy for switch-heavy code and logging. */
export type CommandType = Command['type'];

/* ------------------------------------------------------------- errors -- */

/**
 * Why a command was rejected — defined in types.ts so the engine, bots and UI
 * can name reasons without importing this module. `CommandResult` narrows it:
 * `ok: false` guarantees a `reason`, `ok: true` guarantees none.
 */
export type CommandResult =
  | { readonly ok: true; readonly type: CommandType }
  | { readonly ok: false; readonly type: CommandType; readonly reason: CommandError };

const ok = (type: CommandType): CommandResult => ({ ok: true, type });
const fail = (type: CommandType, reason: CommandError): CommandResult => ({ ok: false, type, reason });

/* ---------------------------------------------------------- dispatch --- */

/**
 * Apply one command. Pure state mutation, no side effects outside `state`.
 *
 * Implemented in this architecture session (shared contract):
 * - `SetGameSpeed`, `SetPaused`, `SelectFaction` (cheap, no ordering hazards).
 * - front creation/id plumbing for `SendTroops` (via fronts.ts).
 *
 * The remaining bodies are owned by the gameplay engineer — each carries a
 * `TODO(ICT3-A)` marking exactly which config/value to use so the UI engineer's
 * error handling stays valid throughout.
 */
export function dispatch(state: GameState, command: Command): CommandResult {
  switch (command.type) {
    case 'SetGameSpeed':
      state.speed = command.speed;
      return ok(command.type);

    case 'SetPaused':
      // Pause is a store-level flag; the sim records nothing. Kept in the bus so
      // replays/tests drive it uniformly. (store.ts applies the actual pause.)
      return ok(command.type);

    case 'SelectFaction':
      return dispatchSelectFaction(state, command);

    case 'SendTroops':
      return dispatchSendTroops(state, command);

    case 'SetFrontMode':
      return dispatchSetFrontMode(state, command);

    case 'PlaceBuilding':
      return dispatchPlaceBuilding(state, command);

    case 'DemolishBuilding':
      return dispatchDemolishBuilding(state, command);

    case 'FireCannon':
      return dispatchFireCannon(state, command);

    case 'StartResearch':
      return dispatchStartResearch(state, command);
  }
}

/* ------------------------------------------- controller commands ------ */

function dispatchSelectFaction(state: GameState, command: SelectFactionCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire) return fail(command.type, 'no_empire');
  // TODO(ICT3-A): validate command.factionId against FACTIONS (config.ts) and
  // return 'invalid_target' when unknown; then set empire.factionId and call
  // recomputeEmpireBonuses(state, empire.id).
  empire.factionId = command.factionId;
  return ok(command.type);
}

function dispatchSetFrontMode(state: GameState, command: SetFrontModeCommand): CommandResult {
  const front = findFront(state, command.frontId);
  if (!front) return fail(command.type, 'invalid_target');
  const side = front.sideA.empire === command.empire ? front.sideA : front.sideB.empire === command.empire ? front.sideB : null;
  if (!side) return fail(command.type, 'invalid_target');
  side.mode = command.mode;
  return ok(command.type);
}

/* ------------------------------------------------- gameplay commands -- */

function dispatchSendTroops(state: GameState, command: SendTroopsCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const from = gridAt(state.grid, command.hex);
  const to = gridAt(state.grid, command.target);
  if (!from || !to) return fail(command.type, 'invalid_target');
  if (from.owner !== command.empire || to.owner === command.empire) return fail(command.type, 'invalid_target');

  const percent = Math.max(1, Math.min(100, Math.round(command.percent)));
  const troops = Math.floor((empire.soldiers * percent) / 100);
  if (troops <= 0) return fail(command.type, 'insufficient_troops');

  // TODO(ICT3-A): subtract the free reserve (empire.soldiers -= troops), then
  // add `troops` to the matching side of the front on this edge. When creating
  // the front, move the split troops back off `empire.soldiers` (the front owns
  // them); when joining an existing front, just add to `side.troops`.
  const front = ensureFront(state, command.hex, command.target);
  const isSideA = front.hexA.q === command.hex.q && front.hexA.r === command.hex.r;
  const side = isSideA ? front.sideA : front.sideB;
  if (side.empire !== command.empire) return fail(command.type, 'invalid_target');
  side.troops += troops;
  side.mode = command.intent === 'attack' ? 'attack' : 'defence';
  front.lastAttackAt = state.elapsed;
  return ok(command.type);
}

function dispatchPlaceBuilding(state: GameState, command: PlaceBuildingCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const cell = gridAt(state.grid, command.hex);
  if (!cell) return fail(command.type, 'invalid_target');
  const spec = state.config.buildings[command.kind];
  const effectiveCost = resolveModifier(spec.cost, empire.bonuses.buildCost);
  if (empire.gold < effectiveCost) return fail(command.type, 'insufficient_gold');

  // TODO(ICT3-A): full validation, in this order:
  // 1. cell.owner === command.empire and cell.terrain !== 'water' -> else 'invalid_target'
  // 2. cell.building === null -> else 'invalid_target'
  // 3. spec.requiresResearch === null || hasUnlock(empire, `building:${kind}`) -> else 'not_researched'
  // 4. spec.requiresAdjacentTerrain === null || the hex itself or a neighbor
  //    (neighbors(), hex.ts) has that terrain -> else 'invalid_target'
  // 5. empire.gold -= effectiveCost
  // 6. cell.building = { id: state.nextBuildingId++, kind, level: 1, cooldown: 0,
  //    growth: 0, demolishAt: null }
  void DEFAULT_GAME_CONFIG;
  void hasUnlock;
  return ok(command.type);
}

function dispatchDemolishBuilding(state: GameState, command: DemolishBuildingCommand): CommandResult {
  const cell = gridAt(state.grid, command.hex);
  if (!cell || !cell.building) return fail(command.type, 'invalid_target');
  if (cell.owner !== command.empire) return fail(command.type, 'invalid_target');
  // TODO(ICT3-A): set cell.building.demolishAt =
  //   state.elapsed + state.config.demolish.durationSeconds
  // No refund (config.demolish.refund === 0). The building keeps producing until
  // engine housekeeping removes it at `demolishAt`.
  _touchDemolish(state);
  return ok(command.type);
}

function dispatchFireCannon(state: GameState, command: FireCannonCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const from = gridAt(state.grid, command.from);
  if (!from || from.owner !== command.empire) return fail(command.type, 'invalid_target');
  if (from.building?.kind !== 'cannon') return fail(command.type, 'invalid_target');
  if (from.building.cooldown > 0) return fail(command.type, 'cooldown');
  const cost = state.config.cannon.cost;
  if (empire.gold < cost) return fail(command.type, 'insufficient_gold');
  // TODO(ICT3-A): distance(hex.ts) from command.from to command.target must be
  // <= state.config.cannon.range -> else 'invalid_target'. Then:
  // empire.gold -= cost; from.building.cooldown = state.config.cannon.cooldown;
  // apply damage to BOTH sides of every front on the target edge
  // (incidentFronts(), fronts.ts); convert destroyed terrain to 'plain'
  // (config.cannon.destroysTerrain); on a contested front damage your own troops too.
  void cost;
  return ok(command.type);
}

function dispatchStartResearch(state: GameState, command: StartResearchCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const node = RESEARCH_BY_ID.get(command.nodeId);
  if (!node) return fail(command.type, 'research_unavailable');
  if (!meetsRequirements(empire.research, node)) return fail(command.type, 'research_unavailable');
  if (empire.research.active) return fail(command.type, 'research_unavailable');
  if (empire.research.completed.includes(node.id)) return fail(command.type, 'research_unavailable');
  if (empire.science < node.cost) return fail(command.type, 'insufficient_science');
  // TODO(ICT3-A): choice nodes require a valid optionId (else
  // 'invalid_target'). Then: empire.science -= node.cost;
  // empire.research.active = { nodeId: node.id, progress: 0, optionId: command.optionId ?? null }.
  // Progress advances in engine stage2; completion runs completeResearch() (research.ts).
  return ok(command.type);
}

/* ------------------------------------------------------------ helpers -- */

/** Small helper so TODO stubs still reference the arguments they must use. */
function _touchDemolish(state: GameState): void {
  void state;
}

/** Signature for a validated command bundle (recording/replay). */
export interface CommandLogEntry {
  readonly tick: number;
  readonly command: Command;
  readonly result: CommandResult;
}

/** Convenience for tests: dispatch a spread of commands without throwing. */
export function dispatchAll(state: GameState, commands: readonly Command[]): CommandResult[] {
  return commands.map(command => dispatch(state, command));
}

/** Empire lookup + alive guard shared by command bodies and bots. */
export function liveEmpire(state: GameState, id: EmpireId): CommandError | undefined {
  const empire = state.empires[id];
  if (!empire || !empire.alive) return 'no_empire';
  return undefined;
}

/** Building id at a hex (UI: select building → demolish/upgrade). */
export function buildingIdAt(state: GameState, hex: Axial): BuildingId | null {
  return gridAt(state.grid, hex)?.building?.id ?? null;
}

/** Front id on an edge, without creating it — for UI previews. */
export function frontIdForEdge(state: GameState, a: Axial, b: Axial): FrontId | null {
  return findFrontByEdge(state, a, b)?.id ?? null;
}
