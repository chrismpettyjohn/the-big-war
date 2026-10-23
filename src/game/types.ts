/**
 * Complete simulation state types for The Big War.
 *
 * This file is the single source of truth for what the game state *is*.
 * Rules of the road:
 * - Types only. No functions, no DOM, no PIXI, no Solid. (Pure math lives in
 *   hex.ts, data in config.ts/research.ts, mutation in commands.ts/engine.ts.)
 * - Everything here is plain mutable data. The simulation mutates it in place;
 *   the renderer and UI read it (behind the store's version signal — see
 *   store.ts) and never write to it.
 * - EmpireId is an index into `GameState.empires`. Colour tokens in the UI are
 *   `--faction-{id}` (see tokens.css), so id 0..7 maps to the8 palette slots.
 */

import type { Axial, AxialGrid } from './hex';
import type { Rng } from './rng';

/* ---------------------------------------------------------------- ids ---- */

/** Index into `GameState.empires`. Also the colour slot (`--faction-{id}`). */
export type EmpireId = number;

/** Owner value for an unclaimed hex. */
export const NEUTRAL_OWNER: EmpireId = -1;

/** Stable id of a building instance (from `GameState.nextBuildingId`). */
export type BuildingId = number;

/**
 * Front id: canonical edge key of the two adjacent hexes, e.g. `"3,1|4,1"`
 * (coords sorted lexicographically). See `edgeId` in fronts.ts.
 */
export type FrontId = string;

/* ------------------------------------------------------------- hexes ---- */

/**
 * Terrain of a hex. Forest/mountain give placement + defence value and can be
 * destroyed by cannon fire (`CANNON.destroysTerrain` in config).
 */
export type Terrain = 'plain' | 'forest' | 'mountain' | 'water';

/** A building placed on a hex. At most one per hex. */
export interface Building {
  readonly id: BuildingId;
  readonly kind: BuildingKind;
  /** Cities upgrade (1..`GameConfig.upgrades.maxLevel`). Others stay at1. */
  level: number;
  /** Generic per-instance timer in game seconds. Cannon reload lives here. */
  cooldown: number;
  /** Farm field growth in [0, GameConfig.economy.farmGrowthMax]; stronger farms grow more. */
  growth: number;
  /**
   * Non-null while being demolished: game time (`GameState.elapsed`) at which
   * the building disappears (demolishAt = elapsed + DEMOLISH seconds). Stays
   * fully active until then; no refund.
   */
  demolishAt: number | null;
}

/** The9 building kinds. */
export type BuildingKind =
  | 'city'
  | 'market'
  | 'lumberjack'
  | 'miner'
  | 'farm'
  | 'lab'
  | 'barracks'
  | 'fort'
  | 'cannon';

/** One cell of the hex grid. Coordinates never change after map creation. */
export interface HexCell {
  readonly q: number;
  readonly r: number;
  terrain: Terrain;
  /** EmpireId, or NEUTRAL_OWNER. */
  owner: EmpireId;
  building: Building | null;
}

/** Flat rectangular grid; cells[r * width + q]. Helpers in hex.ts. */
export type HexGrid = AxialGrid<HexCell>;

/* --------------------------------------------------------- modifiers ---- */

/** Every numeric effect the sim can apply. Extend here when adding systems. */
export type ModifierKey =
  | 'goldIncome'
  | 'scienceRate'
  | 'growth'
  | 'buildCost'
  | 'attack'
  | 'defence'
  | 'reserveCap'
  | 'recruitSpeed'
  | 'frontAttack'
  | 'frontDefence';

/** One modifier contribution. Convention: `mul` for percentages, `add` for flat amounts. */
export interface Modifier {
  readonly key: ModifierKey;
  readonly add?: number;
  readonly mul?: number;
  /** Human-readable source, shown in tooltips ("Ironclad Legion", "Drill"). */
  readonly label?: string;
}

/** Folded totals for one key: effective = (base + add) * mul. See aggregateModifiers (config.ts). */
export interface ModifierTotal {
  add: number;
  mul: number;
}

/** Totals for every ModifierKey. `resolveModifier(base, totals[key])` at point of use. */
export type ModifierTotals = { readonly [K in ModifierKey]: ModifierTotal };

/* ----------------------------------------------------------- empires ---- */

/** Per-empire research state. See research.ts for node data + helpers. */
export interface EmpireResearch {
  /** Completed node ids (effects already applied to bonuses/unlocks). */
  readonly completed: string[];
  /** Chosen options for `choice` nodes: nodeId → optionId. Filled on completion. */
  readonly chosen: Record<string, string>;
  /** The one in-flight research, or null. Progress is a 0..1 ratio. */
  active: {
    readonly nodeId: string;
    /** 0..1; reaches1 when duration elapses, then the node completes. */
    progress: number;
    /** Chosen option for `choice` nodes, else null. */
    readonly optionId: string | null;
  } | null;
}

/** One empire (player or bot). Index in `GameState.empires` is its id. */
export interface Empire {
  readonly id: EmpireId;
  /** FactionDef.id from FACTIONS (config.ts); '' until picked in the menu. */
  factionId: string;
  isHuman: boolean;
  /** Display colour slot0..7 → `--faction-{id}` in tokens.css. */
  readonly colorIndex: number;
  gold: number;
  science: number;
  /** Float, never below0. Workers available = min(civilians, jobs). */
  civilians: number;
  /**
   * Net civilians per game second from the last economy tick. Negative when
   * recruitment outpaces growth — drives the "civilian balance" tooltip.
   */
  civilianBalance: number;
  /** Soldiers not committed to any front (the free reserve). */
  soldiers: number;
  /** Cap for soldiers + troops committed to fronts (barracks raise it). */
  reserveCap: number;
  /** Faction + completed-research modifiers, recomputed by recomputeEmpireBonuses (research.ts). */
  bonuses: ModifierTotals;
  research: EmpireResearch;
  /** Unlocked content keys (e.g. "building:cannon") granted by `unlock` research effects. */
  readonly unlocks: string[];
  /** Cached count of owned non-water hexes; updated in engine housekeeping. */
  hexCount: number;
  alive: boolean;
  /** Game time at which the empire was eliminated, or null. */
  eliminatedAt: number | null;
}

/* ------------------------------------------------------------ fronts ---- */

/** What one side of a front is trying to do. */
export type FrontMode = 'attack' | 'defence' | 'counterattack';

/** One contributing line of a front's modifiers (for the front tooltip). */
export interface ModifierLine {
  readonly label: string;
  /** Multipliers applied to this side's committed troops (1 = neutral). */
  readonly attack: number;
  readonly defence: number;
}

/** Resolved attack/defence multipliers for one side of a front, refreshed every combat tick. */
export interface FrontModifiers {
  readonly attack: number;
  readonly defence: number;
  /** Tooltip breakdown, e.g. Barracks support, city defence, terrain. */
  readonly lines: readonly ModifierLine[];
}

/** One side of a front: who, how many troops committed, and how they fight. */
export interface FrontSide {
  readonly empire: EmpireId;
  /** Troops committed to this front (unavailable elsewhere until the front ends). */
  troops: number;
  mode: FrontMode;
  /** Last combat tick's resolved modifiers. Engine refreshes these. */
  modifiers: FrontModifiers;
}

/** Snapshot of the most recent combat resolution on a front (drives UI badges). */
export interface FrontResolution {
  /** GameState.elapsed when this resolution happened. */
  readonly at: number;
  /** Troops lost by sideA / sideB in that exchange. */
  readonly lossesA: number;
  readonly lossesB: number;
  /** Empire that captured a hex in this exchange, else null. */
  readonly capturedBy: EmpireId | null;
}

/**
 * A contested edge between two adjacent hostile hexes. Created lazily by
 * SendTroops (see commands.ts), removed by engine housekeeping when the edge
 * stops being hostile, when the front goes idle, or when one side is wiped out.
 */
export interface Front {
  readonly id: FrontId;
  readonly hexA: Axial;
  readonly hexB: Axial;
  readonly sideA: FrontSide;
  readonly sideB: FrontSide;
  /**
   * Connected-cluster id assigned in engine housekeeping: fronts sharing (or
   * touching) the same border segment between the same pair of empires share a
   * cluster. The multi-front attack bonus counts distinct enemy clusters
   * (config.combat.multiFront), so one long border is one front.
   */
  cluster: number;
  /** Last combat resolution, or null before the first exchange. */
  resolution: FrontResolution | null;
  /** GameState.elapsed of the last attack-mode exchange; drives the idle-end rule. */
  lastAttackAt: number;
}

/* ---------------------------------------------------------- research ---- */

/** Grouping used by the research panel tabs. */
export type ResearchBranch = 'economy' | 'military' | 'territory';

/**
 * Node kind. The panel renders entirely from RESEARCH_NODES data:
 * - `modifier`: applies its effect modifiers on completion.
 * - `unlock`: unlocks something (e.g. the cannon building). See UnlockEffect.
 * - `choice`: the player picks one of `options` when starting research; the
 *   chosen option's effects apply on completion.
 * New kinds (e.g. unique armies) only need a new kind string + effect shape —
 * the UI switches on `kind` and falls back to rendering `effects`.
 */
export type ResearchNodeKind = 'modifier' | 'unlock' | 'choice';

/** `unlock` effect: reveals content gated by `key` (e.g. "building:cannon"). */
export interface UnlockEffect {
  readonly kind: 'unlock';
  readonly key: string;
  readonly label: string;
}

/** `modifier` effect: empire-wide modifiers folded into `Empire.bonuses`. */
export interface ModifierEffect {
  readonly kind: 'modifier';
  readonly modifiers: readonly Modifier[];
}

/** An option inside a `choice` node. */
export interface ResearchOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly effects: readonly ResearchEffect[];
}

/** `choice` effect carrier lives on the node's options; this is the shared effect union. */
export type ResearchEffect = ModifierEffect | UnlockEffect;

/** A node in the data-driven research tree (see research.ts for the actual nodes). */
export interface ResearchNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: ResearchNodeKind;
  readonly branch: ResearchBranch;
  /** Science cost, paid up-front when research starts. */
  readonly cost: number;
  /** Game seconds to complete once started. */
  readonly duration: number;
  /** Node ids that must be completed first. */
  readonly requires: readonly string[];
  /** Panel layout, rendered from data: tab = branch, grid position below. */
  readonly position: { readonly col: number; readonly row: number };
  /** Base effects applied on completion (for `choice` nodes, see `options`). */
  readonly effects: readonly ResearchEffect[];
  /** Present only for kind === 'choice'. */
  readonly options?: readonly ResearchOption[];
}

/* ------------------------------------------------------------- config ---- */

export type GameSpeed = 1 | 2 | 4;

/** Map generation parameters. Hexes form a rectangle in axial coords. */
export interface MapConfig {
  readonly width: number;
  readonly height: number;
  /** Circumradius (centre → corner) in world pixels. */
  readonly hexSize: number;
  /** Seed for map generation and sim rng (GameState.rng). */
  readonly seed: number;
}

/** Per-kind building data. Placement rules are data so UI and dispatch agree. */
export interface BuildingConfig {
  readonly cost: number;
  /** Required research node id (GameConfig.buildings.cannon.requiresResearch), or null. */
  readonly requiresResearch: string | null;
  /**
   * Placement requirement expressed as data, or null. Dispatch validates it
   * (`PlaceBuilding` → error 'invalid_target'); the build UI greys out hexes
   * that fail it.
   */
  readonly requiresAdjacentTerrain: Terrain | null;
}

/** Starting conditions for every empire. */
export interface StartConfig {
  readonly gold: number;
  readonly civilians: number;
  readonly soldiers: number;
  readonly science: number;
  /** Number of empires (human slot0 + bots), clamped2..8. */
  readonly empireCount: number;
}

/** Building upgrade rules. Cost formula: building cost * costMultiplier * currentLevel. */
export interface UpgradeConfig {
  readonly maxLevel: number;
  readonly costMultiplier: number;
}

/** Demolition rules. */
export interface DemolishConfig {
  /** Building stays active this many game seconds after Demolish is confirmed. */
  readonly durationSeconds: number;
  /** No refund — kept explicit so nobody "helpfully" adds one. */
  readonly refund: 0;
}

/** Cannons. */
export interface CannonConfig {
  readonly cost: number;
  /** Reload seconds per cannon (Building.cooldown). */
  readonly cooldown: number;
  /** Max hex distance from one of your cannons to the target. */
  readonly range: number;
  /** Troops lost per side on every front touching the struck hex. */
  readonly damage: number;
  /** Terrains converted to plain on hit. */
  readonly destroysTerrain: readonly Terrain[];
}

/** Front lifecycle rules (creation is in commands.ts SendTroops). */
export interface FrontConfig {
  /**
   * A front ends after this many game seconds with neither side attacking
   * (mode 'attack' or 'counterattack' counts as attacking). Survivors return.
   */
  readonly idleEndSeconds: number;
  /** Committed troops on a front at rest on both sides → front ends immediately. */
  readonly idleTroops: 0;
}

/** Multi-front attack bonus. */
export interface MultiFrontConfig {
  /** Bonus multiplier per additional distinct enemy front cluster beyond the first. */
  readonly perExtraFront: number;
  /** Cap on the total multi-front bonus. */
  readonly maxBonus: number;
}

/** Combat resolution weights and data. Engine stage5 reads these. */
export interface CombatConfig {
  readonly attackWeight: number;
  readonly defenceWeight: number;
  /** Multipliers per terrain applied to the side defending that hex. */
  readonly terrainDefence: Readonly<Record<Terrain, number>>;
  readonly multiFront: MultiFrontConfig;
  /** Counterattack mode: attack multiplier vs a side that is holding. */
  readonly counterattack: { readonly attackMultiplier: number; readonly defenceMultiplier: number };
  /** Troop losses per second at attackWeight1 vs defenceWeight1 (tuning knob). */
  readonly baseLossesPerSecond: number;
}

/** Civilian economy rates (per game second) and curves. */
export interface EconomyConfig {
  /** Passive civilian growth per civilian when workforce is not starved. */
  readonly baseGrowthPerCivilian: number;
  /** Farms add growth: farmGrowthPerFarm * (1 + farm.growth). */
  readonly farmGrowthPerFarm: number;
  readonly farmGrowthMax: number;
  readonly marketGoldPerSecond: number;
  readonly lumberjackGoldPerSecond: number;
  readonly minerGoldPerSecond: number;
  /** Labs convert gold into science at this rate; they stall at0 gold. */
  readonly labSciencePerSecond: number;
  readonly labGoldPerSecond: number;
  /** Civilians consumed per second of production per building (jobs). */
  readonly workersPerBuilding: number;
}

/** Support radii (hexes) for city/barracks/fort/miner/lumberjack effects. */
export interface SupportConfig {
  /** City territory radius per level (index level-1). */
  readonly cityTerritoryRadius: readonly number[];
  /** City defence support radius (any level) — defenders on adjacent fronts. */
  readonly cityDefenceRadius: number;
  /** Upgraded cities (level >= this) also support attackers. */
  readonly cityAttackLevel: number;
  readonly cityAttackRadius: number;
  /** Barracks attack-support radius for nearby fronts. */
  readonly barracksAttackRadius: number;
  /** Fort defence-support radius for nearby territory. */
  readonly fortDefenceRadius: number;
  /** Lumberjack/miner placement bonus radius (terrain in range strengthens the bonus). */
  readonly lumberjackRadius: number;
  readonly minerRadius: number;
}

/** Recruitment (civilians → soldiers). */
export interface RecruitConfig {
  readonly civiliansPerSoldier: number;
  /** Seconds of civilian "work" needed per soldier at recruitSpeed1. */
  readonly secondsPerSoldier: number;
  readonly baseReserveCap: number;
  /** Reserve cap added per barracks building. */
  readonly barracksReserveCap: number;
  /** Fraction of free soldiers recruiters aim to keep (stops runaway recruitment). */
  readonly targetReserveRatio: number;
}

/** Bot tuning (per-bot personality lives on BotOptions). */
export interface BotConfig {
  /** Real-cadence is fixed-step in game time: bots run every this many game seconds. */
  readonly tickSeconds: number;
}

/**
 * All match tuning. One instance lives on `GameState.config` (immutable after
 * match creation); `DEFAULT_GAME_CONFIG` in config.ts is the baseline.
 */
export interface GameConfig {
  readonly map: MapConfig;
  readonly timeLimitSeconds: number;
  /** Win by controlling this fraction of land (non-water) hexes. */
  readonly territoryWinRatio: number;
  readonly start: StartConfig;
  readonly upgrades: UpgradeConfig;
  readonly demolish: DemolishConfig;
  readonly cannon: CannonConfig;
  readonly front: FrontConfig;
  readonly combat: CombatConfig;
  readonly economy: EconomyConfig;
  readonly support: SupportConfig;
  readonly recruit: RecruitConfig;
  readonly bot: BotConfig;
  readonly buildings: Readonly<Record<BuildingKind, BuildingConfig>>;
}

/** Faction definition. Bonuses are plain modifiers read by the sim. */
export interface FactionDef {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** Picker swatch colour slot; in-match empire colours are slot-based (Empire.id). */
  readonly colorIndex: number;
  readonly bonuses: readonly Modifier[];
}

/* ------------------------------------------------------------- state ---- */

export type MatchStatus = 'menu' | 'playing' | 'ended';

/** Why the match ended (with status 'ended'). */
export type EndReason = 'elimination' | 'territory' | 'timeLimit';

/**
 * Why a command was rejected. Keep this list small and meaningful — the UI maps
 * each reason to a specific message/highlight, and bots branch on it. The
 * command union itself lives in commands.ts (it needs `Axial` for targeting);
 * this error enum lives here so engine.ts, bot.ts and the UI can all name it
 * without importing the whole command bus.
 */
export type CommandError =
  /** Match is not 'playing' (or not started). */
  | 'not_playing'
  /** Empire id invalid, or empire eliminated. */
  | 'no_empire'
  /** Not enough gold. */
  | 'insufficient_gold'
  /** Not enough science. */
  | 'insufficient_science'
  /** Not enough free soldiers. */
  | 'insufficient_troops'
  /** Reserve cap reached. */
  | 'reserve_full'
  /** Target hex off-grid, not owned/adjacent as required, or blocked. */
  | 'invalid_target'
  /** Building kind's research prerequisite not met. */
  | 'not_researched'
  /** Building/cannon still reloading. */
  | 'cooldown'
  /** Research prerequisites unmet, already researching, or already done. */
  | 'research_unavailable';

/** `Command['type']` mirror — avoids importing commands.ts just for the tag union. */
export type CommandType =
  | 'SendTroops'
  | 'SetFrontMode'
  | 'PlaceBuilding'
  | 'DemolishBuilding'
  | 'FireCannon'
  | 'StartResearch'
  | 'SetGameSpeed'
  | 'SelectFaction'
  | 'SetPaused';


/** The whole simulation. Mutated only by commands.ts, engine.ts and store.ts. */
export interface GameState {
  /** Immutable for the lifetime of the match. */
  readonly config: GameConfig;
  status: MatchStatus;
  playerEmpire: EmpireId;
  grid: HexGrid;
  /** Index === EmpireId. Length === config.start.empireCount. */
  empires: Empire[];
  fronts: Front[];
  /** Non-water hex count at map creation (territory win condition denominator). */
  landHexCount: number;
  /** Game seconds since match start (scaled time — see store.step). */
  elapsed: number;
  /** Fixed-step counter (incremented once per engine.step). Determinism/debug aid. */
  tick: number;
  /** Current game speed multiplier. */
  speed: GameSpeed;
  rng: Rng;
  winner: EmpireId | null;
  endReason: EndReason | null;
  /** Next BuildingId to hand out. */
  nextBuildingId: BuildingId;
  /** Internal: game-second accumulator for the fixed bot cadence (do not touch outside store/bot). */
  botAccumulator: number;
}

/** Factory signature used by store.startMatch/returnToMenu (MatchFactory in store.ts). */
export type CreateState = (config: GameConfig) => GameState;
