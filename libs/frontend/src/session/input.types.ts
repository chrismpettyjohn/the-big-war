import type { Pixel } from '@the-big-war/game-engine/world-tile/world-tile.types';

export type InputIntent =
  | { readonly kind: 'pan'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'zoom'; readonly factor: number; readonly anchor: Pixel }
  | { readonly kind: 'tap'; readonly at: Pixel }
  | { readonly kind: 'longPress'; readonly at: Pixel }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'hover'; readonly at: Pixel }
  | { readonly kind: 'leave' }
  | { readonly kind: 'panEnd' }
  | { readonly kind: 'key'; readonly key: string };

export interface InputHost {
  
  readonly element: HTMLElement;
  
  readonly viewport: () => Pixel;
  
  readonly onIntent: (intent: InputIntent) => void;
}

export interface PointerState {
  id: number;
  
  startX: number;
  startY: number;
  
  lastX: number;
  lastY: number;
  
  dragging: boolean;
  
  timer: ReturnType<typeof setTimeout> | null;
  
  consumed: boolean;
}
