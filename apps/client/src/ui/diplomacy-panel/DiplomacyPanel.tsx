import './DiplomacyPanel.css';
import { For, Show } from 'solid-js';
import { gameStore } from '../../game/store/store.service';
import { Panel } from '@the-big-war/frontend/ui/panel/Panel';
import type { Empire } from '../../game/empire/empire.types';
import type { DiplomacyPanelProps } from './DiplomacyPanel.types';
import { diplomacyWaitSeconds, getRelation, pendingOffer } from '../../game/diplomacy/diplomacy.service';

export type { DiplomacyPanelProps };

export const DiplomacyPanel = (props: DiplomacyPanelProps) => {
  const store = gameStore();
  const state = () => store.state;
  const player = () => state().playerEmpire;
  const others = () => state().empires.filter(empire => empire.id !== player() && empire.alive);

  const atWar = (empire: Empire) => getRelation(state(), player(), empire.id).status === 'war';

  const offersPeace = (empire: Empire) => pendingOffer(state(), empire.id, player()) !== null;

  const waitSeconds = (empire: Empire): number => diplomacyWaitSeconds(state(), player(), empire.id);

  const toggle = (empire: Empire) => {
    if (offersPeace(empire)) {
      props.controllers?.run({ type: 'RespondOffer', empire: player(), from: empire.id, accept: true });
    } else if (atWar(empire)) {
      props.controllers?.run({ type: 'OfferPeace', empire: player(), target: empire.id });
    } else {
      props.controllers?.run({ type: 'DeclareWar', empire: player(), target: empire.id });
    }
  };

  return (
    <Panel title="Diplomacy" kind={`${others().length}`} onClose={props.onClose}>
      <div class="diplo-list">
        <For each={others()}>
          {empire => (
            <div class={`diplo-row${atWar(empire) ? ' is-war' : ''}`}>
              <span class="diplo-name">{empire.name}</span>
              <button
                type="button"
                class={`diplo-action ${atWar(empire) ? 'is-good' : 'is-bad'}`}
                disabled={waitSeconds(empire) > 0}
                onClick={() => toggle(empire)}
              >
                {atWar(empire) ? 'Peace' : 'War'}
                <Show when={waitSeconds(empire) > 0}>
                  <span class="kit-num"> {waitSeconds(empire)}s</span>
                </Show>
              </button>
            </div>
          )}
        </For>
      </div>
    </Panel>
  );
};
