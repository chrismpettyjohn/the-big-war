import { spawnUnits } from '../support/fixture';
import { describe, expect, test } from 'bun:test';
import { foreignTarget } from '../support/mirror-fixture';
import type { SimReply } from '@the-big-war/client/game/sim/sim.types';
import type { GameState } from '@the-big-war/client/game/state/state.types';
import { createSimHost } from '@the-big-war/client/game/sim/sim-host.service';
import { gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';
import { createInProcessSim } from '@the-big-war/client/game/sim/sim-host.service';
import { getRelation } from '@the-big-war/client/game/diplomacy/diplomacy.service';
import { FIXED_DT } from '@the-big-war/game-engine/simulation/simulation.constants';
import { createMirrorStore } from '@the-big-war/client/game/sim/mirror-store.service';
import { DEFAULT_GAME_CONFIG } from '@the-big-war/client/game/config/config.constants';

function view(state: GameState): unknown {
  return {
    status: state.status,
    tick: state.tick,
    elapsed: state.elapsed,
    speed: state.speed,
    winner: state.winner,
    playerEmpire: state.playerEmpire,
    landHexCount: state.landHexCount,
    endReason: state.endReason,
    spawnSites: state.spawnSites,
    production: state.production,
    walkers: state.walkers.map(({ path: _path, ...walker }) => walker),
    cells: state.grid.cells,
    empires: state.empires,
    units: state.units.map(({ cooldown: _cooldown, coaxCooldown: _coax, captureAt: _captureAt, capture: _capture, ...unit }) => unit),
    ships: state.ships,
    relations: state.relations,
    offerCooldowns: state.offerCooldowns,
    pendingOffers: state.pendingOffers,
    buildings: state.index.buildings,
    population: [...state.index.population].sort((a, b) => a[0] - b[0]),
    tiles: [...state.index.tiles].map(([id, set]) => [id, [...set].sort((a, b) => a - b)]).sort((a, b) => Number(a[0]) - Number(b[0])),
    owned: [...state.index.empireBuildings].filter(entry => entry[1].length > 0).sort((a, b) => a[0] - b[0]),
  };
}

describe('sim mirror', () => {
  test('a seeded match mirror equals the sim through commands, pause, speed and restart', async () => {
    const { host, store } = createInProcessSim();
    const config = {
      ...DEFAULT_GAME_CONFIG,
      map: { ...DEFAULT_GAME_CONFIG.map, width: 120, height: 72, seed: 1914 },
      start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 5 },
    };
    await store.startMatch(config);
    expect(view(store.state)).toEqual(view(host.state));

    store.setSpeed(4);
    for (let round = 0; round < 40; round++) {
      for (let tick = 0; tick < 30; tick++) {
        host.advance(FIXED_DT);
        host.publish();
      }
      expect(view(store.state)).toEqual(view(host.state));
      if (round % 8 === 0) {
        const target = foreignTarget(store.state);
        if (target) {
          const owner = gridAt(store.state.grid, target)!.owner;
          await store.dispatch({ type: 'DeclareWar', empire: store.state.playerEmpire, target: owner });
        }
      }
    }
    expect(store.state.index.buildings.length).toBeGreaterThan(0);

    store.setPaused(true);
    expect(store.paused()).toBe(true);
    const frozen = store.state.tick;
    host.advance(1);
    host.publish();
    expect(store.state.tick).toBe(frozen);
    store.setPaused(false);

    const bad = await store.dispatch({ type: 'DeclareWar', empire: 99, target: 0 });
    expect(bad.ok).toBe(false);

    const previous = store.raw;
    await store.startMatch({ ...config, map: { ...config.map, seed: 7 } });
    expect(store.raw).not.toBe(previous);
    expect(view(store.state)).toEqual(view(host.state));
  });
});

describe('match identity', () => {
  test('a command posted for the last match cannot land on the new one', async () => {
    const { host, store } = createInProcessSim();
    await store.startMatch();
    const stale = { type: 'command' as const, seq: 9000, match: 0, command: { type: 'DeclareWar' as const, empire: 0, target: 1 } };
    host.handle(stale);
    expect(getRelation(host.state, 0, 1).status).toBe('peace');
  });
});

interface WiredSim {
  readonly host: ReturnType<typeof createSimHost>;
  readonly store: ReturnType<typeof createMirrorStore>;
  drop(count: number): void;
  frames(): SimReply[];
  inject(reply: SimReply): void;
}

function wiredSim(): WiredSim {
  let deliver: (reply: SimReply) => void = () => {};
  let dropping = 0;
  const seen: SimReply[] = [];
  const host = createSimHost((reply, transfer) => {
    if (reply.type === 'frame' && dropping > 0) {
      dropping -= 1;
      return;
    }
    seen.push(structuredClone(reply));
    deliver(structuredClone(reply, { transfer }));
  });
  const store = createMirrorStore({ post: request => host.handle(structuredClone(request)), listen: handler => (deliver = handler) });
  return { host, store, drop: count => (dropping = count), frames: () => seen, inject: reply => deliver(structuredClone(reply)) };
}

const ARMY_CONFIG = {
  ...DEFAULT_GAME_CONFIG,
  map: { ...DEFAULT_GAME_CONFIG.map, width: 120, height: 72, seed: 77 },
  start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 4 },
};

function raiseArmies(state: GameState, perEmpire: number): void {
  for (const empire of state.empires) {
    const home = state.grid.cells.find(cell => cell.owner === empire.id && !cell.building);
    if (!home) continue;
    spawnUnits(state, empire.id, home, perEmpire);
  }
  state.units.forEach((unit, at) => {
    if (at % 3 !== 0) return;
    unit.tx += state.config.map.hexSize * 4;
    unit.ty += state.config.map.hexSize * 2;
  });
}

describe('sim wire', () => {
  test('a large army mirrors exactly while units move, fight, die and spawn', async () => {
    const { host, store } = createInProcessSim();
    await store.startMatch(ARMY_CONFIG);
    raiseArmies(host.state, 150);
    for (let round = 0; round < 12; round++) {
      for (let tick = 0; tick < 15; tick++) {
        host.advance(FIXED_DT);
        host.publish();
      }
      expect(view(store.state)).toEqual(view(host.state));
      if (round === 6) raiseArmies(host.state, 20);
    }
    expect(store.state.units.length).toBeGreaterThan(400);
  });

  test('mirror objects keep their identity between frames', async () => {
    const { host, store } = createInProcessSim();
    await store.startMatch(ARMY_CONFIG);
    raiseArmies(host.state, 10);
    host.advance(FIXED_DT);
    host.publish();
    const first = store.state.units[0]!;
    const empire = store.state.empires[0]!;
    for (let tick = 0; tick < 10; tick++) {
      host.advance(FIXED_DT);
      host.publish();
    }
    expect(store.state.units.find(unit => unit.id === first.id)).toBe(first);
    expect(store.state.empires[0]).toBe(empire);
  });

  test('an idle frame carries no slice patches', async () => {
    const { host, store, frames } = wiredSim();
    await store.startMatch(ARMY_CONFIG);
    store.setPaused(true);
    raiseArmies(host.state, 500);
    store.setSpeed(1);
    expect(store.state.units.length).toBe(host.state.units.length);
    const before = frames().length;
    store.setSpeed(1);
    const idle = frames().slice(before).find(reply => reply.type === 'frame');
    expect(idle?.type).toBe('frame');
    if (idle?.type !== 'frame') return;
    expect(idle.empires).toBeNull();
    expect(idle.units).toBeNull();
    expect(idle.buildings).toBeNull();
    expect(idle.diplomacy).toBeNull();
    expect(idle.tiles.length).toBe(0);
  });

  test('a dropped frame triggers a resync that restores the mirror', async () => {
    const { host, store, drop, frames } = wiredSim();
    await store.startMatch(ARMY_CONFIG);
    raiseArmies(host.state, 40);
    host.advance(FIXED_DT);
    host.publish();
    drop(1);
    for (let tick = 0; tick < 5; tick++) {
      host.advance(FIXED_DT);
      host.publish();
    }
    expect(frames().filter(reply => reply.type === 'snapshot').length).toBe(2);
    for (let tick = 0; tick < 5; tick++) {
      host.advance(FIXED_DT);
      host.publish();
    }
    expect(view(store.state)).toEqual(view(host.state));
  });

  test('frames from a previous match are ignored', async () => {
    const { host, store, frames, inject } = wiredSim();
    await store.startMatch(ARMY_CONFIG);
    for (let tick = 0; tick < 3; tick++) {
      host.advance(FIXED_DT);
      host.publish();
    }
    const stale = frames().filter(reply => reply.type === 'frame').at(-1)!;
    await store.startMatch({ ...ARMY_CONFIG, map: { ...ARMY_CONFIG.map, seed: 5 } });
    host.advance(FIXED_DT);
    host.publish();
    const before = view(store.state);
    const snapshots = frames().filter(reply => reply.type === 'snapshot').length;
    inject(stale);
    expect(frames().filter(reply => reply.type === 'snapshot').length).toBe(snapshots);
    expect(view(store.state)).toEqual(before);
    expect(view(store.state)).toEqual(view(host.state));
  });
});
