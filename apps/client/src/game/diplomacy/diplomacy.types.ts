import type { EmpireId } from '../empire/empire.types';
import type { CommandError } from '../commands/commands.types';

export type DiplomaticStatus = 'neutral' | 'war' | 'peace' | 'pact' | 'alliance';

export interface DiplomaticRelation {
  readonly status: DiplomaticStatus;

  expiresAt: number | null;
}

export type OfferKind = 'peace' | 'pact' | 'alliance';

export interface OfferCooldown {
  readonly until: number;
  readonly rejectedBy: EmpireId;
}

export interface AttackCheck {
  allowed: boolean;
  reason?: CommandError;
}
