import type { GameState } from '../state/state.types';
import type { GameConfig } from '../config/config.types';
import { createLiveState } from '../live/live-state.service';
import { DEFAULT_GAME_CONFIG } from '../config/config.constants';
import type { Command, CommandResult } from '../commands/commands.types';
import type { MirrorStore, SimLink, SimPerf, SimReply } from './sim.types';
import { applyFrame, applySnapshot, emptyChanges, emptyMirror } from './sim-codec.service';

export function createMirrorStore(link: SimLink, demo = false): MirrorStore {
  const liveState = createLiveState(emptyMirror(DEFAULT_GAME_CONFIG));
  let nextSeq = 1;
  let match = 0;
  let lastSeq = 0;
  let resyncing = false;
  const waiting = new Map<number, (value: never) => void>();

  const request = <T>(send: (seq: number) => void): Promise<T> =>
    new Promise<T>(resolve => {
      const seq = nextSeq++;
      waiting.set(seq, resolve as (value: never) => void);
      send(seq);
    });

  const settle = (seq: number, value?: unknown): void => {
    const resolve = waiting.get(seq);
    waiting.delete(seq);
    resolve?.(value as never);
  };

  const receive = (reply: SimReply): void => {
    switch (reply.type) {
      case 'snapshot':
        match = reply.match;
        lastSeq = reply.frame.seq;
        resyncing = false;
        liveState.setPaused(reply.frame.paused);
        liveState.load(applySnapshot(reply));
        settle(reply.seq);
        return;
      case 'frame': {
        if (reply.match !== match || resyncing) return;
        if (reply.seq !== lastSeq + 1) {
          resyncing = true;
          void request<void>(seq => link.post({ type: 'resync', seq }));
          return;
        }
        lastSeq = reply.seq;
        const changes = applyFrame(liveState.raw, reply, emptyChanges());
        liveState.setPaused(reply.paused);
        liveState.apply(changes);
        return;
      }
      case 'result':
        settle(reply.seq, reply.result);
        return;
      case 'perf':
        settle(reply.seq, reply.perf);
        return;
    }
  };

  link.listen(receive);

  return {
    get state(): GameState {
      return liveState.view;
    },
    get raw(): GameState {
      return liveState.raw;
    },
    live: liveState,
    dispatch: (command: Command) =>
      request<CommandResult>(seq => link.post({ type: 'command', seq, match, command })),
    startMatch: (config?: GameConfig) => request<void>(seq => link.post({ type: 'start', seq, config, demo })),
    returnToMenu: () => {
      void request<void>(seq => link.post({ type: 'menu', seq }));
    },
    setPaused: value => link.post({ type: 'paused', value }),
    paused: liveState.paused,
    setSpeed: value => link.post({ type: 'speed', value }),
    status: () => liveState.view.status,
    winner: () => liveState.view.winner,
    perf: () => request<SimPerf>(seq => link.post({ type: 'perf', seq })),
  };
}
