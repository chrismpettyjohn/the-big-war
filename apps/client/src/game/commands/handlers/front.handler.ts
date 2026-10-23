import type { GameState } from '../../state/state.types';
import { findFront, sideOf } from '../../front/front.service';
import { ok, fail } from '@the-big-war/game-engine/commands/command.service';
import type { CommandResult, RetreatFrontCommand, SetFrontModeCommand } from '../commands.types';

export function handleSetFrontMode(state: GameState, command: SetFrontModeCommand): CommandResult {
  const front = findFront(state, command.frontId);
  if (!front) return fail(command.type, 'invalid_target');
  const side = sideOf(front, command.empire);
  if (!side) return fail(command.type, 'invalid_target');
  side.mode = command.mode;
  return ok(command.type);
}

export function handleRetreatFront(state: GameState, command: RetreatFrontCommand): CommandResult {
  const front = findFront(state, command.frontId);
  if (!front) return fail(command.type, 'invalid_target');
  const side = sideOf(front, command.empire);
  const empire = state.empires[command.empire];
  if (!side || !empire) return fail(command.type, 'invalid_target');
  const returned = Math.floor(side.troops * (1 - state.config.front.retreatPenalty));
  empire.soldiers += returned;
  side.troops = 0;
  return ok(command.type);
}
