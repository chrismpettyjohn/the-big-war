import type { GameState } from '../../state/state.types';
import { factionById } from '../../faction/faction.service';
import { recomputeEmpireBonuses } from '../../research/research.service';
import { ok, fail } from '@the-big-war/game-engine/commands/command.service';
import type { CommandResult, SelectFactionCommand, SetGameSpeedCommand, SetPausedCommand } from '../commands.types';

export function handleSetGameSpeed(state: GameState, command: SetGameSpeedCommand): CommandResult {
  state.speed = command.speed;
  return ok(command.type);
}

export function handleSetPaused(_state: GameState, command: SetPausedCommand): CommandResult {
  return ok(command.type);
}

export function handleSelectFaction(state: GameState, command: SelectFactionCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire) return fail(command.type, 'no_empire');
  if (!factionById(command.factionId)) return fail(command.type, 'invalid_target');
  empire.factionId = command.factionId;
  recomputeEmpireBonuses(state, empire.id);
  return ok(command.type);
}
