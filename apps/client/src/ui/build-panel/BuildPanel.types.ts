import type { Controllers } from '../../session/controllers';

export interface BuildPanelProps {
  readonly controllers: Controllers;
  readonly onClose: () => void;
}
