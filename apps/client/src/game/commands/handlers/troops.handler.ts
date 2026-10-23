import { ensureFront } from '../../front/front.service';
import type { GameState } from '../../state/state.types';
import type { EmpireId } from '../../empire/empire.types';
import { NEUTRAL_OWNER } from '../../empire/empire.constants';
import { canAttack, declareWar } from '../../diplomacy/diplomacy.service';
import type { CommandResult, SendTroopsCommand } from '../commands.types';
import { ok, fail } from '@the-big-war/game-engine/commands/command.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { distance, gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';

export function handleSendTroops(state: GameState, command: SendTroopsCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');

  const percent = Math.max(1, Math.min(100, Math.round(command.percent)));
  const troops = Math.floor((empire.soldiers * percent) / 100);
  if (troops <= 0) return fail(command.type, 'insufficient_troops');

  const from = gridAt(state.grid, command.hex);
  const to = gridAt(state.grid, command.target);
  if (!from || !to) return fail(command.type, 'invalid_target');
  if (from.owner !== command.empire || to.owner === command.empire) return fail(command.type, 'invalid_target');
  if (distance(command.hex, command.target) !== 1) return fail(command.type, 'invalid_target');

  if (to.owner === NEUTRAL_OWNER) {
    if (command.intent !== 'attack') return fail(command.type, 'invalid_target');
    empire.soldiers -= troops;
    launchExpedition(state, command.empire, command.target, troops);
    return ok(command.type);
  }

  if (command.intent === 'attack') {
    const attackCheck = canAttack(state, command.empire, to.owner);
    if (!attackCheck.allowed) return fail(command.type, attackCheck.reason ?? 'invalid_target');
    declareWar(state, command.empire, to.owner);
  }

  empire.soldiers -= troops;
  const front = ensureFront(state, command.hex, command.target);
  const isSideA = front.hexA.q === command.hex.q && front.hexA.r === command.hex.r;
  const side = isSideA ? front.sideA : front.sideB;
  if (side.empire !== command.empire) {
    empire.soldiers += troops;
    return fail(command.type, 'invalid_target');
  }
  side.troops += troops;
  side.mode = command.intent === 'attack' ? 'attack' : 'defence';
  front.lastAttackAt = state.elapsed;
  return ok(command.type);
}

function launchExpedition(state: GameState, empire: EmpireId, target: Axial, troops: number): void {
  const existing = state.expeditions.find(expedition => expedition.empire === empire);
  if (existing) {
    existing.troops += troops;
    existing.target = { q: target.q, r: target.r };
    return;
  }
  state.expeditions.push({ empire, target: { q: target.q, r: target.r }, troops });
}
