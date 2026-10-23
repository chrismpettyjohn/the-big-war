/**
 * End screen: who won and why, plus the two ways out (fight again / main menu).
 *
 * `endReason` drives the subtitle from data, and the winner's name comes from the
 * empire list, so nothing here assumes the player won or lost.
 */

import { gameStore } from '../game/store';
import { t } from '../i18n';
import { factionLabel } from '../ui/text';

export interface EndScreenProps {
  readonly playerWon: boolean;
  readonly onAgain: () => void;
  readonly onMenu: () => void;
}

export const EndScreen = (props: EndScreenProps) => {
  const store = gameStore();
  const winner = () => (store.state.winner === null ? null : store.state.empires[store.state.winner]);
  const reason = () => store.state.endReason ?? 'elimination';

  const reasonText = () => {
    if (reason() === 'territory') {
      return t('end.reason.territory', { owner: factionLabel(winner()?.factionId ?? '') });
    }
    if (reason() === 'timeLimit') return t('end.reason.timeLimit');
    return t('end.reason.elimination');
  };

  return (
    <div class="kit-screen">
      <div class="kit-screen-inner">
        <div class="kit-result">
          <span
            class={`kit-result-outcome ${props.playerWon ? 'is-victory' : 'is-defeat'}`}
          >
            {props.playerWon ? t('end.victory') : t('end.defeat')}
          </span>
          <span class="kit-subtitle">{reasonText()}</span>
          <span class="kit-note">
            {t('panel.empires.title')}: {store.state.empires.filter(empire => empire.alive).length} /{' '}
            {store.state.empires.length} · {t('hud.time')}{' '}
            {Math.floor(store.state.elapsed / 60)}:{String(Math.floor(store.state.elapsed % 60)).padStart(2, '0')}
          </span>
        </div>
        <div class="kit-actions">
          <button type="button" class="kit-button is-ghost" onClick={() => props.onMenu()}>
            {t('end.menu')}
          </button>
          <button type="button" class="kit-button is-primary" onClick={() => props.onAgain()}>
            {t('end.again')}
          </button>
        </div>
      </div>
    </div>
  );
};
