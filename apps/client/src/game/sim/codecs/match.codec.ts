import type { WorldSlice } from '../../map/map.types';
import type { MatchSlice } from '../../state/state.types';
import type { FrameChanges, MatchFields, MatchPatch, SimShadow } from '../sim.types';

type MatchSource = MatchSlice & Pick<WorldSlice, 'landHexCount'>;

const MATCH_FIELDS: readonly (keyof MatchFields)[] = [
  'status',
  'playerEmpire',
  'speed',
  'tick',
  'elapsed',
  'winner',
  'endReason',
  'landHexCount',
  'spawnSites',
];

const print = (value: unknown): string => (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value));

export function encodeMatch(state: MatchSource, shadow: SimShadow): MatchPatch | null {
  let patch: Record<string, unknown> | null = null;
  for (const field of MATCH_FIELDS) {
    const value = state[field];
    const printed = print(value);
    if (shadow.fields[field] === printed) continue;
    shadow.fields[field] = printed;
    patch ??= {};
    patch[field] = value;
  }
  return patch as MatchPatch | null;
}

export function applyMatch(state: MatchSource, patch: MatchPatch, changes: FrameChanges): void {
  Object.assign(state, patch);
  for (const field of Object.keys(patch) as (keyof MatchFields)[]) changes.fields.add(field);
}
