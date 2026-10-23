

import './ArmyPanel.css';
import { For, Show } from 'solid-js';
import { Bar } from '@the-big-war/frontend/ui/bar/Bar';

import type { ArmyPanelProps } from './ArmyPanel.types';
import { gameStore } from '../../game/store/store.service';
import { Panel } from '@the-big-war/frontend/ui/panel/Panel';
import { FaTimes } from '@the-big-war/frontend/ui/icons/icons';
import { NEUTRAL_OWNER } from '../../game/empire/empire.constants';
import type { Front, FrontMode } from '../../game/front/front.types';

export type { ArmyPanelProps };

const MODES: readonly FrontMode[] = ['attack', 'defence', 'counterattack'];

const modeLabel = (mode: FrontMode): string =>
  mode === 'attack'
    ? 'Attack'
    : mode === 'defence'
      ? 'Hold'
      : 'Counterattack';

export const ArmyPanel = (props: ArmyPanelProps) => {
  const store = gameStore();
  const player = () => store.state.playerEmpire;

  const myFronts = (): readonly Front[] =>
    store.state.fronts.filter(
      front => front.sideA.empire === player() || front.sideB.empire === player(),
    );

  const mySide = (front: Front) =>
    front.sideA.empire === player() ? front.sideA : front.sideB;
  const otherSide = (front: Front) =>
    front.sideA.empire === player() ? front.sideB : front.sideA;

  const frontName = (front: Front): string => {
    const enemy = otherSide(front).empire;
    if (enemy === NEUTRAL_OWNER) return 'Wild';
    return store.state.empires[enemy]?.name ?? '';
  };

  const deployed = () => myFronts().reduce((sum, front) => sum + mySide(front).troops, 0);
  const retreatPenalty = () => Math.round(store.state.config.front.retreatPenalty * 100);

  const retreat = (front: Front) => {
    store.dispatch({ type: 'RetreatFront', empire: player(), frontId: front.id });
  };

  const setMode = (front: Front, mode: FrontMode) => {
    store.dispatch({ type: 'SetFrontMode', empire: player(), frontId: front.id, mode });
  };

  const focus = (front: Front) => {
    props.controllers.selectHex(front.hexA.r >= 0 ? front.hexA : front.hexB);
    props.onClose();
  };

  return (
    <Panel title="Command" kind={`${myFronts().length}`} onClose={props.onClose}>
      <div class="army-summary">
        <div class="army-stat">
          <span class="army-stat-label">Troops</span>
          <strong class="army-stat-value kit-num">{Math.floor(store.state.empires[player()]?.soldiers ?? 0)}</strong>
        </div>
        <div class="army-stat">
          <span class="army-stat-label">Deployed</span>
          <strong class="army-stat-value kit-num">{Math.floor(deployed())}</strong>
        </div>
      </div>
      <span class="kit-note">Set the share of forces to deploy with the arrows at the bottom right. Click land to attack or claim it.</span>

      <div class="kit-divider" />

      <Show
        when={myFronts().length > 0}
        fallback={<div class="kit-empty">No troops deployed</div>}
      >
        <For each={myFronts()}>
          {front => {
            const mine = () => mySide(front);
            const theirs = () => otherSide(front);
            const total = () => Math.max(1, mine().troops + theirs().troops);
            return (
              <div class="kit-col hud-card army-front">
                <div class="hud-card-head">
                  <span
                    class="hud-card-swatch"
                    style={{ background: theirs().empire === NEUTRAL_OWNER ? 'var(--street-muted)' : `var(--faction-${theirs().empire})` }}
                  />
                  <button type="button" class="army-front-name" title="Show on map" onClick={() => focus(front)}>
                    {frontName(front)}
                  </button>
                  <span class="army-front-troops kit-num">{Math.floor(mine().troops)}</span>
                  <button
                    type="button"
                    class="army-retreat"
                    title={`Retreat (lose ${retreatPenalty()}% of troops)`}
                    aria-label={`Retreat from ${frontName(front)}`}
                    onClick={() => retreat(front)}
                  >
                    <FaTimes />
                  </button>
                </div>
                <Bar
                  label="Committed"
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
                  <span class="hud-bar-label">×{mine().modifiers.attack.toFixed(2)} Attack mod.</span>
                  <span class="hud-bar-label">×{mine().modifiers.defence.toFixed(2)} Defence mod.</span>
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </Panel>
  );
};
