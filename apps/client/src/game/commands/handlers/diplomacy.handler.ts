import type { GameState } from '../../state/state.types';
import type { EmpireId } from '../../empire/empire.types';
import { ok, fail } from '@the-big-war/game-engine/commands/command.service';
import type { CommandError, CommandResult, DeclareWarCommand, OfferPeaceCommand, RespondOfferCommand } from '../commands.types';
import {
  acceptsOffer,
  agreePeace,
  declareWar,
  decidesOwnOffers,
  getRelation,
  offerCooldown,
  pendingOffer,
  proposeOffer,
  rejectOffer,
  takeOffer,
} from '../../diplomacy/diplomacy.service';

function partiesError(state: GameState, empire: EmpireId, target: EmpireId): CommandError | null {
  const self = state.empires[empire];
  if (!self || !self.alive) return 'no_empire';
  const other = state.empires[target];
  if (!other || !other.alive || target === empire) return 'invalid_target';
  return null;
}

function peaceError(state: GameState, a: EmpireId, b: EmpireId): CommandError | null {
  return partiesError(state, a, b) ?? (getRelation(state, a, b).status === 'war' ? null : 'invalid_diplomacy');
}

export function handleOfferPeace(state: GameState, command: OfferPeaceCommand): CommandResult {
  const error = peaceError(state, command.empire, command.target);
  if (error) return fail(command.type, error);
  if (offerCooldown(state, command.empire, command.target)) return fail(command.type, 'offer_cooldown');
  if (decidesOwnOffers(state, command.target)) {
    if (pendingOffer(state, command.empire, command.target)) return fail(command.type, 'offer_pending');
    proposeOffer(state, command.empire, command.target);
    return ok(command.type);
  }
  if (!acceptsOffer(state, command.empire, command.target)) {
    rejectOffer(state, command.empire, command.target);
    return fail(command.type, 'offer_rejected');
  }
  agreePeace(state, command.empire, command.target);
  return ok(command.type);
}

export function handleRespondOffer(state: GameState, command: RespondOfferCommand): CommandResult {
  const offer = takeOffer(state, command.from, command.empire);
  if (!offer) return fail(command.type, 'offer_missing');
  if (!command.accept) {
    rejectOffer(state, offer.from, offer.to);
    return ok(command.type);
  }
  const error = peaceError(state, offer.to, offer.from);
  if (error) return fail(command.type, error);
  agreePeace(state, offer.from, offer.to);
  return ok(command.type);
}

export function handleDeclareWar(state: GameState, command: DeclareWarCommand): CommandResult {
  const error = partiesError(state, command.empire, command.target);
  if (error) return fail(command.type, error);
  if (getRelation(state, command.empire, command.target).status === 'war') return fail(command.type, 'already_at_war');
  if (!declareWar(state, command.empire, command.target)) return fail(command.type, 'in_peace');
  return ok(command.type);
}
