import type { JSX } from 'solid-js';

export type StreetDrawerHintHandler = (element: HTMLElement, label: string, isBranch?: boolean) => void;

export interface StreetDrawerHintApi {
  readonly showHint: StreetDrawerHintHandler;
  readonly hideHint: () => void;
}

export interface StreetDrawerRowProps {
  readonly label: string;
  readonly hint?: string;
  readonly title?: string;
  readonly glyph?: JSX.Element;
  readonly badge?: number;
  readonly isSelected?: boolean;
  readonly isDisabled?: boolean;
  readonly isPath?: boolean;
  readonly hasChildren?: boolean;
  readonly onHint?: StreetDrawerHintHandler;
  readonly onHintEnd?: () => void;
  readonly onClick: () => void;
}
