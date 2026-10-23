import './BuildPanel.css';
import { For, Show } from 'solid-js';
import { buildingLabel } from '../text';
import type { BuildPanelProps } from './BuildPanel.types';
import { gameStore } from '../../game/store/store.service';
import { Panel } from '@the-big-war/frontend/ui/panel/Panel';
import { ENGINE_TUNING } from '../../game/simulation/simulation.constants';
import { constructionQueue } from '../../game/simulation/systems/buildings.system';

export type { BuildPanelProps };

export const BuildPanel = (props: BuildPanelProps) => {
  const store = gameStore();

  const inProgress = () => constructionQueue(store.state, store.state.playerEmpire);

  return (
    <Panel title="Construction" kind={`${inProgress().length}`} onClose={props.onClose}>
      <div class="kit-col build-queue">
        <Show
          when={inProgress().length > 0}
          fallback={<span class="kit-note">No builds in progress</span>}
        >
          <For each={inProgress()}>
            {(building, index) => (
              <div class="street-drawer-row build-queue-row">
                <span>{buildingLabel(building.kind)}</span>
                <span class="menu-item-note kit-num">
                  {index() < ENGINE_TUNING.buildSlotsPerEmpire ? `${Math.ceil(building.buildRemaining)}s` : 'Queued'}
                </span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </Panel>
  );
};
