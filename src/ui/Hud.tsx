/**
 * Top HUD: the always-on readouts (gold, science, civilians, reserve, land, time)
 * plus the game-speed and pause controls. Built from the design kit's `hud-cash`,
 * `hud-status` and `kit-button` so it matches the rail and panels exactly.
 *
 * Every number is read through `store.version()` so it refreshes as the sim
 * advances (see ARCHITECTURE §6), and nothing here mutates game state.
 */

import { For, Show } from 'solid-js';
import { gameStore } from '../game/store';
import type { GameSpeed } from '../game/types';
import { t } from '../i18n';
import { factionLabel } from '../ui/text';

const SPEEDS: readonly GameSpeed[] = [1, 2, 4];

/** mm:ss remaining on the game clock. */
function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export interface HudProps {
  /** Open the empires overview (the faction chip doubles as the button). */
  readonly onFaction?: () => void;
}

export const Hud = (props: HudProps = {}) => {
  const store = gameStore();

  const me = () => store.state.empires[store.state.playerEmpire] ?? store.state.empires[0]!;
  const remaining = () => Math.max(0, store.state.config.timeLimitSeconds - store.state.elapsed);
  const committed = () => {
    // Troops locked into fronts: the reserve cap covers free + committed.
    const id = store.state.playerEmpire;
    let total = 0;
    for (const front of store.state.fronts) {
      if (front.sideA.empire === id) total += front.sideA.troops;
      if (front.sideB.empire === id) total += front.sideB.troops;
    }
    return Math.floor(total);
  };
  const landShare = () =>
    store.state.landHexCount === 0 ? 0 : me().hexCount / store.state.landHexCount;

  return (
    <header class="hud-top" aria-label={t('app.title')}>
      <div class="hud-cash hud-chip hud-chip--gold">
        <span class="is-muted street-label">{t('hud.gold')}</span>
        <span class="kit-num">{Math.floor(me().gold)}</span>
      </div>
      <div class="hud-cash hud-chip hud-chip--science">
        <span class="is-muted street-label">{t('hud.science')}</span>
        <span class="kit-num">{Math.floor(me().science)}</span>
      </div>
      <div class="hud-status hud-chip">
        <span class="street-label">{t('hud.civilians')}</span>
        <strong>{Math.floor(me().civilians)}</strong>
        <span class={me().civilianBalance < 0 ? 'is-danger kit-num' : 'is-success kit-num'}>
          {me().civilianBalance >= 0 ? '+' : ''}
          {me().civilianBalance.toFixed(1)}
        </span>
      </div>
      <div class="hud-status hud-chip">
        <span class="street-label">{t('hud.soldiers')}</span>
        <strong>{Math.floor(me().soldiers)}</strong>
        <span class="is-muted">/ {Math.floor(me().reserveCap)}</span>
        <Show when={committed() > 0}>
          <span class="is-danger kit-num">
            {t('panel.army.committed')} {committed()}
          </span>
        </Show>
      </div>
      <div class="hud-status hud-chip">
        <span class="street-label">{t('hud.land')}</span>
        <strong>{Math.round(landShare() * 100)}%</strong>
      </div>
      <div class="hud-status hud-chip">
        <span class="street-label">{t('hud.time')}</span>
        <strong class="kit-num">{formatClock(remaining())}</strong>
      </div>

      <div class="hud-speed" role="group" aria-label={t('menu.speed')}>
        <For each={SPEEDS}>
          {speed => (
            <button
              type="button"
              class={`kit-button is-ghost hud-speed-button${store.state.speed === speed ? ' is-active' : ''}`}
              aria-pressed={store.state.speed === speed}
              onClick={() => store.setSpeed(speed)}
            >
              {speed}×
            </button>
          )}
        </For>
        <button
          type="button"
          class={`kit-button is-ghost hud-speed-button${store.paused() ? ' is-active' : ''}`}
          aria-pressed={store.paused()}
          title={store.paused() ? t('rail.resume') : t('rail.pause')}
          onClick={() => store.setPaused(!store.paused())}
        >
          {store.paused() ? '▶' : '❚❚'}
        </button>
      </div>

      <button
        type="button"
        class="hud-faction hud-chip"
        title={t('panel.empires.title')}
        onClick={() => props.onFaction?.()}
      >
        <span class="hud-card-swatch" style={{ background: `var(--faction-${me().colorIndex})` }} />
        <span class="hud-card-sub">{factionLabel(me().factionId)}</span>
      </button>
    </header>
  );
};
