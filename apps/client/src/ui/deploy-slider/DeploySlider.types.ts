import type { Controllers } from '../../session/controllers';

export interface DeploySliderProps {
  readonly controllers: Controllers;
  readonly cameraMoved: boolean;
  readonly onReset: () => void;
}
