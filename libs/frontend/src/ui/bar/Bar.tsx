import './Bar.css';
import { Show } from 'solid-js';
import type { BarProps, BarVariant } from './Bar.types';

export type { BarProps, BarVariant };

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export const Bar = (props: BarProps) => (
  <div class={`hud-bar hud-bar--${props.variant ?? 'neutral'}`}>
    <div class="hud-bar-fill" style={{ width: `${clamp01(props.ratio) * 100}%` }} />
    <span class="hud-bar-label">{props.label}</span>
    <Show when={props.value !== undefined}>
      <span class="hud-bar-value">{props.value}</span>
    </Show>
    {props.children}
  </div>
);
