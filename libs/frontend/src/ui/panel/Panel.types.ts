import type { JSX } from 'solid-js';

export interface PanelProps {
  readonly title: string;
  readonly kind?: string;
  readonly class?: string;
  readonly tier?: JSX.Element;
  readonly onClose?: () => void;
  readonly headExtra?: JSX.Element;
  readonly children: JSX.Element;
}
