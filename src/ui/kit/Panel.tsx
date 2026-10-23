import { type JSX, Show } from 'solid-js';

/** HabCrab street-drawer style panel that docks beside the rail (or right side). */
export const Panel = (props: {
  readonly title: string;
  readonly kind?: string;
  readonly side?: 'left' | 'right';
  readonly onClose?: () => void;
  readonly headExtra?: JSX.Element;
  readonly children: JSX.Element;
}) => (
  <section
    class={`street-drawer-panel${props.side === 'right' ? ' is-right' : ''}`}
    role="dialog"
    aria-label={props.title}
  >
    <header class="street-drawer-panel-head">
      <h2 class="street-drawer-panel-title">{props.title}</h2>
      <Show when={props.kind}>
        <span class="street-drawer-panel-kind">{props.kind}</span>
      </Show>
      {props.headExtra}
      <Show when={props.onClose}>
        <button type="button" class="street-drawer-panel-close" aria-label="Close" onClick={() => props.onClose?.()}>
          ✕
        </button>
      </Show>
    </header>
    <div class="street-drawer-panel-body">{props.children}</div>
  </section>
);
