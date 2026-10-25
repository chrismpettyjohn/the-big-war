import type { EmpireId } from '../empire/empire.types';
import type { CommandError } from '../commands/commands.types';

export type DiplomaticStatus = 'war' | 'peace';

export interface DiplomaticRelation {
  readonly status: DiplomaticStatus;

  treatyUntil: number | null;
}

export interface OfferCooldown {
  readonly until: number;
  readonly rejectedBy: EmpireId;
}

export interface PendingOffer {
  readonly from: EmpireId;
  readonly to: EmpireId;
  readonly expiresAt: number;
}

export interface AttackCheck {
  allowed: boolean;
  reason?: CommandError;
}
