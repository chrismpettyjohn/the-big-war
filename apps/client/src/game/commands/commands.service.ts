import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import { handleFireCannon } from './handlers/cannon.handler';
import { handleSendTroops } from './handlers/troops.handler';
import { handleStartResearch } from './handlers/research.handler';
import type { Command, CommandError, CommandResult } from './commands.types';
import { handleRetreatFront, handleSetFrontMode } from './handlers/front.handler';
import { createDispatcher } from '@the-big-war/game-engine/commands/command.service';
import { handleDemolishBuilding, handlePlaceBuilding } from './handlers/building.handler';
import { handleLeaveTrench, handleManTrench, handleTrenchAttack } from './handlers/trench.handler';
import { handleSelectFaction, handleSetGameSpeed, handleSetPaused } from './handlers/match.handler';
import {
  handleDeclareWar,
  handleOfferPeace,
  handleRespondOffer,
} from './handlers/diplomacy.handler';

export const dispatch = createDispatcher<GameState, Command, CommandResult>({
  SetGameSpeed: handleSetGameSpeed,
  SetPaused: handleSetPaused,
  SelectFaction: handleSelectFaction,
  SendTroops: handleSendTroops,
  SetFrontMode: handleSetFrontMode,
  RetreatFront: handleRetreatFront,
  PlaceBuilding: handlePlaceBuilding,
  DemolishBuilding: handleDemolishBuilding,
  ManTrench: handleManTrench,
  LeaveTrench: handleLeaveTrench,
  TrenchAttack: handleTrenchAttack,
  FireCannon: handleFireCannon,
  StartResearch: handleStartResearch,
  OfferPeace: handleOfferPeace,
  DeclareWar: handleDeclareWar,
  RespondOffer: handleRespondOffer,
});

export function dispatchAll(state: GameState, commands: readonly Command[]): CommandResult[] {
  return commands.map(command => dispatch(state, command));
}

export function liveEmpire(state: GameState, id: EmpireId): CommandError | undefined {
  const empire = state.empires[id];
  if (!empire || !empire.alive) return 'no_empire';
  return undefined;
}
