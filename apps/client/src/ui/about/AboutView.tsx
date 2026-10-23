import './AboutView.css';
import { createSignal, onCleanup, Show } from 'solid-js';
import { type AboutCard, type AboutSong, aboutCard, closeAbout } from './about';

export type { AboutCard };

const ABOUT_FADE_IN_MS = 2000;
const ABOUT_FADE_OUT_MS = 500;

interface SongHandle {
  fadeOut: () => void;
  stop: () => void;
}

const startSong = (song: AboutSong | null): SongHandle => {
  if (!song) return { fadeOut: () => undefined, stop: () => undefined };

  const clip = new Audio(song.url);
  let fadeFrame = 0;

  if (song.startSeconds > 0) {
    clip.addEventListener(
      'loadedmetadata',
      () => {
        clip.currentTime = song.startSeconds;
      },
      { once: true },
    );
  }

  const fadeVolumeTo = (target: number, durationMs: number): void => {
    const from = clip.volume;
    const startedAt = performance.now();

    const step = (now: number): void => {
      const progress = Math.min((now - startedAt) / durationMs, 1);

      clip.volume = from + (target - from) * progress;

      if (progress < 1) fadeFrame = requestAnimationFrame(step);
    };

    cancelAnimationFrame(fadeFrame);
    fadeFrame = requestAnimationFrame(step);
  };

  clip.volume = 0;
  clip.play().catch(() => undefined);
  fadeVolumeTo(1, ABOUT_FADE_IN_MS);

  return {
    fadeOut: () => fadeVolumeTo(0, ABOUT_FADE_OUT_MS),
    stop: () => {
      cancelAnimationFrame(fadeFrame);
      clip.pause();
      clip.removeAttribute('src');
      clip.load();
    },
  };
};

const AboutCardView = (props: { card: AboutCard }) => {
  const [isClosing, setIsClosing] = createSignal(false);
  const song = startSong(props.card.song);

  const dismiss = () => {
    if (isClosing()) return;

    song.fadeOut();
    setIsClosing(true);
    window.setTimeout(closeAbout, ABOUT_FADE_OUT_MS);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dismiss();
  };

  window.addEventListener('keydown', onKeyDown);
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown);
    song.stop();
  });

  return (
    <div class={isClosing() ? 'nitro-about is-closing' : 'nitro-about'} onClick={dismiss}>
      <div class="about-vignette" />
      <div class="about-content">
        <img class="about-logo" src="/images/we-love-snakes-logo.png" alt="" draggable={false} />
      </div>
    </div>
  );
};

export const AboutView = () => (
  <Show when={aboutCard()} keyed>
    {card => <AboutCardView card={card} />}
  </Show>
);
