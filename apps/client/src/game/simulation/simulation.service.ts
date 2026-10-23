import { stepCombat } from './systems/combat.system';
import type { GameState } from '../state/state.types';
import { stepEconomy } from './systems/economy.system';
import { stepResearch } from './systems/research.system';
import { stepBuildings } from './systems/buildings.system';
import { stepExpansion } from './systems/expansion.system';
import { checkWinConditions } from './systems/victory.system';
import { stepRecruitment } from './systems/recruitment.system';
import { stepHousekeeping } from './systems/housekeeping.system';
import type { System } from '@the-big-war/game-engine/simulation/simulation.types';
import { createStepper } from '@the-big-war/game-engine/simulation/simulation.service';

export const GAME_SYSTEMS: readonly System<GameState>[] = [
  stepEconomy,
  stepResearch,
  stepRecruitment,
  stepBuildings,
  stepExpansion,
  stepCombat,
  stepHousekeeping,
  checkWinConditions,
];

export const step = createStepper(GAME_SYSTEMS);
