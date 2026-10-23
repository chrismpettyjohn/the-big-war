import type { MatchSettings } from '../../session/flow';

export interface MenuScreenProps {
  readonly settings: MatchSettings;
  readonly faction: string;
  readonly playerName: string;
  readonly onChange: (patch: Partial<MatchSettings>) => void;
  readonly onNameChange: (name: string) => void;
  readonly onSelectFaction: (factionId: string) => void;
  readonly onStart: () => void;
}

export interface SegmentProps<T extends string | number> {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly render: (option: T) => string;
  readonly onSelect: (option: T) => void;
}

export type PickTarget = number | 'new';
