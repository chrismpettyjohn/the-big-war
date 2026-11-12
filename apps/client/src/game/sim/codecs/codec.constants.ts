import type { UnitMode } from '../../unit/unit.types';
import type { Biome, Terrain } from '../../map/map.types';
import type { GathererPhase } from '../../building/building.types';

export const TERRAINS: readonly Terrain[] = ['plain', 'forest', 'mountain', 'ore', 'water'];
export const BIOMES: readonly Biome[] = ['temperate', 'steppe', 'desert', 'tundra', 'taiga', 'jungle', 'swamp', 'volcanic'];
export const GATHERER_PHASES: readonly GathererPhase[] = ['idle', 'outbound', 'working', 'returning'];
export const UNIT_MODES: readonly UnitMode[] = ['amove', 'guard', 'hold'];

export const TILE_STRIDE = 5;
export const BUILDING_STRIDE = 11;
export const GATHERER_STRIDE = 7;
export const UNIT_STRIDE = 23;

export const ECONOMY_FIELDS = ['gold', 'science', 'civilians', 'goldBalance', 'scienceBalance', 'civilianBalance', 'hexCount'] as const;
export const ECONOMY_STRIDE = ECONOMY_FIELDS.length + 1;
