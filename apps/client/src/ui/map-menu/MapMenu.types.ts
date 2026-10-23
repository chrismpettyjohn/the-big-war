import type { Controllers } from '../../session/controllers';

export interface MapMenuProps {
  readonly controllers: Controllers;
  readonly onInspect: () => void;
  readonly onArmy: () => void;
  readonly onBuild: () => void;
  readonly onDiplomacy?: () => void;
}
