import type { HexGrid } from '../map/map.types';
import type { Front } from '../front/front.types';
import type { BuildingId } from '../building/building.types';
import type { Empire, EmpireId } from '../empire/empire.types';
import type { Rng } from '@the-big-war/game-engine/rng/rng.types';
import type { GameConfig, GameSpeed } from '../config/config.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import type { DiplomaticRelation, OfferCooldown } from '../diplomacy/diplomacy.types';
import type { SimulationState } from '@the-big-war/game-engine/simulation/simulation.types';

export type EndReason = 'elimination';

export interface Squad {
  pos: { q: number; r: number };
  tile: Axial;
  heading: Axial;
  goal: Axial | null;
  from: Axial | null;
  claiming: boolean;
  progress: number;
  duration: number;
  readonly troops: number;
}

export interface Column {
  readonly empire: EmpireId;
  readonly mission: 'claim' | 'attack';
  readonly path: readonly Axial[];
  step: number;
  progress: number;
  troops: number;
}

export interface Expedition {
  readonly empire: EmpireId;
  target: Axial;
  troops: number;

  readonly region: readonly number[];
  readonly origin: Axial;
  squads: Squad[];
}

export interface GameState extends SimulationState {
  readonly config: GameConfig;
  playerEmpire: EmpireId;
  grid: HexGrid;

  empires: Empire[];
  fronts: Front[];

  expeditions: Expedition[];
  columns: Column[];

  landHexCount: number;

  speed: GameSpeed;
  rng: Rng;
  winner: EmpireId | null;
  endReason: EndReason | null;

  nextBuildingId: BuildingId;

  relations: Record<string, DiplomaticRelation>;
  offerCooldowns: Record<string, OfferCooldown>;
}

export type CreateState = (config: GameConfig) => GameState;
