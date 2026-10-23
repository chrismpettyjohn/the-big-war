import type { Controllers } from '../../session/controllers';

export interface ArmyPanelProps {
  readonly controllers: Controllers;
  readonly onClose: () => void;
}
