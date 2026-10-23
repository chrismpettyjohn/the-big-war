import { createSignal, onCleanup, onMount, type JSX, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

/**
 * HabCrab-style left rail (sidebar): fixed, vertically centered, glass panel,
 * stacked icon actions with hover hints that pop out to the right.
 */

const RAIL_HEIGHT_PROPERTY = '--ui-rail-height';
const HINT_GAP = 10;
const MAX_BADGE = 99;

export const Rail = (props: {
  readonly brand?: JSX.Element;
  readonly onBrand?: () => void;
  readonly label?: string;
  readonly children: JSX.Element;
}) => {
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
        <button
          type="button"
          class="nitro-about-command"
          onClick={() => props.onBrand?.()}
          aria-label="Menu"
          title="Menu"
        >
          {props.brand}
        </button>
      </Show>
      {props.children}
    </nav>
  );
};

export const RailAction = (props: {
  readonly label: string;
  readonly icon: JSX.Element;
  readonly active?: boolean;
  readonly danger?: boolean;
  readonly building?: boolean;
  readonly disabled?: boolean;
  readonly badge?: number;
  readonly badgeAccent?: boolean;
  readonly onClick: () => void;
}) => {
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
              class="street-drawer-hint"
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
