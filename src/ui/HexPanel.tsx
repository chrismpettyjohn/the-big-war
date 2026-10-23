/**
 * Hex panel: everything about the selected hex.
 *
 * This is the panel the manual's "right-click a territory to inspect it and open
 * its available actions" opens. It adapts to what is under the cursor:
 *   - your building  → level, cooldown/farm growth, Upgrade, Demolish (confirm), Fire
 *   - your land      → terrain + suggested actions
 *   - foreign land   → owner, terrain, defenders, and the send-troops control
 *   - neutral land   → terrain only
 *
 * It reads game state through `store.version()` and only ever talks to the sim by
 * dispatching commands (via the controllers), so the UI never mutates state.
 */

import { createSignal, Show } from 'solid-js';
import { gridAt, neighbors } from '../game/hex';
import { gameStore } from '../game/store';
import { distance } from '../game/hex';
import type { Building, ModifierLine } from '../game/types';
import { t } from '../i18n';
import { Bar } from '../ui/kit/Bar';
import { Panel } from '../ui/kit/Panel';
import type { Controllers } from '../session/controllers';
import { buildingLabel, factionLabel, terrainLabel } from '../ui/text';

export interface HexPanelProps {
  readonly controllers: Controllers;
  readonly onClose: () => void;
}

/** Human summary of a building's live state (level / reload / field growth). */
function buildingState(building: Building): string {
  const parts: string[] = [`L${building.level}`];
  if (building.kind === 'cannon' && building.cooldown > 0) {
    parts.push(`${t('panel.hex.reload')} ${building.cooldown.toFixed(0)}s`);
  }
  if (building.kind === 'farm') parts.push(`+${Math.round(building.growth * 100)}%`);
  if (building.demolishAt !== null) parts.push(t('panel.hex.demolish'));
  return parts.join(' · ');
}

/** Format a modifier line as "+15% atk". */
function modifierSummary(lines: readonly ModifierLine[]): string[] {
  return lines
    .filter(line => line.attack !== 1 || line.defence !== 1)
    .map(
      line =>
        `${line.label}: ${line.attack !== 1 ? `×${line.attack.toFixed(2)} atk` : ''}${
          line.attack !== 1 && line.defence !== 1 ? ' · ' : ''
        }${line.defence !== 1 ? `×${line.defence.toFixed(2)} def` : ''}`,
    );
}

export const HexPanel = (props: HexPanelProps) => {
  const store = gameStore();
  const [confirmDemolish, setConfirmDemolish] = createSignal(false);

  const hex = () => props.controllers.selectedHex();
  const cell = () => {
    const selected = hex();
    return selected ? (gridAt(store.state.grid, selected) ?? null) : null;
  };
  const player = () => store.state.playerEmpire;
  const isOwn = () => cell()?.owner === player();
  const isForeign = () => {
    const current = cell();
    return !!current && current.owner !== player() && current.owner >= 0;
  };
  const owner = () => {
    const current = cell();
    return current && current.owner >= 0 ? store.state.empires[current.owner] : null;
  };
  /** A front on any edge of this hex that involves us. */
  const front = () => {
    const selected = hex();
    if (!selected) return null;
    return (
      store.state.fronts.find(
        entry =>
          (entry.hexA.q === selected.q && entry.hexA.r === selected.r) ||
          (entry.hexB.q === selected.q && entry.hexB.r === selected.r),
      ) ?? null
    );
  };
  const attackFrom = () => {
    const selected = hex();
    if (!selected) return null;
    for (const candidate of neighbors(selected)) {
      if (gridAt(store.state.grid, candidate)?.owner === player()) return candidate;
    }
    return null;
  };

  const building = () => cell()?.building ?? null;
  const canFire = () => {
    const current = building();
    return !!current && current.kind === 'cannon' && isOwn() && current.cooldown <= 0;
  };

  const demolish = () => {
    const selected = hex();
    if (!selected) return;
    store.dispatch({ type: 'DemolishBuilding', empire: player(), hex: selected });
    setConfirmDemolish(false);
  };

  const startFire = () => {
    const selected = hex();
    if (!selected) return;
    props.controllers.setTool({ kind: 'cannon', from: selected });
    props.onClose();
  };

  const ownNeighbours = () => {
    const selected = hex();
    if (!selected) return 0;
    return neighbors(selected).filter(candidate => gridAt(store.state.grid, candidate)?.owner === player())
      .length;
  };

  return (
    <Panel
      title={hex() ? `${hex()!.q}, ${hex()!.r}` : t('panel.hex.title')}
      kind={cell() ? terrainLabel(cell()!.terrain) : undefined}
      onClose={props.onClose}
    >
      <Show when={cell()} fallback={<div class="kit-empty">{t('panel.hex.empty')}</div>}>
        {current => (
          <>
            <div class="kit-row">
              <span
                class="hud-card-swatch"
                style={{
                  background:
                    current().owner >= 0 ? `var(--faction-${current().owner})` : 'var(--street-border-hover)',
                }}
              />
              <span class="hud-card-sub">
                {current().owner >= 0 ? factionLabel(owner()?.factionId ?? '') : t('panel.hex.neutral')}
                {isOwn() ? ` · ${t('panel.empires.you')}` : ''}
              </span>
            </div>

            <Show when={building()}>
              {entry => (
                <div class="kit-col">
                  <div class="kit-row">
                    <strong class="hud-card-name">{buildingLabel(entry().kind)}</strong>
                    <span class="street-drawer-panel-kind">{buildingState(entry())}</span>
                  </div>
                  <Show when={isOwn()}>
                    <div class="kit-row">
                      <Show when={canFire()}>
                        <button type="button" class="kit-button is-danger" onClick={startFire}>
                          {t('panel.hex.fire')} · {store.state.config.cannon.cost}
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={confirmDemolish()}
                      fallback={
                        <button type="button" class="kit-button is-danger" onClick={() => setConfirmDemolish(true)}>
                          {t('panel.hex.demolish')}
                        </button>
                      }
                    >
                      <div class="kit-col">
                        <span class="kit-note">{t('panel.hex.demolishNote')}</span>
                        <div class="kit-row">
                          <button type="button" class="kit-button is-danger" onClick={demolish}>
                            {t('panel.hex.demolishConfirm')}
                          </button>
                          <button type="button" class="kit-button is-ghost" onClick={() => setConfirmDemolish(false)}>
                            {t('panel.build.cancel')}
                          </button>
                        </div>
                      </div>
                    </Show>
                  </Show>
                </div>
              )}
            </Show>

            <Show when={isForeign()}>
              <div class="kit-col">
                <Bar
                  label={t('front.troops')}
                  ratio={Math.min(1, (owner()?.soldiers ?? 0) / Math.max(1, owner()?.reserveCap ?? 1))}
                  value={Math.floor(owner()?.soldiers ?? 0)}
                  variant="danger"
                />
                <span class="kit-note">
                  {t('panel.army.percent')}: <strong>{props.controllers.troopPercent()}%</strong>
                </span>
              </div>
            </Show>

            <Show when={front()}>
              {entry => (
                <div class="kit-col">
                  <span class="street-label">{t('front.title')}</span>
                  <Bar
                    label={`${factionLabel(store.state.empires[entry().sideA.empire]?.factionId ?? '')}`}
                    ratio={
                      entry().sideA.troops /
                      Math.max(1, entry().sideA.troops + entry().sideB.troops)
                    }
                    value={Math.floor(entry().sideA.troops)}
                    variant="accent"
                  />
                  <Bar
                    label={`${factionLabel(store.state.empires[entry().sideB.empire]?.factionId ?? '')}`}
                    ratio={
                      entry().sideB.troops /
                      Math.max(1, entry().sideA.troops + entry().sideB.troops)
                    }
                    value={Math.floor(entry().sideB.troops)}
                    variant="danger"
                  />
                  <Show when={entry().resolution}>
                    {resolution => (
                      <span class="kit-note kit-num">
                        {t('front.losses')}: {Math.floor(resolution().lossesA)} /{' '}
                        {Math.floor(resolution().lossesB)}
                      </span>
                    )}
                  </Show>
                </div>
              )}
            </Show>

            <Show when={isOwn()}>
              <span class="kit-note">
                {t('panel.build.hint')} · {ownNeighbours()}/6
              </span>
            </Show>

            <Show when={attackFrom() && isForeign()}>
              <span class="kit-note">
                {t('menu.tutorialHint')}
                <Show when={distance(attackFrom()!, hex()!) === 1}> ✓</Show>
              </span>
            </Show>
          </>
        )}
      </Show>
    </Panel>
  );
};

/** Modifier summary export kept for the army panel's tooltips. */
export { modifierSummary };
