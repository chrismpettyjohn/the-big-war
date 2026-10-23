import type { JSX } from 'solid-js';

export type BarVariant = 'neutral' | 'accent' | 'health' | 'danger' | 'info';

export interface BarProps {
  readonly label: string;
  readonly ratio: number;
  readonly value?: string | number;
  readonly variant?: BarVariant;
  readonly children?: JSX.Element;
}
