import './DiplomacyPanel.css';
import { For, Show } from 'solid-js';
import { factionIcon, factionLabel } from '../text';
import { gameStore } from '../../game/store/store.service';
import { Panel } from '@the-big-war/frontend/ui/panel/Panel';
import type { DiplomacyPanelProps } from './DiplomacyPanel.types';
import type { Empire, EmpireId } from '../../game/empire/empire.types';
import { getRelation, offerCooldown } from '../../game/diplomacy/diplomacy.service';
import type { DiplomaticStatus, OfferKind } from '../../game/diplomacy/diplomacy.types';
import { FaHandPaper, FaShieldAlt, FaUsers, GiCrossedSwords } from '@the-big-war/frontend/ui/icons/icons';

export type { DiplomacyPanelProps };

type ActionTone = 'good' | 'bad';

interface DiploAction {
  readonly label: string;
  readonly icon: typeof FaHandPaper;
  readonly tone: ActionTone;
  readonly run: () => void;
  readonly blocked: string | null;
  readonly secondsLeft: number | null;
}

function statusLabel(status: DiplomaticStatus): string {
  switch (status) {
    case 'neutral':
      return 'Neutral';
    case 'war':
      return 'At War';
    case 'peace':
      return 'Truce';
    case 'pact':
      return 'Pact';
    case 'alliance':
      return 'Allied';
  }
}

function statusClass(status: DiplomaticStatus): string {
  switch (status) {
    case 'war':
      return 'is-danger';
    case 'peace':
      return 'is-success';
    case 'pact':
    case 'alliance':
      return 'is-accent';
    case 'neutral':
      return 'is-muted';
  }
}

export const DiplomacyPanel = (props: DiplomacyPanelProps) => {
  const store = gameStore();
  const player = () => store.state.playerEmpire;

  const otherEmpires = () =>
    store.state.empires.filter(empire => empire.id !== player() && empire.alive);

  const secondsUntil = (time: number) => Math.max(0, Math.ceil(time - store.state.elapsed));

  const send = (type: 'OfferPeace' | 'OfferPact' | 'OfferAlliance' | 'DeclareWar', target: EmpireId) => {
    const result = store.dispatch({ type, empire: player(), target });
    if (!result.ok && props.controllers) {
      props.controllers.notice(result.reason);
    }
  };

  const offerAction = (empire: Empire, kind: OfferKind, label: string, protectedFor: number | null): DiploAction => {
    const icon = kind === 'peace' ? FaHandPaper : kind === 'pact' ? FaShieldAlt : FaUsers;
    const cooldown = offerCooldown(store.state, player(), empire.id, kind);
    const command = kind === 'peace' ? 'OfferPeace' : kind === 'pact' ? 'OfferPact' : 'OfferAlliance';
    const run = () => send(command, empire.id);
    if (protectedFor !== null) {
      return { label, icon, tone: 'good', run, blocked: `Truce with ${empire.name} must end first`, secondsLeft: protectedFor };
    }
    if (cooldown) {
      const left = secondsUntil(cooldown.until);
      const by = store.state.empires[cooldown.rejectedBy]?.name ?? empire.name;
      return {
        label,
        icon,
        tone: 'good',
        run,
        blocked: `You can't ${label.toLowerCase()} for ${left}s because it was rejected by ${by}`,
        secondsLeft: left,
      };
    }
    return { label, icon, tone: 'good', run, blocked: null, secondsLeft: null };
  };

  const actionsFor = (empire: Empire): DiploAction[] => {
    const rel = getRelation(store.state, player(), empire.id);
    const left = rel.expiresAt === null ? 0 : secondsUntil(rel.expiresAt);
    const declareWar = (blocked: string | null): DiploAction => ({
      label: 'Declare War',
      icon: GiCrossedSwords,
      tone: 'bad',
      run: () => send('DeclareWar', empire.id),
      blocked,
      secondsLeft: blocked ? left : null,
    });
    switch (rel.status) {
      case 'neutral':
        return [
          offerAction(empire, 'pact', 'Offer Pact', null),
          offerAction(empire, 'alliance', 'Ally', null),
          declareWar(null),
        ];
      case 'war':
        return [offerAction(empire, 'peace', 'Offer Peace', null)];
      case 'peace':
        return [
          offerAction(empire, 'pact', 'Offer Pact', left),
          offerAction(empire, 'alliance', 'Ally', left),
          declareWar(`You can't break the truce with ${empire.name} for ${left}s`),
        ];
      case 'pact':
        return [
          offerAction(empire, 'alliance', 'Ally', null),
          declareWar(`Your pact with ${empire.name} holds for ${left}s`),
        ];
      case 'alliance':
        return [declareWar(null)];
    }
  };

  return (
    <Panel
      title="Diplomacy"
      kind={`${otherEmpires().length}`}
      onClose={props.onClose}
    >
      <div class="diplo-list">
        <For each={otherEmpires()}>
          {empire => {
            const status = () => getRelation(store.state, player(), empire.id).status;

            return (
              <div class={`diplo-row ${statusClass(status())}`} style={{ '--tint': `var(--faction-${empire.id})` }}>
                <span class="diplo-flag">{factionIcon(empire.factionId)}</span>
                <div class="diplo-body">
                  <div class="diplo-head">
                    <div class="diplo-info">
                      <span class="diplo-name">{empire.name}</span>
                      <span class="diplo-faction">{factionLabel(empire.factionId)}</span>
                    </div>
                    <span class={`diplo-status ${statusClass(status())}`}>{statusLabel(status())}</span>
                  </div>
                  <div class="diplo-actions">
                    <For each={actionsFor(empire)}>
                      {action => (
                        <button
                          type="button"
                          class={`diplo-action is-${action.tone}`}
                          aria-disabled={action.blocked !== null}
                          data-why={action.blocked ?? undefined}
                          onClick={() => {
                            if (action.blocked === null) action.run();
                          }}
                        >
                          <action.icon class="diplo-action-icon" />
                          <span class="diplo-action-label">{action.label}</span>
                          <Show when={action.secondsLeft !== null}>
                            <span class="diplo-action-timer kit-num">{action.secondsLeft}s</span>
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Panel>
  );
};
