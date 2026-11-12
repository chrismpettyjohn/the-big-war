import type { KeyedStores } from './live.types';
import { getListener, onCleanup } from 'solid-js';
import { createStore, reconcile, type SetStoreFunction } from 'solid-js/store';

interface Entry<V> {
  readonly store: { value: V | null };
  readonly set: SetStoreFunction<{ value: V | null }>;
  users: number;
}

const copy = <V>(value: V | null): V | null => (value === null ? null : structuredClone(value));

export function createKeyedStores<K, V>(read: (key: K) => V | null): KeyedStores<K, V> {
  const entries = new Map<K, Entry<V>>();

  const release = (key: K, entry: Entry<V>): void => {
    entry.users -= 1;
    if (entry.users > 0) return;
    queueMicrotask(() => {
      if (entry.users === 0 && entries.get(key) === entry) entries.delete(key);
    });
  };

  const refresh = (key: K, entry: Entry<V>): void => {
    entry.set('value', reconcile(copy(read(key))));
  };

  return {
    get(key: K): V | null {
      if (!getListener()) return read(key);
      let entry = entries.get(key);
      if (!entry) {
        const [store, set] = createStore<{ value: V | null }>({ value: copy(read(key)) });
        entry = { store, set, users: 0 };
        entries.set(key, entry);
      }
      const held = entry;
      held.users += 1;
      onCleanup(() => release(key, held));
      return held.store.value;
    },
    dirty(key: K): void {
      const entry = entries.get(key);
      if (entry) refresh(key, entry);
    },
    dirtyAll(): void {
      for (const [key, entry] of entries) refresh(key, entry);
    },
  };
}
