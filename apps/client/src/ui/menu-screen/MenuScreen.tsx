import './MenuScreen.css';
import { factionIcon } from '../text';
import { openAbout } from '../about/about';
import { For, Show, createSignal } from 'solid-js';
import { empireNames } from '../../game/names/names.service';
import { FACTIONS } from '../../game/faction/faction.constants';
import type { FactionDef } from '../../game/faction/faction.types';
import type { Modifier } from '../../game/modifier/modifier.types';
import { isUnlimitedGoldName } from '../../game/empire/empire.service';
import type { MenuScreenProps, PickTarget, SegmentProps } from './MenuScreen.types';
import { CHEAT_UNLIMITED_GOLD_PERK, CHEAT_UNLIMITED_GOLD_TITLE } from '../../game/empire/empire.constants';
import { DIFFICULTY_ORDER, MAP_SIZE_ORDER, MAX_EMPIRES, MIN_EMPIRES, NEUTRAL_STATES_ORDER, type Difficulty, type MapSize, type NeutralStates } from '../../session/flow';

export type { MenuScreenProps, PickTarget, SegmentProps };

const difficultyLabel = (difficulty: Difficulty): string =>
  difficulty === 'easy' ? 'City Sim' : difficulty === 'normal' ? 'Nothing Personal' : 'Hurt Me';

const neutralStatesLabel = (amount: NeutralStates): string =>
  amount === 'none' ? 'None' : amount === 'few' ? 'Few' : 'Many';

const mapSizeLabel = (size: MapSize): string =>
  size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large';

const factionById = (id: string): FactionDef => FACTIONS.find(faction => faction.id === id) ?? FACTIONS[0]!;

const MODIFIER_LABELS: Readonly<Record<string, string>> = {
  attack: 'attack',
  defence: 'defence',
  goldIncome: 'gold',
  buildCost: 'build cost',
  growth: 'growth',
  scienceRate: 'science',
};

function bonusLine(modifier: Modifier): string {
  const name = MODIFIER_LABELS[modifier.key] ?? modifier.key;
  if (modifier.mul !== undefined) {
    const delta = Math.round((modifier.mul - 1) * 100);
    return `${delta >= 0 ? '+' : ''}${delta}% ${name}`;
  }
  if (modifier.add !== undefined) return `${modifier.add >= 0 ? '+' : ''}${modifier.add} ${name}`;
  return name;
}

const isBuff = (modifier: Modifier): boolean =>
  modifier.key === 'buildCost' ? (modifier.mul ?? 1) < 1 : (modifier.mul ?? 1) >= 1 && (modifier.add ?? 0) >= 0;

const Bonuses = (props: { faction: FactionDef }) => (
  <span class="setup-bonuses">
    <For each={props.faction.bonuses}>
      {modifier => (
        <span class={`setup-chip${isBuff(modifier) ? ' is-buff' : ' is-debuff'}`}>{bonusLine(modifier)}</span>
      )}
    </For>
  </span>
);

function Segment<T extends string | number>(props: SegmentProps<T>) {
  return (
    <div class="setup-field">
      <span class="setup-field-label">{props.label}</span>
      <div class="setup-segmented">
        <For each={props.options}>
          {option => (
            <button
              type="button"
              class={`setup-seg${props.value === option ? ' is-active' : ''}`}
              aria-pressed={props.value === option}
              onClick={() => props.onSelect(option)}
            >
              {props.render(option)}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

export const MenuScreen = (props: MenuScreenProps) => {
  const [picking, setPicking] = createSignal<PickTarget | null>(null);

  const slots = () => [props.faction, ...props.settings.bots];
  const openSlots = () => Array.from({ length: MAX_EMPIRES - slots().length });
  const canRemove = () => slots().length > MIN_EMPIRES;
  const botNames = () => empireNames(props.settings.seed, slots().length);

  const pickedFaction = () => {
    const target = picking();
    return typeof target === 'number' ? slots()[target] : undefined;
  };

  const assign = (factionId: string) => {
    const target = picking();
    setPicking(null);
    if (target === null) return;
    if (target === 0) return props.onSelectFaction(factionId);
    const bots = [...props.settings.bots];
    if (target === 'new') bots.push(factionId);
    else bots[target - 1] = factionId;
    props.onChange({ bots });
  };

  const removeBot = (slot: number) =>
    props.onChange({ bots: props.settings.bots.filter((_, index) => index !== slot - 1) });

  return (
    <div class="setup-screen">
      <header class="setup-header">
        <div>
          <h1 class="setup-title">
            <img class="setup-title-logo" src="/images/swords.svg" alt="" draggable={false} />
            The <em>Big</em> War
          </h1>
          <p class="setup-subtitle">Last empire standing wins.</p>
        </div>
      </header>

      <div class="setup-body">
        <section class="setup-frame setup-players">
          <h2 class="setup-heading">
            Players <span class="setup-count">{slots().length}/{MAX_EMPIRES}</span>
          </h2>
          <label class="setup-name-field">
            <span class="setup-field-label">Nation name</span>
            <input
              class="setup-name-input"
              type="text"
              maxlength={24}
              autocomplete="nickname"
              placeholder={factionById(props.faction).name}
              value={props.playerName}
              onInput={event => props.onNameChange(event.currentTarget.value)}
            />
          </label>
          <div class="setup-grid">
            <For each={slots()}>
              {(factionId, slot) => {
                const faction = () => factionById(factionId);
                const promised = () => slot() === 0 && isUnlimitedGoldName(props.playerName);
                return (
                  <div
                    class={`setup-slot${promised() ? ' is-promised' : ''}`}
                    style={{ '--tint': promised() ? 'var(--street-accent)' : `var(--faction-${slot()})` }}
                  >
                    <button type="button" class="setup-card" onClick={() => setPicking(slot())}>
                      <span class="setup-card-flag">{promised() ? (
                          <svg class="setup-card-cross" viewBox="0 0 20 28" aria-hidden="true">
                            <path d="M7 1h6v7h6v6h-6v13H7V14H1V8h6z" />
                          </svg>
                        ) : (
                          factionIcon(faction().id)
                        )}</span>
                      <span class="setup-card-text">
                        <span class="setup-card-name">
                          {slot() === 0 ? props.playerName.trim() || 'Zombo' : (botNames()[slot()] ?? `Bot ${slot()}`)}
                        </span>
                        <span class="setup-card-who">{promised() ? CHEAT_UNLIMITED_GOLD_TITLE : faction().name}</span>
                        <Show
                          when={!promised()}
                          fallback={<span class="setup-card-perk">{CHEAT_UNLIMITED_GOLD_PERK}</span>}
                        >
                          <Show when={faction().bonuses[0]}>
                            {perk => <span class="setup-card-perk">{bonusLine(perk())}</span>}
                          </Show>
                        </Show>
                      </span>
                    </button>
                    <Show when={slot() > 0 && canRemove()}>
                      <button
                        type="button"
                        class="setup-remove"
                        aria-label={`Remove bot ${slot()}`}
                        onClick={() => removeBot(slot())}
                      >
                        ×
                      </button>
                    </Show>
                  </div>
                );
              }}
            </For>
            <For each={openSlots()}>
              {() => (
                <button type="button" class="setup-slot setup-add" aria-label="Add a bot" onClick={() => setPicking('new')}>
                  +
                </button>
              )}
            </For>
          </div>
        </section>
        <aside class="setup-frame setup-rules">
          <h2 class="setup-heading">Rules of war</h2>
          <Segment
            label="Map size"
            options={MAP_SIZE_ORDER}
            value={props.settings.mapSize}
            render={mapSizeLabel}
            onSelect={mapSize => props.onChange({ mapSize })}
          />
          <Segment
            label="Difficulty"
            options={DIFFICULTY_ORDER}
            value={props.settings.difficulty}
            render={difficultyLabel}
            onSelect={difficulty => props.onChange({ difficulty })}
          />
          <Segment
            label="Neutral states"
            options={NEUTRAL_STATES_ORDER}
            value={props.settings.neutralStates}
            render={neutralStatesLabel}
            onSelect={neutralStates => props.onChange({ neutralStates })}
          />

          <button type="button" class="setup-begin" onClick={() => props.onStart()}>
            Begin the war
          </button>
        </aside>

      </div>

      <footer class="setup-footer" onClick={() => openAbout()}>
        <img class="setup-footer-logo" src="/images/we-love-snakes-text-only.png" alt="" draggable={false} />
      </footer>

      <Show when={picking() !== null}>
        <div class="setup-picker-backdrop" onClick={() => setPicking(null)}>
          <div class="setup-frame setup-picker" role="dialog" aria-label="Choose a faction" onClick={e => e.stopPropagation()}>
            <h2 class="setup-heading">Choose a faction</h2>
            <div class="setup-picker-list">
              <For each={FACTIONS}>
                {faction => (
                  <button
                    type="button"
                    class={`setup-option${pickedFaction() === faction.id ? ' is-selected' : ''}`}
                    onClick={() => assign(faction.id)}
                  >
                    <span class="setup-option-name">{faction.name}</span>
                    <span class="setup-option-blurb">{faction.blurb}</span>
                    <Bonuses faction={faction} />
                  </button>
                )}
              </For>
            </div>
            <button type="button" class="setup-seg setup-picker-cancel" onClick={() => setPicking(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};
