import type { TriggerCache } from './live.types';
import { createSignal, getListener, onCleanup } from 'solid-js';

interface Trigger {
  readonly read: () => void;
  readonly write: () => void;
  users: number;
}

export function createTriggerCache<K>(): TriggerCache<K> {
  const triggers = new Map<K, Trigger>();

  const release = (key: K, trigger: Trigger): void => {
    trigger.users -= 1;
    if (trigger.users > 0) return;
    queueMicrotask(() => {
      if (trigger.users === 0 && triggers.get(key) === trigger) triggers.delete(key);
    });
  };

  return {
    track(key: K): void {
      if (!getListener()) return;
      let trigger = triggers.get(key);
      if (!trigger) {
        const [read, write] = createSignal(undefined, { equals: false });
        trigger = { read, write: () => write(), users: 0 };
        triggers.set(key, trigger);
      }
      const held = trigger;
      held.users += 1;
      onCleanup(() => release(key, held));
      held.read();
    },
    dirty(key: K): void {
      triggers.get(key)?.write();
    },
    dirtyAll(): void {
      for (const trigger of triggers.values()) trigger.write();
    },
  };
}
