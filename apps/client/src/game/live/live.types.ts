import type { HexCell } from '../map/map.types';
import type { FrameChanges } from '../sim/sim.types';
import type { GameState } from '../state/state.types';
import type { EmpireId } from '../empire/empire.types';
import type { BuildingId } from '../building/building.types';
import type { ProductionQueue, Unit, UnitKind } from '../unit/unit.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';

export interface TriggerCache<K> {
  track(key: K): void;
  dirty(key: K): void;
  dirtyAll(): void;
}

export interface KeyedStores<K, V> {
  get(key: K): V | null;
  dirty(key: K): void;
  dirtyAll(): void;
}

export type LiveSlice = 'static' | 'grid' | 'units' | 'roster' | 'ships' | 'walkers' | 'production' | 'events';

export type UnitCounts = Readonly<Record<UnitKind, number>>;

export interface LiveQueries {
  cell(at: number): HexCell | null;
  cellAt(hex: Axial | null): HexCell | null;
  productionFor(building: BuildingId): ProductionQueue | null;
  roster(): readonly Unit[];
  population(empire: EmpireId): number;
  unitCounts(empire: EmpireId): UnitCounts;
}

export interface LiveState extends LiveQueries {
  readonly view: GameState;
  readonly raw: GameState;
  readonly paused: () => boolean;
  setPaused(paused: boolean): void;
  load(state: GameState): void;
  apply(changes: FrameChanges): void;
}
