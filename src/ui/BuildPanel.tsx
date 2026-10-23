/**
 * Build panel: pick a building, then click one of your hexes.
 *
 * Costs come from `config.buildings` (never hardcoded), availability checks the
 * same research unlock the command bus enforces, and the spacing rule the sim
 * applies ("buildings need space around them") is described here so the player
 * understands why a placement was refused. Selection feeds `controllers.setTool`.
 */

import { For, Show } from 'solid-js';
import { BUILDING_KINDS, resolveModifier } from '../game/config';
import { gameStore } from '../game/store';
import { hasUnlock } from '../game/research';
import type { BuildingKind } from '../game/types';
import { t } from '../i18n';
import { Panel } from '../ui/kit/Panel';
import type { Controllers } from '../session/controllers';
import { buildingLabel } from '../ui/text';

export interface BuildPanelProps {
  readonly controllers: Controllers;
  readonly onClose: () => void;
}

/** Terrain requirement hint per kind, from config (data-driven). */
function requirementNote(kind: BuildingKind): string | undefined {
  const spec = gameStore().state.config.buildings[kind];
  return spec.requiresAdjacentTerrain ? `⌁ ${spec.requiresAdjacentTerrain}` : undefined;
}

export const BuildPanel = (props: BuildPanelProps) => {
  const store = gameStore();
  const me = () => store.state.empires[store.state.playerEmpire]!;

  const cost = (kind: BuildingKind): number =>
    resolveModifier(store.state.config.buildings[kind].cost, me().bonuses.buildCost);

  const unlocked = (kind: BuildingKind): boolean => {
    const requires = store.state.config.buildings[kind].requiresResearch;
    if (!requires) return true;
    return hasUnlock(me(), `building:${kind}`);
  };

  const select = (kind: BuildingKind) => {
    const current = props.controllers.tool();
    if (current.kind === 'place' && current.building === kind) props.controllers.cancelTool();
    else props.controllers.setTool({ kind: 'place', building: kind });
  };

  return (
    <Panel
      title={t('panel.build.title')}
      kind={`${t('hud.gold')} ${Math.floor(me().gold)}`}
      onClose={props.onClose}
    >
      <span class="kit-note">{t('panel.build.hint')}</span>
      <div class="kit-col">
        <For each={BUILDING_KINDS}>
          {kind => {
            const available = unlocked(kind);
            const affordable = me().gold >= cost(kind);
            const selected = () => {
              const current = props.controllers.tool();
              return current.kind === 'place' && current.building === kind;
            };
            return (
              <button
                type="button"
                class={`street-drawer-row${selected() ? ' is-selected' : ''}${!available || !affordable ? ' is-disabled' : ''}`}
                disabled={!available || !affordable}
                onClick={() => select(kind)}
              >
                <span class="hud-card-swatch" style={{ background: 'var(--street-tile)' }} />
                {buildingLabel(kind)}
                <span class="menu-item-note kit-num">
                  <Show when={requirementNote(kind)}>{note => <span>{note()} </span>}</Show>
                  <Show when={!available} fallback={<span>{Math.round(cost(kind))}</span>}>
                    <span>{t('panel.build.locked')}</span>
                  </Show>
                </span>
              </button>
            );
          }}
        </For>
      </div>
      <Show when={props.controllers.tool().kind !== 'idle'}>
        <button type="button" class="kit-button is-danger" onClick={() => props.controllers.cancelTool()}>
          {t('panel.build.cancel')}
        </button>
      </Show>
    </Panel>
  );
};
