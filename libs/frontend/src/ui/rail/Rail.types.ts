import type { JSX } from 'solid-js';

export interface RailProps {
  readonly brand?: JSX.Element;
  readonly onBrand?: () => void;
  readonly label?: string;
  readonly children: JSX.Element;
}

export interface RailActionProps {
  readonly label: string;
  readonly icon: JSX.Element;
  readonly active?: boolean;
  readonly danger?: boolean;
  readonly building?: boolean;
  readonly disabled?: boolean;
  readonly badge?: number;
  readonly badgeAccent?: boolean;
  readonly onClick: () => void;
}
