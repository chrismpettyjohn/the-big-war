/**
 * Display text helpers shared by the UI.
 *
 * Game data (factions, buildings, terrain) has stable ids; the UI needs a label
 * for each. Keeping the mapping in one place means a new building kind shows up
 * as a readable name everywhere instead of leaking its raw id into a button.
 */

import { FACTIONS } from '../game/config';
import type { BuildingKind, CommandError, Terrain } from '../game/types';
import { t } from '../i18n';

/** Canonical label per building kind (exhaustive — a new kind breaks the build). */
const BUILDING_LABELS: Readonly<Record<BuildingKind, string>> = {
  city: 'City',
  market: 'Market',
  lumberjack: 'Lumberjack',
  miner: 'Miner',
  farm: 'Farm',
  lab: 'Lab',
  barracks: 'Barracks',
  fort: 'Fort',
  cannon: 'Cannon',
};

/** Human label for a building kind. */
export function buildingLabel(kind: BuildingKind): string {
  return BUILDING_LABELS[kind];
}

/** Human label for a faction id, falling back to the id when unknown. */
export function factionLabel(factionId: string): string {
  const faction = FACTIONS.find(entry => entry.id === factionId);
  return faction?.name ?? factionId;
}

/** Terrain label for tooltips. */
export function terrainLabel(terrain: Terrain): string {
  switch (terrain) {
    case 'plain':
      return t('terrain.plain');
    case 'forest':
      return t('terrain.forest');
    case 'mountain':
      return t('terrain.mountain');
    case 'water':
      return t('terrain.water');
  }
}

/**
 * Message for a rejected command. Typed against `CommandError` so a new reason
 * is a build error here rather than a raw `error.foo` string in a toast.
 */
export function errorLabel(reason: CommandError): string {
  return t(`error.${reason}` as never);
}
