import { serialize } from 'bun:jsc';
import { spawnUnits } from '../tests/support/fixture';
import type { SimReply } from '@the-big-war/client/game/sim/sim.types';
import { createSimHost } from '@the-big-war/client/game/sim/sim-host.service';
import { FIXED_DT } from '@the-big-war/game-engine/simulation/simulation.constants';
import { createMirrorStore } from '@the-big-war/client/game/sim/mirror-store.service';
import { DEFAULT_GAME_CONFIG } from '@the-big-war/client/game/config/config.constants';

const UNIT_COUNTS: readonly number[] = [0, 1000, 5000, 20000];
const WARMUP_FRAMES = 30;
const SAMPLE_FRAMES = 150;
const SIZE_EVERY = 10;
const MOVING_SHARE = 0.25;

function mean(samples: readonly number[]): number {
  return samples.reduce((sum, sample) => sum + sample, 0) / Math.max(1, samples.length);
}

function run(unitCount: number): void {
  const config = {
    ...DEFAULT_GAME_CONFIG,
    map: { ...DEFAULT_GAME_CONFIG.map, width: 240, height: 140, seed: 1914 },
    start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 8 },
  };
  let outbox: { reply: SimReply; transfer: Transferable[] }[] = [];
  const host = createSimHost((reply, transfer) => outbox.push({ reply, transfer }));
  let deliver: (reply: SimReply) => void = () => {};
  const mirror = createMirrorStore({ post: () => {}, listen: handler => (deliver = handler) });

  host.handle({ type: 'start', seq: 1, config, demo: true });
  for (const { reply, transfer } of outbox) deliver(structuredClone(reply, { transfer }));
  outbox = [];

  const state = host.state;
  const empires = state.empires.filter(empire => empire.alive);
  const perEmpire = Math.ceil(unitCount / Math.max(1, empires.length));
  for (const empire of empires) {
    const owned = state.grid.cells.filter(cell => cell.owner === empire.id && !cell.building);
    for (let made = 0; made < perEmpire && owned.length > 0; made += 25) {
      const cell = owned[(made / 25) % owned.length]!;
      spawnUnits(state, empire.id, cell, Math.min(25, perEmpire - made));
    }
  }
  state.units.forEach((unit, at) => {
    if (at % Math.round(1 / MOVING_SHARE) !== 0) return;
    unit.tx += state.config.map.hexSize * 3;
    unit.ty += state.config.map.hexSize;
  });

  const encode: number[] = [];
  const transfer: number[] = [];
  const apply: number[] = [];
  const bytes: number[] = [];
  for (let frame = 0; frame < WARMUP_FRAMES + SAMPLE_FRAMES; frame++) {
    host.advance(FIXED_DT);
    const encodeStart = performance.now();
    host.publish();
    const encodeEnd = performance.now();
    for (const sent of outbox) {
      if (frame >= WARMUP_FRAMES && frame % SIZE_EVERY === 0) bytes.push(serialize(sent.reply).byteLength);
      const cloneStart = performance.now();
      const received = structuredClone(sent.reply, { transfer: sent.transfer });
      const cloneEnd = performance.now();
      deliver(received);
      const applyEnd = performance.now();
      if (frame < WARMUP_FRAMES) continue;
      encode.push(encodeEnd - encodeStart);
      transfer.push(cloneEnd - cloneStart);
      apply.push(applyEnd - cloneEnd);
    }
    outbox = [];
  }

  const total = mean(encode) + mean(transfer) + mean(apply);
  console.log(
    `${String(mirror.state.units.length).padStart(5)} units: encode ${mean(encode).toFixed(3)}ms, ` +
      `clone ${mean(transfer).toFixed(3)}ms, apply ${mean(apply).toFixed(3)}ms, ` +
      `total ${total.toFixed(3)}ms/frame (${((total * 30) / 10).toFixed(1)}% of a core at 30Hz), ` +
      `${(mean(bytes) / 1024).toFixed(1)} KB/frame`,
  );
}

for (const unitCount of UNIT_COUNTS) run(unitCount);
