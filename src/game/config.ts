/**
 * All tuning constants for The Big War, plus the4 faction definitions and the
 * modifier-combination formula.
 *
 * Tuning philosophy: every number the gameplay engineer might want to tweak
 * lives here (or in research.ts for research data). `DEFAULT_GAME_CONFIG` is
 * the baseline shipped to matches; `GameState.config` holds the exact config
 * used by a running match so bots/tests can vary it.
 *
 * Units: rates are "per game second". Distances are hexes. Time is game
 * seconds (real time * GameSpeed — see store.step).
 */

import type {
  BuildingKind,
  FactionDef,
  GameConfig,
  Modifier,
  ModifierKey,
  ModifierTotal,
  ModifierTotals,
  Terrain,
} from './types';

/* ------------------------------------------------------- formulas ------ */

/**
 * The one modifier-combination rule:
 *   effective = (base + sum of adds) * product of muls
 * Convention: use `mul` for percentages (0.15 = +15%), `add` for flat amounts.
 */
export function aggregateModifiers(modifiers: readonly Modifier[]): ModifierTotals {
  const totals = emptyModifierTotals();
  for (const mod of modifiers) {
    const bucket: ModifierTotal = totals[mod.key];
    if (mod.add !== undefined) bucket.add += mod.add;
    if (mod.mul !== undefined) bucket.mul *= mod.mul;
  }
  return totals;
}

/** Apply the combination rule to a base value. */
export function resolveModifier(base: number, total: ModifierTotal): number {
  return (base + total.add) * total.mul;
}

/** All keys neutral: add0, mul1. */
export function emptyModifierTotals(): ModifierTotals {
  const totals = {} as Record<ModifierKey, ModifierTotal>;
  for (const key of MODIFIER_KEYS) totals[key] = { add: 0, mul: 1 };
  return totals as ModifierTotals;
}

/**
 * Every ModifierKey. The Record literal below is exhaustiveness-checked by the
 * compiler, so adding a key to ModifierKey forces an update here.
 */
const MODIFIER_COVERED: Record<ModifierKey, true> = {
  goldIncome: true,
  scienceRate: true,
  growth: true,
  buildCost: true,
  attack: true,
  defence: true,
  reserveCap: true,
  recruitSpeed: true,
  frontAttack: true,
  frontDefence: true,
};

export const MODIFIER_KEYS: readonly ModifierKey[] = Object.keys(
  MODIFIER_COVERED,
) as ModifierKey[];

/* --------------------------------------------------------- factions ---- */

/**
 * The4 playable factions. Pure modifier packages — the sim reads
 * `Empire.bonuses` (assembled in research.ts recomputeEmpireBonuses) and never
 * switches on faction id. Picker swatches use colorIndex; in-match map colours
 * are slot-based (`--faction-{Empire.id}`) so up to8 empires never clash.
 */
export const FACTIONS: readonly FactionDef[] = [
  {
    id: 'ironclad',
    name: 'Ironclad Legion',
    blurb: 'Might before coin: stronger armies, weaker treasury.',
    colorIndex: 0,
    bonuses: [
      { key: 'attack', mul: 1.15, label: 'Ironclad Legion' },
      { key: 'defence', mul: 1.1, label: 'Ironclad Legion' },
      { key: 'goldIncome', mul: 0.9, label: 'Ironclad Legion' },
    ],
  },
  {
    id: 'league',
    name: 'Merchant League',
    blurb: 'Gold flows freely; soldiers do not come cheap.',
    colorIndex: 1,
    bonuses: [
      { key: 'goldIncome', mul: 1.3, label: 'Merchant League' },
      { key: 'buildCost', mul: 0.9, label: 'Merchant League' },
      { key: 'attack', mul: 0.95, label: 'Merchant League' },
    ],
  },
  {
    id: 'verdant',
    name: 'Verdant Compact',
    blurb: 'Fast growth and cheap construction from the heartland.',
    colorIndex: 2,
    bonuses: [
      { key: 'growth', mul: 1.3, label: 'Verdant Compact' },
      { key: 'buildCost', mul: 0.85, label: 'Verdant Compact' },
      { key: 'defence', mul: 0.95, label: 'Verdant Compact' },
    ],
  },
  {
    id: 'academy',
    name: 'Bright Academy',
    blurb: 'Science first: faster research, stouter defence.',
    colorIndex: 3,
    bonuses: [
      { key: 'scienceRate', mul: 1.35, label: 'Bright Academy' },
      { key: 'frontDefence', mul: 1.1, label: 'Bright Academy' },
      { key: 'reserveCap', mul: 0.9, label: 'Bright Academy' },
    ],
  },
];

/** Look up a faction by id (returns undefined for unknown ids). */
export function factionById(id: string): FactionDef | undefined {
  return FACTIONS.find(faction => faction.id === id);
}

/* ---------------------------------------------------- default config ---- */

const TERRAIN_KEYS: readonly Terrain[] = ['plain', 'forest', 'mountain', 'water'];

/** Baseline tuning. Tune here, not in engine.ts. */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  map: {
    width: 72, //72 *42 =3024 hexes — the stated performance target.
    height: 42,
    hexSize: 32,
    seed: 1337,
  },
  timeLimitSeconds: 15 * 60, //15 minutes of game time (speed-adjusted).
  territoryWinRatio: 0.75,
  start: {
    gold: 150,
    civilians: 20,
    soldiers: 10,
    science: 0,
    empireCount: 4, // Human +3 bots; clamped2..8.
  },
  upgrades: { maxLevel: 3, costMultiplier: 1.5 },
  demolish: { durationSeconds: 10, refund: 0 },
  cannon: {
    cost: 100,
    cooldown: 30,
    range: 6,
    damage: 25,
    destroysTerrain: ['forest', 'mountain'],
  },
  front: { idleEndSeconds: 5, idleTroops: 0 },
  combat: {
    attackWeight: 1.0,
    defenceWeight: 1.0,
    terrainDefence: {
      plain: 1.0,
      forest: 1.15,
      mountain: 1.35,
      water: 1.0,
    },
    multiFront: { perExtraFront: 0.1, maxBonus: 0.3 },
    counterattack: { attackMultiplier: 1.2, defenceMultiplier: 0.8 },
    baseLossesPerSecond: 2.0,
  },
  economy: {
    baseGrowthPerCivilian: 0.004,
    farmGrowthPerFarm: 0.02,
    farmGrowthMax: 1.0,
    marketGoldPerSecond: 0.8,
    lumberjackGoldPerSecond: 0.4,
    minerGoldPerSecond: 0.4,
    labSciencePerSecond: 0.5,
    labGoldPerSecond: 0.3, // Labs stall (produce nothing) when gold < this.
    workersPerBuilding: 5,
  },
  support: {
    cityTerritoryRadius: [1, 2, 2], // Index level-1.
    cityDefenceRadius: 2,
    cityAttackLevel: 2,
    cityAttackRadius: 2,
    barracksAttackRadius: 2,
    fortDefenceRadius: 2,
    lumberjackRadius: 2,
    minerRadius: 2,
  },
  recruit: {
    civiliansPerSoldier: 0.5,
    secondsPerSoldier: 2,
    baseReserveCap: 50,
    barracksReserveCap: 25,
    targetReserveRatio: 0.5,
  },
  bot: { tickSeconds: 0.5 },
  buildings: {
    city: { cost: 100, requiresResearch: null, requiresAdjacentTerrain: null },
    market: { cost: 50, requiresResearch: null, requiresAdjacentTerrain: null },
    lumberjack: { cost: 30, requiresResearch: null, requiresAdjacentTerrain: 'forest' },
    miner: { cost: 40, requiresResearch: null, requiresAdjacentTerrain: 'mountain' },
    farm: { cost: 25, requiresResearch: null, requiresAdjacentTerrain: 'plain' },
    lab: { cost: 80, requiresResearch: null, requiresAdjacentTerrain: null },
    barracks: { cost: 60, requiresResearch: null, requiresAdjacentTerrain: null },
    fort: { cost: 70, requiresResearch: null, requiresAdjacentTerrain: null },
    cannon: { cost: 120, requiresResearch: 'artillery', requiresAdjacentTerrain: null },
  },
};

/** Building kinds in toolbar/display order. */
export const BUILDING_KINDS: readonly BuildingKind[] = [
  'city',
  'market',
  'farm',
  'lumberjack',
  'miner',
  'lab',
  'barracks',
  'fort',
  'cannon',
];

/** Terrain kinds — re-exported constant list for data-driven UI iteration. */
export const TERRAINS: readonly Terrain[] = TERRAIN_KEYS;
