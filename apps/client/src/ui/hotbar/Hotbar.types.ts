import type { Controllers } from '../../session/controllers';
import type { BuildingKind } from '../../game/building/building.types';

export interface HotbarProps {
  readonly controllers: Controllers;
  readonly onInfo: (kind: BuildingKind) => void;
}
