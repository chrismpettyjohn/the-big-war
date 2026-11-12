import type { DiplomacySlice } from '../../diplomacy/diplomacy.types';
import type { DiplomacyPatch, FrameChanges, SimShadow } from '../sim.types';

export function encodeDiplomacy(state: DiplomacySlice, shadow: SimShadow): DiplomacyPatch | null {
  const patch: DiplomacyPatch = {
    relations: state.relations,
    offerCooldowns: state.offerCooldowns,
    pendingOffers: state.pendingOffers,
  };
  const printed = JSON.stringify(patch);
  if (shadow.diplomacy === printed) return null;
  shadow.diplomacy = printed;
  return patch;
}

export function applyDiplomacy(state: DiplomacySlice, patch: DiplomacyPatch, changes: FrameChanges): void {
  state.relations = patch.relations;
  state.offerCooldowns = patch.offerCooldowns;
  state.pendingOffers = [...patch.pendingOffers];
  changes.diplomacy = true;
}
