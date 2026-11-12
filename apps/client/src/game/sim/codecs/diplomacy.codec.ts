import type { GameState } from '../../state/state.types';
import type { DiplomacyPatch, FrameChanges, SimShadow } from '../sim.types';

export function encodeDiplomacy(state: GameState, shadow: SimShadow): DiplomacyPatch | null {
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

export function applyDiplomacy(state: GameState, patch: DiplomacyPatch, changes: FrameChanges): void {
  state.relations = patch.relations;
  state.offerCooldowns = patch.offerCooldowns;
  state.pendingOffers = [...patch.pendingOffers];
  changes.diplomacy = true;
}
