import type { Accessor } from 'solid-js';
import type { GameStore } from '../game/store/store.types';
import type { BuildingKind } from '../game/building/building.types';
import type { CommandError } from '../game/commands/commands.types';
import type { Axial, Pixel } from '@the-big-war/game-engine/world-tile/world-tile.types';

export type Tool =
  | { readonly kind: 'idle' }
  | { readonly kind: 'place'; readonly building: BuildingKind }
  | { readonly kind: 'cannon'; readonly from: Axial };

export interface ContextMenuState {
  readonly at: Pixel;
  readonly hex: Axial;
}

export interface CommandNotice {
  readonly id: number;
  readonly reason: CommandError;
}

export interface Controllers {
  readonly selectedHex: Accessor<Axial | null>;
  readonly hoverHex: Accessor<Axial | null>;
  readonly tool: Accessor<Tool>;
  readonly troopPercent: Accessor<number>;
  readonly contextMenu: Accessor<ContextMenuState | null>;
  readonly notices: Accessor<readonly CommandNotice[]>;

  selectHex(hex: Axial | null): void;
  setHover(hex: Axial | null): void;
  setTroopPercent(percent: number): void;
  setTool(tool: Tool): void;
  cancelTool(): void;
  openContextMenu(at: Pixel, hex: Axial): void;
  closeContextMenu(): void;

  hexAtScreen(at: Pixel): Axial | null;

  tap(at: Pixel, button: 'primary' | 'secondary'): void;

  dragOver(client: Pixel): void;
  dropAt(client: Pixel): void;
  
  secondary(at: Pixel): void;
  
  key(key: string): void;
  
  notice(reason: CommandError): void;
  dismissNotice(id: number): void;
}

export interface ControllerDeps {
  readonly store: GameStore;
  
  readonly viewport: () => Pixel;
  
  readonly screenToHex: (at: Pixel) => Axial | null;

  readonly clientToHex: (at: Pixel) => Axial | null;
  
  readonly onTroopsSent?: (from: Axial, target: Axial) => void;
  
  readonly onToolChanged?: (tool: Tool) => void;
}
