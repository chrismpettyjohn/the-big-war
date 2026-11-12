import './OfferPrompts.css';
import { Index } from 'solid-js';
import { factionIcon } from '../text';
import { ownerCss } from '../../render/theme';
import { gameStore } from '../../game/store/store.service';
import type { OfferPromptsProps } from './OfferPrompts.types';
import { FaCheck, FaTimes } from '@the-big-war/frontend/ui/icons/icons';
import { pendingOffersTo } from '../../game/diplomacy/diplomacy.service';
import type { PendingOffer } from '../../game/diplomacy/diplomacy.types';

export type { OfferPromptsProps };

export const OfferPrompts = (props: OfferPromptsProps) => {
  const store = gameStore();
  const state = () => store.state;
  const offers = () => pendingOffersTo(state(), state().playerEmpire);

  const respond = (offer: PendingOffer, accept: boolean) => {
    props.controllers?.run({ type: 'RespondOffer', empire: offer.to, from: offer.from, accept });
  };

  return (
    <div class="offer-prompts" aria-live="polite">
      <Index each={offers()}>
        {offer => {
          const empire = () => state().empires[offer().from];
          const secondsLeft = () => Math.max(0, Math.ceil(offer().expiresAt - state().elapsed));
          return (
            <div class="offer-prompt" style={{ '--tint': ownerCss(offer().from) }}>
              <span class="offer-prompt-flag">{factionIcon(empire()?.factionId ?? '')}</span>
              <span class="offer-prompt-text">
                <strong>{empire()?.name}</strong> offers peace
              </span>
              <span class="offer-prompt-timer kit-num">{secondsLeft()}s</span>
              <button type="button" class="offer-prompt-action is-good" onClick={() => respond(offer(), true)}>
                <FaCheck /> Accept
              </button>
              <button type="button" class="offer-prompt-action is-bad" onClick={() => respond(offer(), false)}>
                <FaTimes /> Decline
              </button>
            </div>
          );
        }}
      </Index>
    </div>
  );
};
