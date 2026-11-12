import type { WorldSlice } from '../map/map.types';
import type { ArmySlice } from '../unit/unit.types';
import type { FleetSlice } from '../ship/ship.types';
import type { Rng } from '@the-big-war/game-engine/rng/rng.types';
import type { DiplomacySlice } from '../diplomacy/diplomacy.types';
import type { ConstructionSlice } from '../building/building.types';
import type { GameConfig, GameSpeed } from '../config/config.types';
import type { EmpireId, EmpiresSlice } from '../empire/empire.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import type { SimulationState } from '@the-big-war/game-engine/simulation/simulation.types';

export type EndReason = 'elimination' | 'domination';

export interface MatchSlice extends SimulationState {
  readonly config: GameConfig;
  playerEmpire: EmpireId;
  spawnSites: (Axial | null)[];
  speed: GameSpeed;
  rng: Rng;
  winner: EmpireId | null;
  endReason: EndReason | null;
}

export interface GameState extends MatchSlice, WorldSlice, EmpiresSlice, DiplomacySlice, ArmySlice, FleetSlice, ConstructionSlice {}
