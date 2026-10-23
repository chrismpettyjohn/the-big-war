import './Rail.css';
import { Portal } from 'solid-js/web';
import type { RailActionProps, RailProps } from './Rail.types';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';

export type { RailActionProps, RailProps };

const RAIL_HEIGHT_PROPERTY = '--ui-rail-height';
const HINT_GAP = 10;
const MAX_BADGE = 99;

export const Rail = (props: RailProps) => {
  let rail: HTMLElement | undefined;

  onMount(() => {
    if (!rail) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty(RAIL_HEIGHT_PROPERTY, `${rail?.offsetHeight ?? 0}px`),
    );
    observer.observe(rail);
    onCleanup(() => {
      observer.disconnect();
      root.style.removeProperty(RAIL_HEIGHT_PROPERTY);
    });
  });

  return (
    <nav ref={el => (rail = el)} class="nitro-sidebar" aria-label={props.label ?? 'Main navigation'}>
      <Show when={props.brand}>
        <Show
          when={props.onBrand}
          fallback={<div class="nitro-about-command">{props.brand}</div>}
        >
          <button
            type="button"
            class="nitro-about-command"
            onClick={() => props.onBrand?.()}
            aria-label="About The Big War"
            title="About The Big War"
          >
            {props.brand}
          </button>
        </Show>
      </Show>
      {props.children}
    </nav>
  );
};

export const RailAction = (props: RailActionProps) => {
  const [hint, setHint] = createSignal<{ top: number; left: number } | null>(null);

  const showHint = (element: HTMLElement) => {
    const button = element.getBoundingClientRect();
    const rail = (element.closest('.nitro-sidebar') ?? element).getBoundingClientRect();
    setHint({ top: button.top + button.height / 2, left: rail.right + HINT_GAP });
  };

  const classes = () =>
    [
      'street-action',
      props.active ? 'is-active' : '',
      props.danger ? 'is-danger' : '',
      props.building ? 'is-building' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <>
      <button
        type="button"
        aria-label={props.label}
        aria-pressed={props.active ?? false}
        disabled={props.disabled ?? false}
        class={classes()}
        onClick={() => props.onClick()}
        onMouseEnter={event => showHint(event.currentTarget)}
        onMouseLeave={() => setHint(null)}
        onFocus={event => showHint(event.currentTarget)}
        onBlur={() => setHint(null)}
      >
        {props.icon}
        <Show when={(props.badge ?? 0) > 0}>
          <span class={props.badgeAccent ? 'street-action-badge is-accent' : 'street-action-badge'}>
            {(props.badge ?? 0) > MAX_BADGE ? '99+' : props.badge}
          </span>
        </Show>
      </button>
      <Show when={hint()}>
        {position => (
          <Portal>
            <div
              class="street-drawer-hint nitro-sidebar-hint"
              style={{ top: `${position().top}px`, left: `${position().left}px` }}
              role="tooltip"
            >
              {props.label}
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
};
