import './WikiPanel.css';
import { buildingIcon } from '../building-icon';
import { createEffect, For, Show } from 'solid-js';
import type { WikiPanelProps } from './WikiPanel.types';
import { gameStore } from '../../game/store/store.service';
import { Panel } from '@the-big-war/frontend/ui/panel/Panel';
import type { BuildingKind } from '../../game/building/building.types';
import { BUILDING_KINDS } from '../../game/building/building.constants';
import { buildingDescription, buildingLabel, terrainLabel } from '../text';

export type { WikiPanelProps };

export const WikiPanel = (props: WikiPanelProps) => {
  const store = gameStore();
  const entries = new Map<BuildingKind, HTMLElement>();

  createEffect(() => {
    const focus = props.focus;
    if (focus) entries.get(focus)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  return (
    <Panel title="Wiki" kind="Buildings" onClose={props.onClose}>
      <div class="kit-col">
        <For each={BUILDING_KINDS}>
          {kind => {
            const spec = () => store.state.config.buildings[kind];
            return (
              <article
                ref={el => entries.set(kind, el)}
                class={`wiki-entry${props.focus === kind ? ' is-focused' : ''}`}
              >
                <div class="wiki-entry-head">
                  <div class="wiki-entry-icon" style={{ 'background-image': `url(${buildingIcon(kind)})` }} />
                  <span class="wiki-entry-name">{buildingLabel(kind)}</span>
                  <span class="wiki-entry-cost">
                    <span class="hud-hotbar-coin" aria-hidden="true" />
                    {spec().cost}
                  </span>
                </div>
                <p class="wiki-entry-body">{buildingDescription(kind)}</p>
                <Show when={spec().requiresAdjacentTerrain}>
                  {terrain => <span class="kit-note">Next to {terrainLabel(terrain()).toLowerCase()}</span>}
                </Show>
                <Show when={spec().requiresResearch}>
                  <span class="kit-note">Requires research</span>
                </Show>
              </article>
            );
          }}
        </For>
        <article class="wiki-entry">
          <div class="wiki-entry-head">
            <span class="wiki-entry-name">Neutral states</span>
          </div>
          <p class="wiki-entry-body">
            Small nations in stone-grey that never start a war. Attack one and it declares war back and fights you
            until peace is made. They don't count toward victory.
          </p>
        </article>
      </div>
    </Panel>
  );
};
