import { disbandFront } from '../front/front.service';
import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import type { AttackCheck, DiplomaticRelation, DiplomaticStatus, OfferCooldown, OfferKind } from './diplomacy.types';

export function relationKey(a: EmpireId, b: EmpireId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function getRelation(state: GameState, a: EmpireId, b: EmpireId): DiplomaticRelation {
  if (a === b) {
    return { status: 'neutral', expiresAt: null };
  }
  const key = relationKey(a, b);
  const rel = state.relations?.[key];
  if (!rel) {
    return { status: 'neutral', expiresAt: null };
  }
  if (rel.expiresAt !== null && state.elapsed >= rel.expiresAt) {
    return { status: 'neutral', expiresAt: null };
  }
  return rel;
}

export function getRawRelation(state: GameState, a: EmpireId, b: EmpireId): DiplomaticRelation | undefined {
  if (a === b) return undefined;
  return state.relations?.[relationKey(a, b)];
}

export function setRelation(
  state: GameState,
  a: EmpireId,
  b: EmpireId,
  status: DiplomaticStatus,
  expiresAt: number | null = null,
): void {
  if (a === b) return;
  if (!state.relations) {
    state.relations = {};
  }
  state.relations[relationKey(a, b)] = { status, expiresAt };
}

export function isProtected(state: GameState, a: EmpireId, b: EmpireId): boolean {
  if (a === b) return false;
  const rel = getRelation(state, a, b);
  return rel.status === 'peace' || rel.status === 'pact' || rel.status === 'alliance';
}

export function canAttack(
  state: GameState,
  attacker: EmpireId,
  defender: EmpireId,
): AttackCheck {
  if (attacker === defender) {
    return { allowed: false, reason: 'invalid_target' };
  }
  const rel = getRelation(state, attacker, defender);
  if (rel.status === 'peace') {
    return { allowed: false, reason: 'in_peace' };
  }
  if (rel.status === 'pact') {
    return { allowed: false, reason: 'in_pact' };
  }
  if (rel.status === 'alliance') {
    return { allowed: false, reason: 'in_alliance' };
  }
  return { allowed: true };
}

export function declareWar(state: GameState, attacker: EmpireId, defender: EmpireId): boolean {
  if (attacker === defender) return false;
  const status = getRelation(state, attacker, defender).status;
  if (status === 'peace' || status === 'pact') return false;
  setRelation(state, attacker, defender, 'war', null);
  return true;
}

export function endFrontsBetween(state: GameState, a: EmpireId, b: EmpireId): void {
  for (let index = state.fronts.length - 1; index >= 0; index--) {
    const front = state.fronts[index]!;
    const connectsAB =
      (front.sideA.empire === a && front.sideB.empire === b) ||
      (front.sideA.empire === b && front.sideB.empire === a);
    if (connectsAB) disbandFront(state, front);
  }
}
export function agreePeace(state: GameState, a: EmpireId, b: EmpireId): void {
  if (a === b) return;
  const duration = state.config.diplomacy.peaceDurationSeconds;
  setRelation(state, a, b, 'peace', state.elapsed + duration);
  endFrontsBetween(state, a, b);
}

export function acceptPact(state: GameState, a: EmpireId, b: EmpireId): void {
  if (a === b) return;
  const duration = state.config.diplomacy.pactDurationSeconds;
  setRelation(state, a, b, 'pact', state.elapsed + duration);
}

export function acceptAlliance(state: GameState, a: EmpireId, b: EmpireId): void {
  if (a === b) return;
  setRelation(state, a, b, 'alliance', null);
  endFrontsBetween(state, a, b);
}

export function dissolveDiplomacy(state: GameState, empireId: EmpireId): void {
  if (!state.relations) return;
  for (const key of Object.keys(state.relations)) {
    const parts = key.split(':');
    if (parts[0] === String(empireId) || parts[1] === String(empireId)) {
      delete state.relations[key];
    }
  }
}

export function offerKey(from: EmpireId, to: EmpireId, kind: OfferKind): string {
  return `${from}>${to}:${kind}`;
}

export function offerCooldown(state: GameState, from: EmpireId, to: EmpireId, kind: OfferKind): OfferCooldown | null {
  const cooldown = state.offerCooldowns?.[offerKey(from, to, kind)];
  if (!cooldown || state.elapsed >= cooldown.until) return null;
  return cooldown;
}

export function rejectOffer(state: GameState, from: EmpireId, to: EmpireId, kind: OfferKind): void {
  if (!state.offerCooldowns) state.offerCooldowns = {};
  state.offerCooldowns[offerKey(from, to, kind)] = {
    until: state.elapsed + state.config.diplomacy.rejectCooldownSeconds,
    rejectedBy: to,
  };
}

export function acceptsOffer(state: GameState, from: EmpireId, target: EmpireId, kind: OfferKind): boolean {
  if (target === state.playerEmpire) return true;
  const offerer = state.empires[from];
  const receiver = state.empires[target];
  if (!offerer || !receiver) return false;
  if (receiver.neutralState) return true;
  const offererStrength = offerer.soldiers + offerer.hexCount;
  const receiverStrength = receiver.soldiers + receiver.hexCount;
  if (kind === 'peace') return receiverStrength <= offererStrength * 1.5;
  if (kind === 'alliance') return receiverStrength <= offererStrength * 1.25;
  return receiverStrength <= offererStrength * 2;
}
