import { sameRow } from './codec.utility';
import { ECONOMY_FIELDS, ECONOMY_STRIDE } from './codec.constants';
import type { Empire, EmpiresSlice } from '../../empire/empire.types';
import type { EmpiresPatch, FrameChanges, SimShadow } from '../sim.types';

function profilePrint(empire: Empire): string {
  const { gold: _gold, science: _science, civilians: _civilians, goldBalance: _gb, scienceBalance: _sb, civilianBalance: _cb, hexCount: _hc, ...profile } = empire;
  return JSON.stringify(profile);
}

export function encodeEmpires(state: EmpiresSlice, shadow: SimShadow): EmpiresPatch | null {
  const rows = new Float64Array(state.empires.length * ECONOMY_STRIDE);
  const profiles: [number, Empire][] = [];
  let cursor = 0;
  state.empires.forEach((empire, at) => {
    const printed = profilePrint(empire);
    if (shadow.profiles.get(at) !== printed) {
      shadow.profiles.set(at, printed);
      profiles.push([at, empire]);
    }
    const start = cursor;
    rows[cursor++] = at;
    for (const field of ECONOMY_FIELDS) rows[cursor++] = empire[field];
    if (sameRow(rows, shadow.economy.get(at), start, ECONOMY_STRIDE)) {
      cursor = start;
      return;
    }
    shadow.economy.set(at, rows.slice(start, cursor));
  });
  if (cursor === 0 && profiles.length === 0) return null;
  return { economy: rows.slice(0, cursor), profiles };
}

export function applyEmpires(state: EmpiresSlice, patch: EmpiresPatch, changes: FrameChanges): void {
  for (const [at, empire] of patch.profiles) {
    const existing = state.empires[at];
    if (existing) Object.assign(existing, empire);
    else state.empires[at] = { ...empire };
    changes.empires.add(at);
  }
  const rows = patch.economy;
  for (let row = 0; row < rows.length; row += ECONOMY_STRIDE) {
    const at = rows[row]!;
    const empire = state.empires[at]!;
    ECONOMY_FIELDS.forEach((field, offset) => {
      empire[field] = rows[row + 1 + offset]!;
    });
    changes.empires.add(at);
  }
}
