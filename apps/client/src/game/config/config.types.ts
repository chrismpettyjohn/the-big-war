import type { Terrain } from '../map/map.types';
import type { BuildingKind } from '../building/building.types';

export type GameSpeed = 1 | 2 | 4;
export interface MapConfig {
  readonly width: number;
  readonly height: number;

  readonly hexSize: number;

  readonly seed: number;
}

export interface BuildingConfig {
  readonly cost: number;

  readonly buildSeconds: number;

  readonly requiresResearch: string | null;

  readonly requiresAdjacentTerrain: Terrain | null;
}

export interface StartConfig {
  readonly gold: number;
  readonly civilians: number;
  readonly soldiers: number;
  readonly science: number;

  readonly empireCount: number;
  readonly neutralStates?: number;

  readonly humanName?: string;
}

export interface UpgradeConfig {
  readonly maxLevel: number;
  readonly costMultiplier: number;
}

export interface DemolishConfig {

  readonly durationSeconds: number;

  readonly refund: 0;
}

export interface CannonConfig {
  readonly cost: number;

  readonly cooldown: number;

  readonly range: number;

  readonly damage: number;

  readonly destroysTerrain: readonly Terrain[];
}

export interface BatteryConfig {
  readonly cooldown: number;

  readonly range: number;

  readonly damage: number;
}

export interface FrontConfig {

  readonly idleEndSeconds: number;

  readonly idleTroops: 0;

  readonly retreatPenalty: number;
}

export interface MultiFrontConfig {

  readonly perExtraFront: number;

  readonly maxBonus: number;
}

export interface CombatConfig {
  readonly attackWeight: number;
  readonly defenceWeight: number;

  readonly terrainDefence: Readonly<Record<Terrain, number>>;
  readonly multiFront: MultiFrontConfig;

  readonly counterattack: { readonly attackMultiplier: number; readonly defenceMultiplier: number };

  readonly baseLossesPerSecond: number;
}

export interface EconomyConfig {

  readonly baseGrowthPerSecond: number;

  readonly cityGrowthPerCity: number;

  readonly farmGrowthPerFarm: number;
  readonly farmGrowthMax: number;
  readonly marketGoldPerSecond: number;

  readonly labSciencePerSecond: number;
  readonly labGoldPerSecond: number;

  readonly workersPerBuilding: number;

  readonly buildingCostGrowth: number;
}

export interface GatherConfig {
  readonly workersPerBuilding: number;

  readonly loadsPerTile: number;

  readonly workSeconds: number;
  readonly walkSecondsPerHex: number;

  readonly goldPerLoad: number;
}

export interface SupportConfig {

  readonly cityTerritoryRadius: readonly number[];

  readonly cityDefenceRadius: number;

  readonly cityAttackLevel: number;
  readonly cityAttackRadius: number;

  readonly barracksAttackRadius: number;

  readonly fortDefenceRadius: number;

  readonly lumberjackRadius: number;
  readonly minerRadius: number;

  readonly machineGunRadius: number;
  readonly bunkerRadius: number;
  readonly tankRadius: number;

}

export interface RecruitConfig {
  readonly civiliansPerSoldier: number;

  readonly secondsPerSoldier: number;
  readonly cityReserveCap: number;

  readonly barracksReserveCap: number;

  readonly fortReserveCap: number;

  readonly targetReserveRatio: number;

  readonly draftSecondsPerSoldier: number;

  readonly draftUntilRatio: number;
}

export interface BotConfig {

  readonly tickSeconds: number;

  readonly aggression: number;
}

export interface DiplomacyConfig {

  readonly treatySeconds: number;
  readonly rejectCooldownSeconds: number;

  readonly offerExpirySeconds: number;
}

export interface GameConfig {
  readonly map: MapConfig;
  readonly start: StartConfig;
  readonly upgrades: UpgradeConfig;
  readonly demolish: DemolishConfig;
  readonly cannon: CannonConfig;
  readonly battery: BatteryConfig;
  readonly front: FrontConfig;
  readonly combat: CombatConfig;
  readonly economy: EconomyConfig;
  readonly support: SupportConfig;
  readonly gather: GatherConfig;
  readonly recruit: RecruitConfig;
  readonly bot: BotConfig;
  readonly diplomacy: DiplomacyConfig;
  readonly buildings: Readonly<Record<BuildingKind, BuildingConfig>>;
}

