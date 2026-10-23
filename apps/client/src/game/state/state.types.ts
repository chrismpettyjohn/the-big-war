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

export interface Expedition {
  readonly empire: EmpireId;
  target: Axial;
  troops: number;
}

export interface GameState extends SimulationState {
  readonly config: GameConfig;
  playerEmpire: EmpireId;
  grid: HexGrid;

  empires: Empire[];
  fronts: Front[];

  expeditions: Expedition[];

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
