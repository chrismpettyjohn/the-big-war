import type { Controllers } from '../../session/controllers';

export interface DiplomacyPanelProps {
  readonly controllers?: Controllers;
  readonly onClose: () => void;
}
