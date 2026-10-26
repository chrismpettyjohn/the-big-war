import { joinFront } from '../../troops/troops.service';
import type { GameState } from '../../state/state.types';
import { NEUTRAL_OWNER } from '../../empire/empire.constants';
import { garrisonRoom, ownTrench } from '../../trench/trench.service';
import { canAttack, declareWar } from '../../diplomacy/diplomacy.service';
import { ok, fail } from '@the-big-war/game-engine/commands/command.service';
import { distance, gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';
import type { CommandResult, LeaveTrenchCommand, ManTrenchCommand, TrenchAttackCommand } from '../commands.types';

function share(total: number, percent: number): number {
  const clamped = Math.max(1, Math.min(100, Math.round(percent)));
  return Math.min(Math.floor(total), Math.max(1, Math.floor((total * clamped) / 100)));
}

export function handleManTrench(state: GameState, command: ManTrenchCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const trench = ownTrench(state, command.empire, command.hex);
  if (!trench) return fail(command.type, 'invalid_target');
  const room = garrisonRoom(state, trench);
  if (room <= 0) return fail(command.type, 'trench_full');
  const troops = Math.min(room, share(empire.soldiers, command.percent));
  if (troops <= 0) return fail(command.type, 'insufficient_troops');
  empire.soldiers -= troops;
  trench.garrison += troops;
  return ok(command.type);
}

export function handleLeaveTrench(state: GameState, command: LeaveTrenchCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const trench = ownTrench(state, command.empire, command.hex);
  if (!trench) return fail(command.type, 'invalid_target');
  const troops = Math.min(trench.garrison, share(trench.garrison, command.percent));
  if (troops <= 0) return fail(command.type, 'insufficient_troops');
  trench.garrison -= troops;
  empire.soldiers += troops;
  return ok(command.type);
}

export function handleTrenchAttack(state: GameState, command: TrenchAttackCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const trench = ownTrench(state, command.empire, command.hex);
  if (!trench) return fail(command.type, 'invalid_target');
  const to = gridAt(state.grid, command.target);
  if (!to || to.owner === command.empire || to.owner === NEUTRAL_OWNER) return fail(command.type, 'invalid_target');
  if (distance(command.hex, command.target) !== 1) return fail(command.type, 'invalid_target');
  const troops = Math.min(trench.garrison, share(trench.garrison, command.percent));
  if (troops <= 0) return fail(command.type, 'insufficient_troops');

  const attackCheck = canAttack(state, command.empire, to.owner);
  if (!attackCheck.allowed) return fail(command.type, attackCheck.reason ?? 'invalid_target');
  declareWar(state, command.empire, to.owner);

  if (!joinFront(state, command.empire, command.hex, command.target, troops, 'attack')) {
    return fail(command.type, 'invalid_target');
  }
  trench.garrison -= troops;
  return ok(command.type);
}
