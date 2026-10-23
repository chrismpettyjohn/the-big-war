import type { BuildingKind } from '../../game/building/building.types';

export interface WikiPanelProps {
  readonly focus: BuildingKind | null;
  readonly onClose: () => void;
}
