export interface FactionPickerProps {
  readonly selected: string;
  readonly onSelect: (factionId: string) => void;
  readonly onConfirm: () => void;
  readonly onBack: () => void;
}
