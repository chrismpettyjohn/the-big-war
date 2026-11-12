import type { Ship } from '../ship/ship.types';
import { addRoad } from '../map/world-index.service';
import { UNIT_TUNING } from '../unit/unit.constants';
import type { GameState } from '../state/state.types';
import { orNaN, orNull } from './codecs/codec.utility';
import { rebuildShipHash } from '../ship/ship.service';
import { createBaseState } from '../state/state.service';
import type { GameConfig } from '../config/config.types';
import type { HexCell, HexGrid } from '../map/map.types';
import type { Walker } from '../building/building.types';
import type { ProductionQueue } from '../unit/unit.types';
import { NEUTRAL_OWNER } from '../empire/empire.constants';
import { BIOMES, TERRAINS } from './codecs/codec.constants';
import { applyMatch, encodeMatch } from './codecs/match.codec';
import { applyUnits, encodeUnits } from './codecs/units.codec';
import { applyEmpires, encodeEmpires } from './codecs/empires.codec';
import { applyDiplomacy, encodeDiplomacy } from './codecs/diplomacy.codec';
import { applyKeyed, createKeyedShadow, diffKeyed } from './codecs/keyed.codec';
import { applyBuildings, applyTiles, encodeBuildings, encodeTiles } from './codecs/world.codec';
import type { FrameChanges, FrameMessage, ShipView, SimShadow, SnapshotMessage, WalkerView } from './sim.types';

export function createShadow(): SimShadow {
  return {
    fields: {},
    economy: new Map(),
    profiles: new Map(),
    diplomacy: '',
    buildings: new Map(),
    production: createKeyedShadow(),
    units: new Map(),
    boarding: new Map(),
    unitOrder: [],
    ships: createKeyedShadow(),
    shipPaths: new Map(),
    walkers: createKeyedShadow(),
  };
}

export function emptyChanges(): FrameChanges {
  return {
    snapshot: false,
    fields: new Set(),
    paused: false,
    empires: new Set(),
    diplomacy: false,
    tiles: new Set(),
    buildings: new Set(),
    production: new Set(),
    units: false,
    unitRoster: false,
    ships: false,
    walkers: false,
    unitEvents: false,
  };
}

function shipView({ path: _path, ...view }: Ship): ShipView {
  return view;
}

function walkerView({ path: _path, ...view }: Walker): WalkerView {
  return view;
}

function encodeShips(state: GameState, shadow: SimShadow): FrameMessage['ships'] {
  const pathChanged = (ship: Ship): boolean => shadow.shipPaths.get(ship.id) !== ship.path;
  const patch = diffKeyed(state.ships, shadow.ships, ship => ship.id, shipView, pathChanged);
  if (!patch) return null;
  const upserts = patch.upserts.map(view => {
    const ship = state.ships.find(item => item.id === view.id)!;
    if (!pathChanged(ship)) return view;
    shadow.shipPaths.set(ship.id, ship.path);
    return { ...view, path: ship.path };
  });
  for (const id of patch.removed) shadow.shipPaths.delete(id);
  return { ...patch, upserts };
}

export function encodeFrame(state: GameState, paused: boolean, shadow: SimShadow, match: number, seq: number): FrameMessage {
  return {
    type: 'frame',
    match,
    seq,
    paused,
    fields: encodeMatch(state, shadow),
    empires: encodeEmpires(state, shadow),
    diplomacy: encodeDiplomacy(state, shadow),
    tiles: encodeTiles(state),
    buildings: encodeBuildings(state, shadow),
    production: diffKeyed(state.production, shadow.production, line => line.building, line => line),
    units: encodeUnits(state, shadow),
    ships: encodeShips(state, shadow),
    walkers: diffKeyed(state.walkers, shadow.walkers, walker => walker.site, walkerView),
    unitEvents: state.unitEvents.splice(0),
  };
}

export function encodeSnapshot(state: GameState, paused: boolean, shadow: SimShadow, seq: number, match: number): SnapshotMessage {
  const { cells, width, height } = state.grid;
  const owners = new Int32Array(cells.length);
  const terrains = new Uint8Array(cells.length);
  const biomes = new Uint8Array(cells.length);
  const harvested = new Float64Array(cells.length);
  const roads = new Uint8Array(cells.length);
  cells.forEach((cell, at) => {
    owners[at] = cell.owner;
    terrains[at] = TERRAINS.indexOf(cell.terrain);
    biomes[at] = BIOMES.indexOf(cell.biome);
    harvested[at] = orNaN(cell.harvested);
    roads[at] = cell.road ? 1 : 0;
  });
  return {
    type: 'snapshot',
    seq,
    match,
    config: state.config,
    width,
    height,
    owners,
    terrains,
    biomes,
    harvested,
    roads,
    landmass: state.map.landmass.slice() as Int32Array<ArrayBuffer>,
    waterBody: state.map.waterBody.slice() as Int32Array<ArrayBuffer>,
    landSizes: state.map.landSizes,
    waterSizes: state.map.waterSizes,
    frame: encodeFrame(state, paused, shadow, match, 0),
  };
}

export function frameTransfer(frame: FrameMessage): Transferable[] {
  const buffers: ArrayBuffer[] = [frame.tiles.buffer];
  if (frame.empires) buffers.push(frame.empires.economy.buffer);
  if (frame.buildings) buffers.push(frame.buildings.rows.buffer, frame.buildings.gatherers.buffer);
  if (frame.units) buffers.push(frame.units.rows.buffer);
  if (frame.units?.order) buffers.push(frame.units.order.buffer);
  return buffers;
}

export function snapshotTransfer(snapshot: SnapshotMessage): Transferable[] {
  return [
    snapshot.owners.buffer,
    snapshot.terrains.buffer,
    snapshot.biomes.buffer,
    snapshot.harvested.buffer,
    snapshot.roads.buffer,
    snapshot.landmass.buffer,
    snapshot.waterBody.buffer,
    ...frameTransfer(snapshot.frame),
  ];
}

export function applyFrame(state: GameState, frame: FrameMessage, changes: FrameChanges = emptyChanges()): FrameChanges {
  if (frame.fields) applyMatch(state, frame.fields, changes);
  if (frame.empires) applyEmpires(state, frame.empires, changes);
  if (frame.diplomacy) applyDiplomacy(state, frame.diplomacy, changes);
  applyTiles(state, frame.tiles, changes);
  if (frame.buildings) applyBuildings(state, frame.buildings, changes);
  if (frame.production) {
    state.production = applyKeyed<ProductionQueue, ProductionQueue>(
      state.production,
      frame.production,
      line => line.building,
      line => ({ ...line, queue: [...line.queue] }),
      (line, view) => Object.assign(line, view, { queue: [...view.queue] }),
      changes.production,
    );
  }
  if (frame.units) applyUnits(state, frame.units, changes);
  if (frame.ships) {
    state.ships = applyKeyed<Ship, ShipView>(
      state.ships,
      frame.ships,
      ship => ship.id,
      view => ({ ...view, path: view.path ?? [] }),
      (ship, view) => Object.assign(ship, view),
    );
    rebuildShipHash(state);
    changes.ships = true;
  }
  if (frame.walkers) {
    state.walkers = applyKeyed<Walker, WalkerView>(
      state.walkers,
      frame.walkers,
      walker => walker.site,
      view => ({ ...view, path: [] }),
      (walker, view) => Object.assign(walker, view),
    );
    changes.walkers = true;
  }
  if (frame.unitEvents.length > 0) {
    state.unitEvents.push(...frame.unitEvents);
    if (state.unitEvents.length > UNIT_TUNING.maxEvents) state.unitEvents.splice(0, state.unitEvents.length - UNIT_TUNING.maxEvents);
    changes.unitEvents = true;
  }
  return changes;
}

export function emptyMirror(config: GameConfig): GameState {
  const grid: HexGrid = { width: 0, height: 0, cells: [] };
  const map = { landmass: new Int32Array(0), waterBody: new Int32Array(0), landSizes: [], waterSizes: [] };
  const state = createBaseState(config, grid, [], map);
  state.status = 'menu';
  return state;
}

export function applySnapshot(snapshot: SnapshotMessage, changes: FrameChanges = emptyChanges()): GameState {
  const { width, height, owners, terrains, biomes, harvested, roads } = snapshot;
  const cells: HexCell[] = [];
  for (let at = 0; at < owners.length; at++) {
    const cell: HexCell = {
      q: at % width,
      r: Math.floor(at / width),
      terrain: TERRAINS[terrains[at]!]!,
      biome: BIOMES[biomes[at]!]!,
      owner: owners[at] ?? NEUTRAL_OWNER,
      building: null,
    };
    const load = orNull(harvested[at]!);
    if (load !== null) cell.harvested = load;
    cells.push(cell);
  }
  const state = createBaseState(snapshot.config, { width, height, cells }, [], {
    landmass: snapshot.landmass,
    waterBody: snapshot.waterBody,
    landSizes: snapshot.landSizes,
    waterSizes: snapshot.waterSizes,
  });
  roads.forEach((road, at) => {
    if (road === 1) addRoad(state, state.grid.cells[at]!);
  });
  applyFrame(state, snapshot.frame, changes);
  changes.snapshot = true;
  return state;
}
