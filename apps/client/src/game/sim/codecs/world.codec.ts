import type { HexCell } from '../../map/map.types';
import { orNaN, orNull, sameRow } from './codec.utility';
import type { GameState } from '../../state/state.types';
import { BUILDING_KINDS } from '../../building/building.constants';
import type { BuildingsPatch, FrameChanges, SimShadow } from '../sim.types';
import type { Building, BuildingKind, Gatherer } from '../../building/building.types';
import { addRoad, drainChangedTiles, markTile, setBuilding, setOwner } from '../../map/world-index.service';
import { BUILDING_STRIDE, GATHERER_PHASES, GATHERER_STRIDE, TERRAINS, TILE_STRIDE } from './codec.constants';

export function encodeTiles(state: GameState): Float64Array<ArrayBuffer> {
  const tiles = new Float64Array(state.index.changedTiles.length * TILE_STRIDE);
  let cursor = 0;
  drainChangedTiles(state.index, at => {
    const cell = state.grid.cells[at]!;
    tiles[cursor++] = at;
    tiles[cursor++] = cell.owner;
    tiles[cursor++] = TERRAINS.indexOf(cell.terrain);
    tiles[cursor++] = orNaN(cell.harvested);
    tiles[cursor++] = cell.road ? 1 : 0;
  });
  return tiles;
}

export function applyTiles(state: GameState, tiles: Float64Array, changes: FrameChanges): void {
  for (let row = 0; row < tiles.length; row += TILE_STRIDE) {
    const at = tiles[row]!;
    const cell = state.grid.cells[at]!;
    setOwner(state, cell, tiles[row + 1]!);
    cell.terrain = TERRAINS[tiles[row + 2]!]!;
    const harvested = orNull(tiles[row + 3]!);
    if (harvested === null) delete cell.harvested;
    else cell.harvested = harvested;
    if (tiles[row + 4]! === 1) addRoad(state, cell);
    markTile(state, cell);
    changes.tiles.add(at);
  }
}

function writeBuilding(out: Float64Array, at: number, building: Building): void {
  let cursor = 0;
  out[cursor++] = at;
  out[cursor++] = building.id;
  out[cursor++] = BUILDING_KINDS.indexOf(building.kind);
  out[cursor++] = building.level;
  out[cursor++] = building.cooldown;
  out[cursor++] = building.growth;
  out[cursor++] = orNaN(building.demolishAt);
  out[cursor++] = building.buildRemaining;
  out[cursor++] = building.shipBuild;
  out[cursor++] = building.shellDamage;
  out[cursor++] = building.gatherers.length;
  for (const gatherer of building.gatherers) {
    out[cursor++] = gatherer.pos.q;
    out[cursor++] = gatherer.pos.r;
    out[cursor++] = orNaN(gatherer.target?.q);
    out[cursor++] = orNaN(gatherer.target?.r);
    out[cursor++] = GATHERER_PHASES.indexOf(gatherer.phase);
    out[cursor++] = gatherer.progress;
    out[cursor++] = gatherer.duration;
  }
}

export function encodeBuildings(state: GameState, shadow: SimShadow): BuildingsPatch | null {
  const changed: Float64Array[] = [];
  let gathererCount = 0;
  const present = new Set<number>();
  for (const at of state.index.buildings) {
    present.add(at);
    const building = state.grid.cells[at]!.building!;
    const record = new Float64Array(BUILDING_STRIDE + building.gatherers.length * GATHERER_STRIDE);
    writeBuilding(record, at, building);
    if (sameRow(record, shadow.buildings.get(at))) continue;
    shadow.buildings.set(at, record);
    changed.push(record);
    gathererCount += building.gatherers.length;
  }
  const removed: number[] = [];
  if (present.size !== shadow.buildings.size) {
    for (const at of shadow.buildings.keys()) {
      if (present.has(at)) continue;
      removed.push(at);
      shadow.buildings.delete(at);
    }
  }
  if (changed.length === 0 && removed.length === 0) return null;
  const rows = new Float64Array(changed.length * BUILDING_STRIDE);
  const gatherers = new Float64Array(gathererCount * GATHERER_STRIDE);
  let gathererCursor = 0;
  changed.forEach((record, row) => {
    rows.set(record.subarray(0, BUILDING_STRIDE), row * BUILDING_STRIDE);
    gatherers.set(record.subarray(BUILDING_STRIDE), gathererCursor);
    gathererCursor += record.length - BUILDING_STRIDE;
  });
  return { rows, gatherers, removed };
}

function readGatherers(gatherers: Float64Array, start: number, count: number): Gatherer[] {
  const list: Gatherer[] = [];
  for (let item = 0; item < count; item++) {
    const at = start + item * GATHERER_STRIDE;
    const targetQ = orNull(gatherers[at + 2]!);
    list.push({
      pos: { q: gatherers[at]!, r: gatherers[at + 1]! },
      target: targetQ === null ? null : { q: targetQ, r: gatherers[at + 3]! },
      phase: GATHERER_PHASES[gatherers[at + 4]!]!,
      progress: gatherers[at + 5]!,
      duration: gatherers[at + 6]!,
    });
  }
  return list;
}

function emptyBuilding(id: number, kind: BuildingKind): Building {
  return {
    id,
    kind,
    level: 0,
    cooldown: 0,
    growth: 0,
    demolishAt: null,
    buildRemaining: 0,
    gatherers: [],
    shipBuild: 0,
    shellDamage: 0,
  };
}

export function applyBuildings(state: GameState, patch: BuildingsPatch, changes: FrameChanges): void {
  for (const at of patch.removed) {
    setBuilding(state, state.grid.cells[at]!, null);
    changes.buildings.add(at);
  }
  const { rows, gatherers } = patch;
  let nextGatherer = 0;
  for (let row = 0; row < rows.length; row += BUILDING_STRIDE) {
    const at = rows[row]!;
    const cell: HexCell = state.grid.cells[at]!;
    const id = rows[row + 1]!;
    let building = cell.building;
    if (building?.id !== id) {
      building = emptyBuilding(id, BUILDING_KINDS[rows[row + 2]!]!);
      setBuilding(state, cell, building);
    }
    building.level = rows[row + 3]!;
    building.cooldown = rows[row + 4]!;
    building.growth = rows[row + 5]!;
    building.demolishAt = orNull(rows[row + 6]!);
    building.buildRemaining = rows[row + 7]!;
    building.shipBuild = rows[row + 8]!;
    building.shellDamage = rows[row + 9]!;
    const count = rows[row + 10]!;
    building.gatherers = readGatherers(gatherers, nextGatherer, count);
    nextGatherer += count * GATHERER_STRIDE;
    changes.buildings.add(at);
  }
}
