import { orNaN, orNull, sameRow } from './codec.utility';
import { UNIT_MODES, UNIT_STRIDE } from './codec.constants';
import { FORMATIONS, UNIT_KINDS } from '../../unit/unit.constants';
import type { FrameChanges, SimShadow, UnitsPatch } from '../sim.types';
import type { ArmySlice, Boarding, Unit, UnitId } from '../../unit/unit.types';

const rosters = new WeakMap<ArmySlice, Map<UnitId, Unit>>();

function writeUnit(out: Float64Array, at: number, unit: Unit): void {
  out[at] = unit.id;
  out[at + 1] = UNIT_KINDS.indexOf(unit.kind);
  out[at + 2] = unit.empire;
  out[at + 3] = unit.x;
  out[at + 4] = unit.y;
  out[at + 5] = unit.hp;
  out[at + 6] = unit.tx;
  out[at + 7] = unit.ty;
  out[at + 8] = unit.gx;
  out[at + 9] = unit.gy;
  out[at + 10] = orNaN(unit.target);
  out[at + 11] = UNIT_MODES.indexOf(unit.mode);
  out[at + 12] = FORMATIONS.indexOf(unit.formation);
  out[at + 13] = orNaN(unit.heading);
  out[at + 14] = unit.face;
  out[at + 15] = unit.hull;
  out[at + 16] = unit.moving ? 1 : 0;
  out[at + 17] = unit.setup;
  out[at + 18] = unit.suppression;
}

function readPose(unit: Unit, rows: Float64Array, at: number): void {
  unit.x = rows[at + 3]!;
  unit.y = rows[at + 4]!;
  unit.hp = rows[at + 5]!;
  unit.tx = rows[at + 6]!;
  unit.ty = rows[at + 7]!;
  unit.gx = rows[at + 8]!;
  unit.gy = rows[at + 9]!;
  unit.target = orNull(rows[at + 10]!);
  unit.mode = UNIT_MODES[rows[at + 11]!]!;
  unit.formation = FORMATIONS[rows[at + 12]!]!;
  unit.heading = orNull(rows[at + 13]!);
  unit.face = rows[at + 14]!;
  unit.hull = rows[at + 15]!;
  unit.moving = rows[at + 16]! === 1;
  unit.setup = rows[at + 17]!;
  unit.suppression = rows[at + 18]!;
}

function createFromRow(rows: Float64Array, at: number): Unit {
  const unit = {
    id: rows[at]!,
    kind: UNIT_KINDS[rows[at + 1]!]!,
    empire: rows[at + 2]!,
    cooldown: 0,
    coaxCooldown: 0,
    captureAt: -1,
    capture: 0,
    boarding: null,
  } as Unit;
  readPose(unit, rows, at);
  return unit;
}

export function encodeUnits(state: ArmySlice, shadow: SimShadow): UnitsPatch | null {
  const units = state.units;
  const scratch = new Float64Array(units.length * UNIT_STRIDE);
  const boarding: [UnitId, Boarding | null][] = [];
  let cursor = 0;
  let orderChanged = units.length !== shadow.unitOrder.length;
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]!;
    if (!orderChanged && shadow.unitOrder[index] !== unit.id) orderChanged = true;
    writeUnit(scratch, cursor, unit);
    const previous = shadow.units.get(unit.id);
    if (!sameRow(scratch, previous, cursor, UNIT_STRIDE)) {
      if (previous) previous.set(scratch.subarray(cursor, cursor + UNIT_STRIDE));
      else shadow.units.set(unit.id, scratch.slice(cursor, cursor + UNIT_STRIDE));
      cursor += UNIT_STRIDE;
    }
    if ((shadow.boarding.get(unit.id) ?? null) !== unit.boarding) {
      shadow.boarding.set(unit.id, unit.boarding);
      boarding.push([unit.id, unit.boarding]);
    }
  }
  const removed: UnitId[] = [];
  let order: Float64Array<ArrayBuffer> | null = null;
  if (orderChanged) {
    order = new Float64Array(units.length);
    const ids: UnitId[] = [];
    units.forEach((unit, index) => {
      order![index] = unit.id;
      ids.push(unit.id);
    });
    const present = new Set(ids);
    for (const id of shadow.unitOrder) {
      if (present.has(id)) continue;
      removed.push(id);
      shadow.units.delete(id);
      shadow.boarding.delete(id);
    }
    shadow.unitOrder = ids;
  }
  if (cursor === 0 && boarding.length === 0 && !order) return null;
  return { rows: scratch.slice(0, cursor), removed, boarding, order };
}

export function mirrorRoster(state: ArmySlice): Map<UnitId, Unit> {
  let roster = rosters.get(state);
  if (!roster) {
    roster = new Map(state.units.map(unit => [unit.id, unit]));
    rosters.set(state, roster);
  }
  return roster;
}

export function applyUnits(state: ArmySlice, patch: UnitsPatch, changes: FrameChanges): void {
  const roster = mirrorRoster(state);
  for (const id of patch.removed) roster.delete(id);
  const { rows } = patch;
  for (let at = 0; at < rows.length; at += UNIT_STRIDE) {
    const id = rows[at]!;
    const unit = roster.get(id);
    if (unit) readPose(unit, rows, at);
    else roster.set(id, createFromRow(rows, at));
  }
  for (const [id, boarding] of patch.boarding) {
    const unit = roster.get(id);
    if (unit) unit.boarding = boarding;
  }
  if (patch.order) {
    const next: Unit[] = [];
    for (const id of patch.order) next.push(roster.get(id)!);
    state.units = next;
    changes.unitRoster = true;
  }
  changes.units = true;
}
