/**
 * Menu screen: match setup before the war starts.
 *
 * Choices map straight onto `MatchSettings` → `GameConfig` (see session/flow.ts),
 * so nothing here hardcodes map sizes or limits — the segmented controls render
 * from the exported option lists.
 */

import { For } from 'solid-js';
import {
  MAP_SIZE_ORDER,
  MAX_EMPIRES,
  MIN_EMPIRES,
  TIME_LIMIT_OPTIONS,
  type MapSize,
  type MatchSettings,
} from '../session/flow';
import { LANGUAGES, LANGUAGE_NAMES, currentLanguage, setLanguage, t } from '../i18n';
import { FACTIONS } from '../game/config';

export interface MenuScreenProps {
  readonly settings: MatchSettings;
  readonly onChange: (patch: Partial<MatchSettings>) => void;
  readonly onStart: () => void;
}

const mapSizeLabel = (size: MapSize): string =>
  size === 'small' ? t('menu.mapSmall') : size === 'medium' ? t('menu.mapMedium') : t('menu.mapLarge');

/** One segmented option row. */
function Segment<T extends string | number>(props: {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly render: (option: T) => string;
  readonly onSelect: (option: T) => void;
}) {
  return (
    <div class="kit-field">
      <span class="kit-field-label">{props.label}</span>
      <div class="kit-segmented">
        <For each={props.options}>
          {option => (
            <button
              type="button"
              class={`kit-button${props.value === option ? ' is-active' : ''}`}
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

export const MenuScreen = (props: MenuScreenProps) => (
  <div class="kit-screen">
    <div class="kit-screen-inner">
      <h1 class="kit-title">
        The <em>Big</em> War
      </h1>
      <p class="kit-subtitle">{t('app.tagline')}</p>

      <Segment
        label={t('menu.empires')}
        options={Array.from({ length: MAX_EMPIRES - MIN_EMPIRES + 1 }, (_, index) => MIN_EMPIRES + index)}
        value={props.settings.empires}
        render={count => `${count}`}
        onSelect={empires => props.onChange({ empires })}
      />
      <Segment
        label={t('menu.mapSize')}
        options={MAP_SIZE_ORDER}
        value={props.settings.mapSize}
        render={mapSizeLabel}
        onSelect={mapSize => props.onChange({ mapSize })}
      />
      <Segment
        label={t('menu.speed')}
        options={[1, 2, 4] as const}
        value={props.settings.speed}
        render={speed => `${speed}×`}
        onSelect={speed => props.onChange({ speed })}
      />
      <Segment
        label={t('menu.timeLimit')}
        options={TIME_LIMIT_OPTIONS}
        value={props.settings.timeLimitMinutes}
        render={minutes => t('menu.minutes', { n: minutes })}
        onSelect={timeLimitMinutes => props.onChange({ timeLimitMinutes })}
      />
      <Segment
        label={t('menu.language')}
        options={LANGUAGES}
        value={currentLanguage()}
        render={code => LANGUAGE_NAMES[code]}
        onSelect={code => setLanguage(code)}
      />

      <div class="kit-note">
        <strong>{FACTIONS.length}</strong> factions · {t('menu.tutorialHint')}
      </div>

      <div class="kit-actions">
        <button type="button" class="kit-button is-primary" onClick={() => props.onStart()}>
          {t('menu.play')}
        </button>
      </div>
    </div>
  </div>
);
