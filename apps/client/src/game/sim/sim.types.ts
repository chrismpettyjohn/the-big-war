import type { Ship } from '../ship/ship.types';
import type { Empire } from '../empire/empire.types';
import type { ClientStore } from '../store/store.types';
import type { GameConfig } from '../config/config.types';
import type { Walker } from '../building/building.types';
import type { GameState, EndReason } from '../state/state.types';
import type { Command, CommandResult } from '../commands/commands.types';
import type { Boarding, ProductionQueue, UnitEvent, UnitId } from '../unit/unit.types';
import type { MatchStatus } from '@the-big-war/game-engine/simulation/simulation.types';

export type WalkerView = Omit<Walker, 'path'>;

export type ShipView = Omit<Ship, 'path'> & { path?: number[] };

export interface MatchFields {
  readonly status: MatchStatus;
  readonly playerEmpire: number;
  readonly speed: GameState['speed'];
  readonly tick: number;
  readonly elapsed: number;
  readonly winner: number | null;
  readonly endReason: EndReason | null;
  readonly landHexCount: number;
  readonly spawnSites: GameState['spawnSites'];
}

export type MatchPatch = Partial<MatchFields>;

export interface EmpiresPatch {
  readonly economy: Float64Array<ArrayBuffer>;
  readonly profiles: readonly (readonly [number, Empire])[];
}

export interface DiplomacyPatch {
  readonly relations: GameState['relations'];
  readonly offerCooldowns: GameState['offerCooldowns'];
  readonly pendingOffers: GameState['pendingOffers'];
}

export interface BuildingsPatch {
  readonly rows: Float64Array<ArrayBuffer>;
  readonly gatherers: Float64Array<ArrayBuffer>;
  readonly removed: readonly number[];
}

export interface KeyedPatch<V> {
  readonly upserts: readonly V[];
  readonly removed: readonly number[];
  readonly order: readonly number[] | null;
}

export interface UnitsPatch {
  readonly rows: Float64Array<ArrayBuffer>;
  readonly removed: readonly UnitId[];
  readonly boarding: readonly (readonly [UnitId, Boarding | null])[];
  readonly order: Float64Array<ArrayBuffer> | null;
}

export interface FrameMessage {
  readonly type: 'frame';
  readonly match: number;
  readonly seq: number;
  readonly paused: boolean;
  readonly fields: MatchPatch | null;
  readonly empires: EmpiresPatch | null;
  readonly diplomacy: DiplomacyPatch | null;
  readonly tiles: Float64Array<ArrayBuffer>;
  readonly buildings: BuildingsPatch | null;
  readonly production: KeyedPatch<ProductionQueue> | null;
  readonly units: UnitsPatch | null;
  readonly ships: KeyedPatch<ShipView> | null;
  readonly walkers: KeyedPatch<WalkerView> | null;
  readonly unitEvents: readonly UnitEvent[];
}

export interface SnapshotMessage {
  readonly type: 'snapshot';
  readonly seq: number;
  readonly match: number;
  readonly config: GameConfig;
  readonly width: number;
  readonly height: number;
  readonly owners: Int32Array<ArrayBuffer>;
  readonly terrains: Uint8Array<ArrayBuffer>;
  readonly biomes: Uint8Array<ArrayBuffer>;
  readonly harvested: Float64Array<ArrayBuffer>;
  readonly roads: Uint8Array<ArrayBuffer>;
  readonly landmass: Int32Array<ArrayBuffer>;
  readonly waterBody: Int32Array<ArrayBuffer>;
  readonly landSizes: readonly number[];
  readonly waterSizes: readonly number[];
  readonly frame: FrameMessage;
}

export interface KeyedShadow {
  readonly seen: Map<number, string>;
  order: number[];
}

export interface SimShadow {
  fields: Record<string, string>;
  readonly economy: Map<number, Float64Array>;
  readonly profiles: Map<number, string>;
  diplomacy: string;
  readonly buildings: Map<number, Float64Array>;
  readonly production: KeyedShadow;
  readonly units: Map<UnitId, Float64Array>;
  readonly boarding: Map<UnitId, Boarding | null>;
  unitOrder: UnitId[];
  readonly ships: KeyedShadow;
  readonly shipPaths: Map<number, number[]>;
  readonly walkers: KeyedShadow;
}

export interface FrameChanges {
  snapshot: boolean;
  readonly fields: Set<keyof MatchFields>;
  paused: boolean;
  readonly empires: Set<number>;
  diplomacy: boolean;
  readonly tiles: Set<number>;
  readonly buildings: Set<number>;
  readonly production: Set<number>;
  units: boolean;
  readonly unitIds: Set<number>;
  unitRoster: boolean;
  ships: boolean;
  walkers: boolean;
  unitEvents: boolean;
}

export interface SimPerf {
  readonly tickMs: readonly number[];
  readonly loopMs: readonly number[];
  readonly publishMs: readonly number[];
}

export type SimReply =
  | FrameMessage
  | SnapshotMessage
  | { readonly type: 'result'; readonly seq: number; readonly result: CommandResult }
  | { readonly type: 'perf'; readonly seq: number; readonly perf: SimPerf };

export type SimRequest =
  | { readonly type: 'start'; readonly seq: number; readonly config?: GameConfig; readonly demo: boolean }
  | { readonly type: 'menu'; readonly seq: number }
  | { readonly type: 'resync'; readonly seq: number }
  | { readonly type: 'command'; readonly seq: number; readonly match: number; readonly command: Command }
  | { readonly type: 'paused'; readonly value: boolean }
  | { readonly type: 'speed'; readonly value: GameState['speed'] }
  | { readonly type: 'suspend'; readonly value: boolean }
  | { readonly type: 'perf'; readonly seq: number };

export interface SimLink {
  post(request: SimRequest): void;
  listen(handler: (reply: SimReply) => void): void;
}

export type PostReply = (reply: SimReply, transfer: Transferable[]) => void;

export interface SimHost {
  readonly state: GameState;
  handle(request: SimRequest): void;
  advance(dtSeconds: number): void;
  publish(): void;
}

export interface MirrorStore extends ClientStore {
  startMatch(config?: GameConfig): Promise<void>;
  perf(): Promise<SimPerf>;
}

export interface InProcessSim {
  readonly host: SimHost;
  readonly store: MirrorStore;
}
