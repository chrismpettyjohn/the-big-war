/**
 * Army panel: the troop slider plus every front you are currently fighting on.
 *
 * This is where the manual's "set Send, then click territory to commit part of
 * your available reserve" lives — the slider percentage is owned by the
 * controllers (it applies to clicks on the map), and each front gets its own
 * Attack / Hold / Counterattack switch.
 */

import { For, Show } from 'solid-js';
import { gameStore } from '../game/store';
import type { Front, FrontMode } from '../game/types';
import { t } from '../i18n';
import { Bar } from '../ui/kit/Bar';
import { Panel } from '../ui/kit/Panel';
import type { Controllers } from '../session/controllers';
import { factionLabel } from '../ui/text';

export interface ArmyPanelProps {
  readonly controllers: Controllers;
  readonly onClose: () => void;
}

const MODES: readonly FrontMode[] = ['attack', 'defence', 'counterattack'];

const modeLabel = (mode: FrontMode): string =>
  mode === 'attack'
    ? t('panel.army.attack')
    : mode === 'defence'
      ? t('panel.army.hold')
      : t('panel.army.counter');

export const ArmyPanel = (props: ArmyPanelProps) => {
  const store = gameStore();
  const player = () => store.state.playerEmpire;

  /** Fronts where the player has committed troops. */
  const myFronts = (): readonly Front[] =>
    store.state.fronts.filter(
      front => front.sideA.empire === player() || front.sideB.empire === player(),
    );

  const mySide = (front: Front) =>
    front.sideA.empire === player() ? front.sideA : front.sideB;
  const otherSide = (front: Front) =>
    front.sideA.empire === player() ? front.sideB : front.sideA;

  const setMode = (front: Front, mode: FrontMode) => {
    store.dispatch({ type: 'SetFrontMode', empire: player(), frontId: front.id, mode });
  };

  /** Centre the map on a front (both its hexes are adjacent; use hexA). */
  const focus = (front: Front) => {
    props.controllers.selectHex(front.hexA.r >= 0 ? front.hexA : front.hexB);
    props.onClose();
  };

  return (
    <Panel title={t('panel.army.title')} kind={`${myFronts().length}`} onClose={props.onClose}>
      <div class="kit-col">
        <span class="street-label">{t('panel.army.percent')}</span>
        <input
          class="kit-slider"
          type="range"
          min="1"
          max="100"
          step="1"
          value={props.controllers.troopPercent()}
          onInput={event => props.controllers.setTroopPercent(Number(event.currentTarget.value))}
        />
        <div class="kit-row" style={{ 'justify-content': 'space-between' }}>
          <span class="kit-note kit-num">{t('panel.army.reserve')}: {Math.floor(store.state.empires[player()]?.soldiers ?? 0)}</span>
          <strong class="hud-card-name kit-num">{props.controllers.troopPercent()}%</strong>
        </div>
        <span class="kit-note">{t('menu.tutorialHint')}</span>
      </div>

      <div class="kit-divider" />

      <Show
        when={myFronts().length > 0}
        fallback={<div class="kit-empty">{t('front.title')} — ∅</div>}
      >
        <For each={myFronts()}>
          {front => {
            const mine = () => mySide(front);
            const theirs = () => otherSide(front);
            const total = () => Math.max(1, mine().troops + theirs().troops);
            return (
              <div class="kit-col hud-card">
                <div class="hud-card-head">
                  <span class="hud-card-swatch" style={{ background: `var(--faction-${theirs().empire})` }} />
                  <span class="hud-card-name">{factionLabel(store.state.empires[theirs().empire]?.factionId ?? '')}</span>
                  <button type="button" class="hud-card-close" title={t('front.title')} onClick={() => focus(front)}>
                    ⌖
                  </button>
                </div>
                <Bar
                  label={t('panel.army.committed')}
                  ratio={mine().troops / total()}
                  value={`${Math.floor(mine().troops)} : ${Math.floor(theirs().troops)}`}
                  variant="accent"
                />
                <div class="kit-row">
                  <For each={MODES}>
                    {mode => (
                      <button
                        type="button"
                        class={`kit-button${mine().mode === mode ? ' is-active' : ''}`}
                        aria-pressed={mine().mode === mode}
                        onClick={() => setMode(front, mode)}
                      >
                        {modeLabel(mode)}
                      </button>
                    )}
                  </For>
                </div>
                <div class="kit-row">
                  <span class="hud-bar-label">×{mine().modifiers.attack.toFixed(2)} {t('front.attackMod')}</span>
                  <span class="hud-bar-label">×{mine().modifiers.defence.toFixed(2)} {t('front.defenceMod')}</span>
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </Panel>
  );
};
