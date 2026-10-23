import type { JSX } from 'solid-js';

export type MenuEntry =
  | { readonly type: 'header'; readonly label: string }
  | { readonly type: 'divider' }
  | {
      readonly type: 'item';
      readonly label: string;
      readonly note?: string;
      readonly danger?: boolean;
      readonly disabled?: boolean;
      readonly icon?: JSX.Element;
      readonly onClick: () => void;
    };

export interface ContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly entries: readonly MenuEntry[];
  readonly onClose: () => void;
}
