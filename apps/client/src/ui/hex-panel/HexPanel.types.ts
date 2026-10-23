import type { Controllers } from '../../session/controllers';

export interface HexPanelProps {
  readonly controllers: Controllers;
  readonly onClose: () => void;
}
