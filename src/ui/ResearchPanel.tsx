/**
 * Research panel — rendered ENTIRELY from `RESEARCH_NODES` data.
 *
 * This is the piece the brief called out as needing to stay flexible: no node id
 * is hardcoded here. Nodes are grouped into tabs by `branch`, laid out by
 * `position`, gated by `requires`, and any node kind (`modifier`, `unlock`,
 * `choice`, or a future kind) renders through the same card with its effects
 * listed. Adding expensive unique-army choices later is a data change plus, at
 * most, one new case in `effectSummary`.
 */

import { createMemo, createSignal, For, Show } from 'solid-js';
import { gameStore } from '../game/store';
import { RESEARCH_NODES, isComplete, missingRequirements } from '../game/research';
import type { ResearchBranch, ResearchEffect, ResearchNode } from '../game/types';
import { t } from '../i18n';
import { Panel } from '../ui/kit/Panel';

export interface ResearchPanelProps {
  readonly onClose: () => void;
}

const BRANCHES: readonly ResearchBranch[] = ['economy', 'military', 'territory'];

const branchLabel = (branch: ResearchBranch): string => t(`panel.research.branch.${branch}`);

/** One-line human summary of a research effect (data-driven; unknown → fallback). */
function effectSummary(effect: ResearchEffect): string {
  switch (effect.kind) {
    case 'modifier':
      return effect.modifiers
        .map(modifier => {
          if (modifier.mul !== undefined) {
            const delta = Math.round((modifier.mul - 1) * 100);
            return `${modifier.key} ${delta >= 0 ? '+' : ''}${delta}%`;
          }
          if (modifier.add !== undefined) {
            return `${modifier.key} ${modifier.add >= 0 ? '+' : ''}${modifier.add}`;
          }
          return modifier.key;
        })
        .join(' · ');
    case 'unlock':
      return effect.label;
    default:
      // Future effect kinds render their kind name rather than failing to build.
      return (effect as { kind: string }).kind;
  }
}

export const ResearchPanel = (props: ResearchPanelProps) => {
  const store = gameStore();
  const [branch, setBranch] = createSignal<ResearchBranch>('economy');

  const me = () => store.state.empires[store.state.playerEmpire]!;
  const research = () => me().research;

  const nodes = createMemo(() => RESEARCH_NODES.filter(node => node.branch === branch()));

  const status = (node: ResearchNode): 'done' | 'active' | 'available' | 'locked' => {
    if (isComplete(research(), node.id)) return 'done';
    if (research().active?.nodeId === node.id) return 'active';
    if (missingRequirements(research(), node).length > 0) return 'locked';
    return 'available';
  };

  const start = (node: ResearchNode, optionId?: string) => {
    store.dispatch({
      type: 'StartResearch',
      empire: store.state.playerEmpire,
      nodeId: node.id,
      ...(optionId ? { optionId } : {}),
    });
  };

  return (
    <Panel
      title={t('panel.research.title')}
      kind={`${t('panel.research.science')} ${Math.floor(me().science)}`}
      onClose={props.onClose}
    >
      <div class="kit-tabs">
        <For each={BRANCHES}>
          {entry => (
            <button
              type="button"
              class={`kit-button${branch() === entry ? ' is-active' : ''}`}
              aria-pressed={branch() === entry}
              onClick={() => setBranch(entry)}
            >
              {branchLabel(entry)}
            </button>
          )}
        </For>
      </div>

      <Show when={research().active}>
        {active => {
          const node = () => RESEARCH_NODES.find(entry => entry.id === active().nodeId);
          return (
            <Show when={node()}>
              {current => (
                <div class="kit-col">
                  <div class="kit-row">
                    <span class="hud-card-sub">
                      {t('panel.research.active')}: {current().name}
                    </span>
                    <span class="hud-bar-value kit-num">{Math.round(active().progress * 100)}%</span>
                  </div>
                  <div class="hud-bar hud-bar--info">
                    <div class="hud-bar-fill" style={{ width: `${active().progress * 100}%` }} />
                  </div>
                </div>
              )}
            </Show>
          );
        }}
      </Show>

      <For each={nodes()}>
        {node => {
          const state = () => status(node);
          const missing = () => missingRequirements(research(), node);
          const affordable = () => me().science >= node.cost;
          return (
            <div class={`kit-col hud-card${state() === 'done' ? ' is-target' : ''}`}>
              <div class="hud-card-head">
                <strong class="hud-card-name">{node.name}</strong>
                <span class="street-drawer-panel-kind">
                  {state() === 'done'
                    ? t('panel.research.done')
                    : state() === 'active'
                      ? t('panel.research.active')
                      : state() === 'locked'
                        ? t('panel.research.locked')
                        : `${node.cost}`}
                </span>
              </div>
              <span class="kit-note">{node.description}</span>

              <For each={node.effects}>{effect => <span class="kit-note">{effectSummary(effect)}</span>}</For>

              <Show when={node.options && node.options.length > 0}>
                <div class="kit-col">
                  <For each={node.options}>
                    {option => (
                      <button
                        type="button"
                        class="kit-button"
                        disabled={state() !== 'available' || !affordable()}
                        onClick={() => start(node, option.id)}
                      >
                        {option.name}
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={missing().length > 0}>
                <span class="kit-note">
                  {t('panel.research.requires', {
                    names: missing()
                      .map(id => RESEARCH_NODES.find(entry => entry.id === id)?.name ?? id)
                      .join(', '),
                  })}
                </span>
              </Show>

              <Show when={!node.options || node.options.length === 0}>
                <button
                  type="button"
                  class="kit-button is-primary"
                  disabled={state() !== 'available' || !affordable()}
                  onClick={() => start(node)}
                >
                  {state() === 'done' ? t('panel.research.done') : t('panel.research.start')} · {node.cost}
                </button>
              </Show>
            </div>
          );
        }}
      </For>
    </Panel>
  );
};
