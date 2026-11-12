import { spawnUnits } from '../support/fixture';
import { describe, expect, test } from 'bun:test';
import { createEffect, createMemo, createRoot } from 'solid-js';
import type { GameState } from '@the-big-war/client/game/state/state.types';
import { createInProcessSim } from '@the-big-war/client/game/sim/sim-host.service';
import { FIXED_DT } from '@the-big-war/game-engine/simulation/simulation.constants';
import { createKeyedStores } from '@the-big-war/client/game/live/keyed-store.service';
import { DEFAULT_GAME_CONFIG } from '@the-big-war/client/game/config/config.constants';
import { gridAt, gridIndex } from '@the-big-war/game-engine/world-tile/world-tile.service';

const CONFIG = {
  ...DEFAULT_GAME_CONFIG,
  map: { ...DEFAULT_GAME_CONFIG.map, width: 90, height: 54, seed: 314 },
  start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 4 },
};

async function startedSim(): Promise<ReturnType<typeof createInProcessSim> & { frame: (ticks?: number) => void }> {
  const sim = createInProcessSim();
  await sim.store.startMatch(CONFIG);
  sim.host.handle({ type: 'paused', value: true });
  const frame = (ticks = 0): void => {
    if (ticks === 0) {
      sim.host.handle({ type: 'paused', value: true });
      return;
    }
    sim.host.handle({ type: 'paused', value: false });
    for (let tick = 0; tick < ticks; tick++) sim.host.advance(FIXED_DT);
    sim.host.handle({ type: 'paused', value: true });
  };
  return { ...sim, frame };
}

function runs(read: () => unknown): { readonly count: () => number; readonly dispose: () => void } {
  let count = 0;
  let dispose = (): void => {};
  createRoot(release => {
    dispose = release;
    createEffect(() => {
      read();
      count += 1;
    });
  });
  return { count: () => count, dispose };
}

function ownBuildingAt(state: GameState, empire: number): number {
  const at = state.index.empireBuildings.get(empire)?.[0];
  if (at === undefined) throw new Error(`empire ${empire} has no buildings`);
  return at;
}

describe('live state', () => {
  test('a field read re-runs only when that field changes', async () => {
    const { host, store, frame } = await startedSim();
    const gold = runs(() => store.state.empires[0]!.gold);
    const speed = runs(() => store.state.speed);
    const before = { gold: gold.count(), speed: speed.count() };
    host.state.empires[0]!.gold += 125;
    frame(0);
    expect(gold.count()).toBe(before.gold + 1);
    expect(speed.count()).toBe(before.speed);
    frame(0);
    expect(gold.count()).toBe(before.gold + 1);
    gold.dispose();
    speed.dispose();
  });

  test('unit movement does not wake empire or diplomacy readers', async () => {
    const { host, store, frame } = await startedSim();
    const home = host.state.grid.cells.find(cell => cell.owner === 0)!;
    spawnUnits(host.state, 0, home, 30);
    frame(0);
    const relations = runs(() => JSON.stringify(store.state.relations));
    const name = runs(() => store.state.empires[1]!.name);
    const units = runs(() => store.state.units.length);
    for (const unit of host.state.units) unit.tx += 200;
    frame(3);
    expect(relations.count()).toBe(1);
    expect(name.count()).toBe(1);
    expect(units.count()).toBeGreaterThan(1);
  });

  test('a watched cell wakes only for its own tile', async () => {
    const { host, store, frame } = await startedSim();
    const mine = ownBuildingAt(host.state, 0);
    const theirs = ownBuildingAt(host.state, 1);
    const level = runs(() => store.live.cell(mine)?.building?.level);
    const start = level.count();
    host.state.grid.cells[theirs]!.building!.level += 1;
    frame(0);
    expect(level.count()).toBe(start);
    host.state.grid.cells[mine]!.building!.level += 1;
    frame(0);
    expect(level.count()).toBe(start + 1);
    expect(store.live.cell(mine)?.building?.level).toBe(host.state.grid.cells[mine]!.building!.level);
  });

  test('a memo holding a cell still exposes fresh building fields', async () => {
    const { host, store, frame } = await startedSim();
    const mine = ownBuildingAt(host.state, 0);
    const hex = { q: host.state.grid.cells[mine]!.q, r: host.state.grid.cells[mine]!.r };
    let seen = -1;
    createRoot(() => {
      const cell = createMemo(() => store.live.cellAt(hex));
      createEffect(() => {
        seen = cell()?.building?.level ?? -1;
      });
    });
    host.state.grid.cells[mine]!.building!.level = 7;
    frame(0);
    expect(seen).toBe(7);
  });

  test('population follows the roster, production and cargo', async () => {
    const { host, store, frame } = await startedSim();
    const before = store.live.population(0);
    let seen = before;
    createRoot(() => createEffect(() => (seen = store.live.population(0))));
    spawnUnits(host.state, 0, host.state.grid.cells.find(cell => cell.owner === 0)!, 12);
    frame(0);
    expect(seen).toBe(before + 12);
  });

  test('a production line is watched by building id', async () => {
    const { host, store, frame } = await startedSim();
    const at = ownBuildingAt(host.state, 0);
    const building = host.state.grid.cells[at]!.building!;
    let queued = -1;
    createRoot(() => createEffect(() => (queued = store.live.productionFor(building.id)?.queue.length ?? 0)));
    expect(queued).toBe(0);
    host.state.production.push({ building: building.id, empire: 0, at, queue: ['infantry', 'infantry'], progress: 0 });
    frame(0);
    expect(queued).toBe(2);
  });

  test('a restart refreshes readers of static and grid slices', async () => {
    const { store } = await startedSim();
    let width = 0;
    let owner = -2;
    createRoot(() => {
      createEffect(() => (width = store.state.config.map.width));
      createEffect(() => (owner = gridAt(store.state.grid, { q: 1, r: 1 })?.owner ?? -1));
    });
    expect(width).toBe(90);
    await store.startMatch({ ...CONFIG, map: { ...CONFIG.map, width: 60, seed: 9 } });
    expect(width).toBe(60);
    expect(owner).toBe(store.raw.grid.cells[gridIndex(store.raw.grid, 1, 1)]!.owner);
  });
});

describe('keyed stores', () => {
  test('a key is read only while something watches it', async () => {
    let reads = 0;
    const values = new Map([[1, { level: 1 }]]);
    const keyed = createKeyedStores<number, { level: number }>(key => {
      reads += 1;
      return values.get(key) ?? null;
    });
    let dispose = (): void => {};
    let seen = 0;
    createRoot(release => {
      dispose = release;
      createEffect(() => (seen = keyed.get(1)?.level ?? 0));
    });
    values.set(1, { level: 4 });
    keyed.dirty(1);
    expect(seen).toBe(4);
    dispose();
    await Promise.resolve();
    const after = reads;
    keyed.dirty(1);
    expect(reads).toBe(after);
  });
});
