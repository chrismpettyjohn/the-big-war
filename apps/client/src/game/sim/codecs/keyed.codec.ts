import { sameOrder } from './codec.utility';
import type { KeyedPatch, KeyedShadow } from '../sim.types';

export function createKeyedShadow(): KeyedShadow {
  return { seen: new Map(), order: [] };
}

export function diffKeyed<T, V>(
  items: readonly T[],
  shadow: KeyedShadow,
  key: (item: T) => number,
  view: (item: T) => V,
  forced: (item: T) => boolean = () => false,
): KeyedPatch<V> | null {
  const upserts: V[] = [];
  const order: number[] = [];
  for (const item of items) {
    const id = key(item);
    order.push(id);
    const force = forced(item);
    const next = view(item);
    const print = JSON.stringify(next);
    if (!force && shadow.seen.get(id) === print) continue;
    shadow.seen.set(id, print);
    upserts.push(next);
  }
  const unchanged = sameOrder(order, shadow.order);
  const removed: number[] = [];
  if (!unchanged) {
    const present = new Set(order);
    for (const id of shadow.seen.keys()) {
      if (present.has(id)) continue;
      removed.push(id);
      shadow.seen.delete(id);
    }
    shadow.order = order;
  }
  if (upserts.length === 0 && unchanged) return null;
  return { upserts, removed, order: unchanged ? null : order };
}

export function applyKeyed<L, V>(
  current: readonly L[],
  patch: KeyedPatch<V>,
  key: (item: L | V) => number,
  create: (view: V) => L,
  update: (item: L, view: V) => void,
  changed?: Set<number>,
): L[] {
  const known = new Map<number, L>();
  for (const item of current) known.set(key(item), item);
  for (const id of patch.removed) {
    known.delete(id);
    changed?.add(id);
  }
  for (const view of patch.upserts) {
    const id = key(view);
    const existing = known.get(id);
    if (existing) update(existing, view);
    else known.set(id, create(view));
    changed?.add(id);
  }
  if (!patch.order) return current as L[];
  return patch.order.map(id => known.get(id)!);
}
