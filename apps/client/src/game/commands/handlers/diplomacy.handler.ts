import type { GameState } from '../../state/state.types';
import type { OfferKind } from '../../diplomacy/diplomacy.types';
import { ok, fail } from '@the-big-war/game-engine/commands/command.service';
import type {
  CommandError,
  CommandResult,
  DeclareWarCommand,
  OfferAllianceCommand,
  OfferPactCommand,
  OfferPeaceCommand,
} from '../commands.types';
import {
  acceptAlliance,
  acceptPact,
  acceptsOffer,
  agreePeace,
  declareWar,
  getRelation,
  offerCooldown,
  rejectOffer,
} from '../../diplomacy/diplomacy.service';

type DiplomacyCommand = OfferPeaceCommand | OfferPactCommand | OfferAllianceCommand | DeclareWarCommand;

function partiesError(state: GameState, command: DiplomacyCommand): CommandError | null {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return 'no_empire';
  const target = state.empires[command.target];
  if (!target || !target.alive || command.target === command.empire) return 'invalid_target';
  return null;
}

function negotiate(
  state: GameState,
  command: OfferPeaceCommand | OfferPactCommand | OfferAllianceCommand,
  kind: OfferKind,
  accept: (state: GameState, a: number, b: number) => void,
): CommandResult {
  if (offerCooldown(state, command.empire, command.target, kind)) return fail(command.type, 'offer_cooldown');
  if (!acceptsOffer(state, command.empire, command.target, kind)) {
    rejectOffer(state, command.empire, command.target, kind);
    return fail(command.type, 'offer_rejected');
  }
  accept(state, command.empire, command.target);
  return ok(command.type);
}

export function handleOfferPeace(state: GameState, command: OfferPeaceCommand): CommandResult {
  const error = partiesError(state, command);
  if (error) return fail(command.type, error);
  const rel = getRelation(state, command.empire, command.target);
  if (rel.status !== 'war') return fail(command.type, 'invalid_diplomacy');
  return negotiate(state, command, 'peace', agreePeace);
}

export function handleOfferPact(state: GameState, command: OfferPactCommand): CommandResult {
  const error = partiesError(state, command);
  if (error) return fail(command.type, error);
  const rel = getRelation(state, command.empire, command.target);
  if (rel.status === 'alliance') return fail(command.type, 'in_alliance');
  if (rel.status === 'pact') return fail(command.type, 'in_pact');
  if (rel.status === 'peace') return fail(command.type, 'in_peace');
  if (rel.status === 'war') return fail(command.type, 'already_at_war');
  if (rel.status !== 'neutral') return fail(command.type, 'invalid_diplomacy');
  return negotiate(state, command, 'pact', acceptPact);
}

export function handleOfferAlliance(state: GameState, command: OfferAllianceCommand): CommandResult {
  const error = partiesError(state, command);
  if (error) return fail(command.type, error);
  const rel = getRelation(state, command.empire, command.target);
  if (rel.status === 'alliance') return fail(command.type, 'in_alliance');
  if (rel.status === 'war') return fail(command.type, 'already_at_war');
  if (rel.status === 'peace') return fail(command.type, 'in_peace');
  return negotiate(state, command, 'alliance', acceptAlliance);
}

export function handleDeclareWar(state: GameState, command: DeclareWarCommand): CommandResult {
  const error = partiesError(state, command);
  if (error) return fail(command.type, error);
  const rel = getRelation(state, command.empire, command.target);
  if (rel.status === 'war') return fail(command.type, 'already_at_war');
  if (!declareWar(state, command.empire, command.target)) {
    return fail(command.type, 'cannot_declare_war_under_protection');
  }
  return ok(command.type);
}
