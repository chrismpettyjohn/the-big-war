import type { Modifier, ModifierTotal, ModifierTotals } from './modifier.types';

export function emptyModifierTotals<K extends string>(keys: readonly K[]): ModifierTotals<K> {
  const totals = {} as Record<K, ModifierTotal>;
  for (const key of keys) totals[key] = { add: 0, mul: 1 };
  return totals;
}

export function aggregateModifiers<K extends string>(keys: readonly K[], modifiers: readonly Modifier<K>[]): ModifierTotals<K> {
  const totals = emptyModifierTotals(keys);
  for (const mod of modifiers) {
    const bucket: ModifierTotal = totals[mod.key];
    if (mod.add !== undefined) bucket.add += mod.add;
    if (mod.mul !== undefined) bucket.mul *= mod.mul;
  }
  return totals;
}

export function resolveModifier(base: number, total: ModifierTotal): number {
  return (base + total.add) * total.mul;
}
