import type { Terrain } from '../game/map/map.types';
import { FACTIONS } from '../game/faction/faction.constants';
import type { BuildingKind } from '../game/building/building.types';
import type { CommandError } from '../game/commands/commands.types';

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
  trench: 'Trench',
  machine_gun: 'Machine Gun',
  battery: 'Artillery Battery',
  bunker: 'Bunker',
};

export function buildingLabel(kind: BuildingKind): string {
  return BUILDING_LABELS[kind];
}

const BUILDING_DESCRIPTIONS: Readonly<Record<BuildingKind, string>> = {
  city: 'The heart of your territory. Claims the hexes around it, defends them and lets you attack from nearby. Upgrading widens the territory it claims.',
  market: 'Earns a steady stream of gold. Needs civilians to work it.',
  lumberjack: 'Earns gold from nearby forest. Must be built next to forest.',
  miner: 'Earns gold from nearby mountains. Must be built next to a mountain.',
  farm: 'Speeds up population growth. Each farm adds more, up to a cap. Must be built next to plains.',
  lab: 'Produces science for research, plus a little gold.',
  barracks: 'Raises how many troops you can hold in reserve and lets you attack from nearby hexes.',
  fort: 'Troops within its radius fight 50% more effectively.',
  cannon: 'Fires at distant hexes to damage defenders and clear forests and mountains. Needs a reload between shots. Unlocked through research.',
  trench: 'Troops fighting from a trench hex defend 35% better. Cheap, and can be dug right next to other buildings to form unbroken lines.',
  machine_gun: 'Troops holding the line within 2 hexes hit attackers 50% harder and defend 20% better. No effect while attacking. Unlocked through research.',
  battery: 'Shells the most crowded enemy front in range on its own, with no gold per shot. Unlocked through research.',
  bunker: 'Troops on this hex and the hexes beside it defend 75% better and take half damage from shelling. Unlocked through research.',
};

export function buildingDescription(kind: BuildingKind): string {
  return BUILDING_DESCRIPTIONS[kind];
}

export function factionLabel(factionId: string): string {
  const faction = FACTIONS.find(entry => entry.id === factionId);
  return faction?.name ?? factionId;
}

const TERRAIN_LABELS: Readonly<Record<Terrain, string>> = {
  plain: 'Plain',
  forest: 'Forest',
  mountain: 'Mountain',
};

export function terrainLabel(terrain: Terrain): string {
  return TERRAIN_LABELS[terrain];
}

const ERROR_LABELS: Readonly<Record<CommandError, string>> = {
  insufficient_gold: 'Not enough gold',
  insufficient_civilians: 'No civilians free to build',
  insufficient_science: 'Not enough science',
  insufficient_troops: 'No troops free',
  reserve_full: 'Reserve full',
  invalid_target: 'Invalid target',
  not_researched: 'Not researched yet',
  cooldown: 'Still reloading',
  not_playing: 'Match not running',
  no_empire: 'No empire',
  research_unavailable: 'Research unavailable',
  in_peace: 'Under peace treaty',
  already_at_war: 'Already at war',
  invalid_diplomacy: 'Invalid diplomatic action',
  offer_rejected: 'Offer rejected',
  offer_cooldown: 'Offer recently rejected',
  offer_pending: 'Offer awaiting a reply',
  offer_missing: 'Offer no longer stands',
};

export function errorLabel(reason: CommandError): string {
  return ERROR_LABELS[reason] ?? reason;
}

const FACTION_ICONS: Readonly<Record<string, string>> = {
  ironclad: '⚔',
  league: '💰',
  verdant: '🔨',
  academy: '⚗',
};

export function factionIcon(factionId: string): string {
  return FACTION_ICONS[factionId] ?? '⚑';
}
