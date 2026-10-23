/**
 * Faction picker: choose your empire's strengths before the war.
 *
 * Cards render from `FACTIONS` data (name, blurb, bonuses) — adding a faction in
 * config.ts makes it appear here with no UI change. Bonus lines are formatted
 * generically from `Modifier` data so new modifier keys never break the layout.
 */

import { For } from 'solid-js';
import { FACTIONS } from '../game/config';
import type { Modifier } from '../game/types';
import { t } from '../i18n';

export interface FactionPickerProps {
  readonly selected: string;
  readonly onSelect: (factionId: string) => void;
  readonly onConfirm: () => void;
  readonly onBack: () => void;
}

/** "+15% attack" / "−10% gold income" from a Modifier. */
function bonusLine(modifier: Modifier): string {
  const name = modifier.key;
  if (modifier.mul !== undefined) {
    const delta = Math.round((modifier.mul - 1) * 100);
    return `${delta >= 0 ? '+' : ''}${delta}% ${name}`;
  }
  if (modifier.add !== undefined) return `${modifier.add >= 0 ? '+' : ''}${modifier.add} ${name}`;
  return name;
}

export const FactionPicker = (props: FactionPickerProps) => (
  <div class="kit-screen">
    <div class="kit-screen-inner">
      <h1 class="kit-title">{t('faction.title')}</h1>
      <p class="kit-note">{t('app.tagline')}</p>

      <div class="kit-factions">
        <For each={FACTIONS}>
          {faction => (
            <button
              type="button"
              class={`kit-faction-card${props.selected === faction.id ? ' is-selected' : ''}`}
              aria-pressed={props.selected === faction.id}
              onClick={() => props.onSelect(faction.id)}
            >
              <span class="hud-card-swatch" style={{ background: `var(--faction-${faction.colorIndex})` }} />
              <span class="kit-faction-name">{faction.name}</span>
              <span class="kit-faction-blurb">{faction.blurb}</span>
              <span class="kit-faction-bonuses">
                <For each={faction.bonuses}>{modifier => <span>{bonusLine(modifier)}</span>}</For>
              </span>
            </button>
          )}
        </For>
      </div>

      <div class="kit-actions">
        <button type="button" class="kit-button is-ghost" onClick={() => props.onBack()}>
          {t('faction.back')}
        </button>
        <button type="button" class="kit-button is-primary" onClick={() => props.onConfirm()}>
          {t('faction.start')}
        </button>
      </div>
    </div>
  </div>
);
