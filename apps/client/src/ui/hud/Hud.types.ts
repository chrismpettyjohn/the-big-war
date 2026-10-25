import type { Controllers } from '../../session/controllers';

export interface HudProps {
  readonly controllers?: Controllers;

  
  readonly onFaction?: () => void;
  
  readonly onDiplomacy?: () => void;
}
