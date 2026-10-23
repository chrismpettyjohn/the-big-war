import { FACTIONS } from './faction.constants';
import type { FactionDef } from './faction.types';

export function factionById(id: string): FactionDef | undefined {
  return FACTIONS.find(faction => faction.id === id);
}

export function defaultFactionId(empireId: number, factions: readonly string[]): string {
  if (factions.length === 0) return '';
  return factions[empireId % factions.length] ?? '';
}
