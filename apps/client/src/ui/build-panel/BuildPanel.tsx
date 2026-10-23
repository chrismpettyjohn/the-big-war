import './BuildPanel.css';
import { For, Show } from 'solid-js';
import { buildingLabel } from '../text';
import type { BuildPanelProps } from './BuildPanel.types';
import { gameStore } from '../../game/store/store.service';
import { Panel } from '@the-big-war/frontend/ui/panel/Panel';

export type { BuildPanelProps };

export const BuildPanel = (props: BuildPanelProps) => {
  const store = gameStore();

  const inProgress = () =>
    store.state.grid.cells
      .filter(cell => cell.owner === store.state.playerEmpire && cell.building && cell.building.buildRemaining > 0)
      .map(cell => cell.building!)
      .sort((a, b) => a.buildRemaining - b.buildRemaining);

  return (
    <Panel title="Construction" kind={`${inProgress().length}`} onClose={props.onClose}>
      <div class="kit-col build-queue">
        <Show
          when={inProgress().length > 0}
          fallback={<span class="kit-note">No builds in progress</span>}
        >
          <For each={inProgress()}>
            {building => (
              <div class="street-drawer-row build-queue-row">
                <span>{buildingLabel(building.kind)}</span>
                <span class="menu-item-note kit-num">{Math.ceil(building.buildRemaining)}s</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </Panel>
  );
};
