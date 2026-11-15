import type { Unit } from '../../unit/unit.types';
import type { GameState } from '../../state/state.types';
import { isFinishedPort, launchTransport, planLanding } from '../../ship/ship.service';
import { gridAt, gridIndex } from '@the-big-war/game-engine/world-tile/world-tile.service';

const BOARD_RADIUS_HEXES = 2.5;
const BOARD_CROWD = 10;
const BOARD_QUORUM = 0.75;

export function stepBoarding(state: GameState): void {
  const groups = new Map<number, Unit[]>();
  for (const unit of state.units) {
    if (!unit.boarding) continue;
    const group = groups.get(unit.boarding.group);
    if (group) group.push(unit);
    else groups.set(unit.boarding.group, [unit]);
  }
  for (const units of groups.values()) boardGroup(state, units);
}

function boardGroup(state: GameState, units: readonly Unit[]): void {
  const { port, focus } = units[0]!.boarding!;
  const empire = units[0]!.empire;
  const dock = gridAt(state.grid, port);
  if (!dock || dock.owner !== empire || !isFinishedPort(dock)) {
    cancel(units);
    return;
  }
  const size = state.config.map.hexSize;
  const reach = size * BOARD_RADIUS_HEXES * Math.max(1, Math.sqrt(units.length / BOARD_CROWD));
  const px = (port.q + 0.5) * size;
  const py = (port.r + 0.5) * size;
  const ready = units.filter(unit => Math.hypot(unit.x - px, unit.y - py) <= reach);
  if (ready.length === 0 || ready.length < Math.ceil(units.length * BOARD_QUORUM)) return;

  const landmass = state.map.landmass[gridIndex(state.grid, dock.q, dock.r)]!;
  const owner = gridAt(state.grid, focus)?.owner;
  if (owner === undefined) {
    cancel(units);
    return;
  }
  const plan = planLanding(state, empire, focus, owner, landmass);
  if (plan === 'port_busy') return;
  if (typeof plan === 'string') {
    cancel(units);
    return;
  }
  const ship = launchTransport(state, empire, plan, focus);
  const aboard = new Set(ready);
  cancel(units.filter(unit => !aboard.has(unit)));
  ship.cargo = ready.map(unit => ({ ...unit, boarding: null, target: null, moving: false }));
  state.units = state.units.filter(unit => !aboard.has(unit));
}

function cancel(units: readonly Unit[]): void {
  for (const unit of units) unit.boarding = null;
}
