import './StreetDrawer.css';
import { Portal } from 'solid-js/web';
import { FaChevronRight, FaTimes } from '../icons/icons';
import { createContext, createSignal, type JSX, onCleanup, onMount, Show, useContext } from 'solid-js';
import type {
  StreetDrawerHintApi,
  StreetDrawerHintHandler,
  StreetDrawerRowProps,
} from './StreetDrawer.types';

export type * from './StreetDrawer.types';

const MAX_BADGE = 99;
const HINT_GAP = 6;

const join = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(' ');
const badgeText = (count: number) => (count > MAX_BADGE ? '99+' : String(count));

const exclusiveDrawers = new Set<() => void>();

export const useStreetDrawerExclusive = (isOpen: () => boolean, close: () => void): (() => void) => {
  const listener = () => {
    if (isOpen()) close();
  };

  exclusiveDrawers.add(listener);
  onCleanup(() => exclusiveDrawers.delete(listener));

  return () => {
    for (const other of exclusiveDrawers) if (other !== listener) other();
  };
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return (
    element?.tagName === 'INPUT' ||
    element?.tagName === 'TEXTAREA' ||
    element?.tagName === 'SELECT' ||
    !!element?.isContentEditable
  );
};

export const useStreetDrawerEscape = (close: () => void) => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target) || event.repeat || event.key !== 'Escape') return;
    close();
  };
  onMount(() => window.addEventListener('keydown', onKeyDown));
  onCleanup(() => window.removeEventListener('keydown', onKeyDown));
};

export const streetDrawerStyle = (tiers: number, labeled = 0): JSX.CSSProperties => ({
  '--street-drawer-tiers': String(tiers),
  '--street-drawer-labeled': String(labeled),
});

export const StreetDrawerHintContext = createContext<StreetDrawerHintApi>();

export const useStreetDrawerHint = () => {
  let drawer: HTMLDivElement | undefined;
  const [hint, setHint] = createSignal<{ label: string; isBranch: boolean; top: number; left: number } | null>(null);

  const showHint: StreetDrawerHintHandler = (element, label, isBranch = false) => {
    if (!drawer) return;

    const box = drawer.getBoundingClientRect();
    const row = element.getBoundingClientRect();
    const panel = (element.closest('.street-drawer-tier-panel') ?? element).getBoundingClientRect();

    setHint({ label, isBranch, top: row.top - box.top + row.height / 2, left: panel.right - box.left + HINT_GAP });
  };

  const HintView = () => (
    <Show when={hint()}>
      {current => (
        <div
          class="street-drawer-hint"
          style={{ top: `${current().top}px`, left: `${current().left}px` }}
          role="tooltip"
        >
          {current().label}
          <Show when={current().isBranch}>
            <FaChevronRight />
          </Show>
        </div>
      )}
    </Show>
  );

  return {
    drawerRef: (element: HTMLDivElement) => (drawer = element),
    showHint,
    hideHint: () => setHint(null),
    HintView,
  };
};

export const StreetDrawerRow = (props: StreetDrawerRowProps) => {
  const context = useContext(StreetDrawerHintContext);
  const onHint = () => props.onHint ?? context?.showHint;
  const onHintEnd = () => props.onHintEnd ?? context?.hideHint;
  const hasGlyph = () => props.glyph !== undefined;
  const badge = () => props.badge ?? 0;
  const hintLabel = () => props.hint ?? props.label;
  const classes = () =>
    join(
      'street-drawer-row',
      props.isSelected ? 'is-selected' : props.isPath && 'is-path',
      props.hasChildren && 'has-children',
      !hasGlyph() && 'is-text',
      props.isDisabled && 'is-disabled',
    );

  return (
    <button
      type="button"
      class={classes()}
      title={onHint() ? undefined : (props.title ?? props.label)}
      aria-label={props.label}
      aria-current={props.isSelected ? 'page' : undefined}
      aria-disabled={props.isDisabled || undefined}
      onMouseEnter={event => onHint()?.(event.currentTarget, hintLabel(), props.hasChildren ?? false)}
      onMouseLeave={() => onHintEnd()?.()}
      onFocus={event => {
        if (event.currentTarget.matches(':focus-visible'))
          onHint()?.(event.currentTarget, hintLabel(), props.hasChildren ?? false);
      }}
      onBlur={() => onHintEnd()?.()}
      onClick={() => {
        if (!props.isDisabled) props.onClick();
      }}
    >
      <Show when={hasGlyph()}>
        <span class="street-drawer-glyph">
          {props.glyph}
          <Show when={badge() > 0}>
            <span class="street-drawer-badge">{badgeText(badge())}</span>
          </Show>
        </span>
      </Show>
      <span class="street-drawer-label">{props.label}</span>
      <Show when={!hasGlyph() && badge() > 0}>
        <span class="street-drawer-count">{badgeText(badge())}</span>
      </Show>
      <Show when={props.hasChildren}>
        <FaChevronRight class="street-drawer-caret" />
      </Show>
    </button>
  );
};

export const StreetDrawerTier = (props: {
  readonly label: string;
  readonly head?: JSX.Element;
  readonly foot?: JSX.Element;
  readonly isPinned?: boolean;
  readonly isLabeled?: boolean;
  readonly onScroll?: () => void;
  readonly children?: JSX.Element;
}) => {
  const context = useContext(StreetDrawerHintContext);
  return (
    <nav
      class={join('street-drawer-tier', props.isPinned && 'is-pinned', props.isLabeled && 'is-labeled')}
      aria-label={props.label}
    >
      <div class="street-drawer-tier-panel">
        {props.head}
        <div class="street-drawer-tier-list" onScroll={() => (props.onScroll ?? context?.hideHint)?.()}>
          {props.children}
        </div>
        <Show when={props.foot}>
          <div class="street-drawer-tier-foot">{props.foot}</div>
        </Show>
      </div>
    </nav>
  );
};

export const StreetDrawerRoot = (props: {
  readonly ref: (element: HTMLDivElement) => void;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
  readonly onMouseLeave?: () => void;
  readonly children?: JSX.Element;
}) => (
  <Portal>
    <div
      ref={props.ref}
      class={join('street-drawer', props.class)}
      style={props.style}
      onMouseLeave={() => props.onMouseLeave?.()}
    >
      {props.children}
    </div>
  </Portal>
);

export const StreetDrawerPanel = (props: {
  readonly label: string;
  readonly class?: string;
  readonly children?: JSX.Element;
}) => (
  <section class={join('street-drawer-panel', props.class)} aria-label={props.label}>
    {props.children}
  </section>
);

export const StreetDrawerCloseButton = (props: { readonly label?: string; readonly onClick: () => void }) => (
  <button
    type="button"
    class="street-drawer-panel-close"
    aria-label={props.label ?? 'Close'}
    title={props.label ?? 'Close'}
    onClick={() => props.onClick()}
  >
    <FaTimes />
  </button>
);

export const StreetDrawerPanelTitle = (props: { readonly title: string }) => (
  <span class="street-drawer-panel-title" title={props.title}>
    {props.title}
  </span>
);

export const StreetDrawerPanelCount = (props: {
  readonly isFull?: boolean;
  readonly title?: string;
  readonly children?: JSX.Element;
}) => (
  <span class={join('street-drawer-panel-count', props.isFull && 'is-full')} title={props.title}>
    {props.children}
  </span>
);

export const StreetDrawerPanelHead = (props: {
  readonly title?: string;
  readonly count?: JSX.Element;
  readonly closeLabel?: string;
  readonly onClose?: () => void;
  readonly children?: JSX.Element;
}) => (
  <div class="street-drawer-panel-head">
    <Show when={props.title !== undefined}>
      <StreetDrawerPanelTitle title={props.title ?? ''} />
    </Show>
    <Show when={props.count !== undefined && props.count !== null}>
      <StreetDrawerPanelCount>{props.count}</StreetDrawerPanelCount>
    </Show>
    {props.children}
    <Show when={props.onClose}>
      {close => <StreetDrawerCloseButton label={props.closeLabel ?? 'Close'} onClick={close()} />}
    </Show>
  </div>
);

export const StreetDrawerPanelKind = (props: { readonly class?: string; readonly children?: JSX.Element }) => (
  <div class={join('street-drawer-panel-kind', props.class)}>{props.children}</div>
);
