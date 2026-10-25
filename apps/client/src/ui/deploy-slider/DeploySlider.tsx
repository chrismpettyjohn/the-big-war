import './DeploySlider.css';
import type { DeploySliderProps } from './DeploySlider.types';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { FaCaretDown, FaCaretUp, FaUndo } from '@the-big-war/frontend/ui/icons/icons';

export type { DeploySliderProps };

const HOLD_DELAY_MS = 300;
const HOLD_REPEAT_MS = 50;

export const DeploySlider = (props: DeploySliderProps) => {
  const percent = () => props.controllers.troopPercent();
  let delay: ReturnType<typeof setTimeout> | undefined;
  let repeat: ReturnType<typeof setInterval> | undefined;

  const step = (dir: 1 | -1) =>
    props.controllers.setTroopPercent(Math.min(100, Math.max(1, percent() + dir)));

  const stop = () => {
    clearTimeout(delay);
    clearInterval(repeat);
    delay = repeat = undefined;
  };

  const start = (dir: 1 | -1, event: PointerEvent) => {
    event.preventDefault();
    stop();
    step(dir);
    delay = setTimeout(() => {
      repeat = setInterval(() => step(dir), HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  };

  onCleanup(stop);

  const [height, setHeight] = createSignal<number | null>(null);
  onMount(() => {
    const hotbar = document.querySelector<HTMLElement>('.hud-hotbar');
    if (!hotbar) return;
    const observer = new ResizeObserver(() => setHeight(hotbar.offsetHeight));
    observer.observe(hotbar);
    onCleanup(() => observer.disconnect());
  });

  const caret = (dir: 1 | -1) => (
    <button
      type="button"
      class="deploy-slider-caret"
      aria-label={dir > 0 ? 'Deploy more troops' : 'Deploy fewer troops'}
      onPointerDown={event => start(dir, event)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') step(dir);
      }}
    >
      {dir > 0 ? <FaCaretUp /> : <FaCaretDown />}
    </button>
  );

  const trayHeight = () => (height() === null ? undefined : `${height()}px`);

  return (
    <div class="deploy-slider-dock">
      <Show when={props.cameraMoved}>
        <div class="deploy-slider-reset-tray street-tray kit-glass">
          <button
            type="button"
            class="street-action is-wide deploy-slider-reset"
            title="Reset map view"
            aria-label="Reset map view"
            onClick={() => props.onReset()}
          >
            <FaUndo />
            <span>Reset view</span>
          </button>
        </div>
      </Show>
      <div class="deploy-slider street-tray kit-glass" style={{ height: trayHeight() }}>
        <span class="deploy-slider-label kit-num" aria-live="polite">
          {percent()}% troops
        </span>
        <div class="deploy-slider-carets">
          {caret(1)}
          {caret(-1)}
        </div>
      </div>
    </div>
  );
};
