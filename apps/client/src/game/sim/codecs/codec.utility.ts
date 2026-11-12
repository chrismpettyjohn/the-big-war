export const orNaN = (value: number | null | undefined): number => value ?? Number.NaN;

export const orNull = (value: number): number | null => (Number.isNaN(value) ? null : value);

export function sameRow(row: Float64Array, previous: Float64Array | undefined, from = 0, length = row.length - from): boolean {
  if (!previous || previous.length !== length) return false;
  for (let at = 0; at < length; at++) {
    if (!Object.is(row[from + at], previous[at])) return false;
  }
  return true;
}

export function sameOrder(order: readonly number[], previous: readonly number[]): boolean {
  if (order.length !== previous.length) return false;
  for (let at = 0; at < order.length; at++) {
    if (order[at] !== previous[at]) return false;
  }
  return true;
}
