import { type JSX, Show } from 'solid-js';

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export type BarVariant = 'neutral' | 'accent' | 'health' | 'danger' | 'info';

/** HabCrab hud-bar: thin labelled meter. */
export const Bar = (props: {
  readonly label: string;
  readonly ratio: number;
  readonly value?: string | number;
  readonly variant?: BarVariant;
  readonly children?: JSX.Element;
}) => (
  <div class={`hud-bar hud-bar--${props.variant ?? 'neutral'}`}>
    <div class="hud-bar-fill" style={{ width: `${clamp01(props.ratio) * 100}%` }} />
    <span class="hud-bar-label">{props.label}</span>
    <Show when={props.value !== undefined}>
      <span class="hud-bar-value">{props.value}</span>
    </Show>
    {props.children}
  </div>
);
