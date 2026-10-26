

import './ArmyPanel.css';
import { For, Show } from 'solid-js';

import { ownerCss } from '../../render/theme';
import type { ArmyPanelProps } from './ArmyPanel.types';
import { gameStore } from '../../game/store/store.service';
import { Panel } from '@the-big-war/frontend/ui/panel/Panel';
import { deployedTroops } from '../../game/troops/troops.service';
import { NEUTRAL_OWNER } from '../../game/empire/empire.constants';
import type { Front, FrontMode } from '../../game/front/front.types';
import type { Column, Expedition } from '../../game/state/state.types';
import { FaCrosshairs, FaFlag, FaShieldAlt, FaTimes, FaUsers } from '@the-big-war/frontend/ui/icons/icons';

export type { ArmyPanelProps };

const MODES: readonly FrontMode[] = ['attack', 'defence', 'counterattack'];

const modeLabel = (mode: FrontMode): string =>
  mode === 'attack'
    ? 'Attack'
    : mode === 'defence'
      ? 'Hold'
      : 'Counter';

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

  const deployed = () => deployedTroops(store.state, player());

  const myExpeditions = (): readonly Expedition[] =>
    store.state.expeditions.filter(expedition => expedition.empire === player());
  const myColumns = (): readonly Column[] => store.state.columns.filter(column => column.empire === player());
  const missionCount = () => myFronts().length + myExpeditions().length + myColumns().length;

  const expeditionTroops = (expedition: Expedition): number =>
    expedition.troops + expedition.squads.reduce((sum, squad) => sum + squad.troops, 0);
  const wildLeft = (expedition: Expedition): number =>
    expedition.region.filter(index => store.state.grid.cells[index]?.owner === NEUTRAL_OWNER).length;
  const columnTarget = (column: Column) => column.path[column.path.length - 1]!;
  const columnLeft = (column: Column): number => column.path.length - 1 - column.step;

  const focusHex = (hex: { q: number; r: number }) => {
    props.controllers.selectHex(hex);
    props.onClose();
  };
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
    <Panel title="Combat" kind={`${missionCount()}`} onClose={props.onClose}>
      <div class="army-summary">
        <span class="army-stat" title="Troops at home">
          <FaUsers class="army-stat-icon" />
          <span class="kit-num">{Math.floor(store.state.empires[player()]?.soldiers ?? 0)}</span>
        </span>
        <span class="army-stat" title="Deployed">
          <FaFlag class="army-stat-icon" />
          <span class="kit-num">{Math.floor(deployed())}</span>
        </span>
      </div>

      <For each={myColumns()}>
        {column => (
          <div class="kit-col army-node">
            <div class="hud-card-head">
              <span class="hud-card-swatch" style={{ background: 'var(--street-muted)' }} />
              <button type="button" class="army-front-name" title="Show on map" onClick={() => focusHex(columnTarget(column))}>
                {column.mission === 'claim' ? 'Marching to wild' : 'Marching to attack'}
              </button>
              <span class="army-troops kit-num">{Math.floor(column.troops)}</span>
            </div>
            <span class="army-sub">{columnLeft(column)} tiles to go</span>
          </div>
        )}
      </For>

      <For each={myExpeditions()}>
        {expedition => (
          <div class="kit-col army-node">
            <div class="hud-card-head">
              <span class="hud-card-swatch" style={{ background: 'var(--street-muted)' }} />
              <button type="button" class="army-front-name" title="Show on map" onClick={() => focusHex(expedition.target)}>
                Claiming wild
              </button>
              <span class="army-troops kit-num">{Math.floor(expeditionTroops(expedition))}</span>
            </div>
            <span class="army-sub">
              {expedition.squads.length} squads · {wildLeft(expedition)} wild left
            </span>
          </div>
        )}
      </For>

      <Show
        when={missionCount() > 0}
        fallback={<div class="army-empty">No troops deployed. Click land to attack or claim it.</div>}
      >
        <For each={myFronts()}>
          {front => {
            const mine = () => mySide(front);
            const theirs = () => otherSide(front);
            const total = () => Math.max(1, mine().troops + theirs().troops);
            return (
              <div class="kit-col army-node">
                <div class="hud-card-head">
                  <span
                    class="hud-card-swatch"
                    style={{ background: theirs().empire === NEUTRAL_OWNER ? 'var(--street-muted)' : ownerCss(theirs().empire) }}
                  />
                  <button type="button" class="army-front-name" title="Show on map" onClick={() => focus(front)}>
                    {frontName(front)}
                  </button>
                  <span class="army-troops kit-num" title="Yours : theirs">
                    {Math.floor(mine().troops)}
                    <span class="army-vs">:{Math.floor(theirs().troops)}</span>
                  </span>
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
                <div class="army-bar">
                  <div class="army-bar-fill" style={{ width: `${(mine().troops / total()) * 100}%` }} />
                </div>
                <div class="army-foot">
                  <div class="army-modes">
                    <For each={MODES}>
                      {mode => (
                        <button
                          type="button"
                          class={`army-mode${mine().mode === mode ? ' is-active' : ''}`}
                          aria-pressed={mine().mode === mode}
                          onClick={() => setMode(front, mode)}
                        >
                          {modeLabel(mode)}
                        </button>
                      )}
                    </For>
                  </div>
                  <span class="army-chip" title="Attack modifier">
                    <FaCrosshairs class="army-chip-icon" />
                    <span class="kit-num">×{mine().modifiers.attack.toFixed(2)}</span>
                  </span>
                  <span class="army-chip" title="Defence modifier">
                    <FaShieldAlt class="army-chip-icon" />
                    <span class="kit-num">×{mine().modifiers.defence.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </Panel>
  );
};
