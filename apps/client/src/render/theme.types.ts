import type { Terrain } from '../game/map/map.types';

export type ColorValue = number;

export type TerrainColorMap = Readonly<Record<Terrain, ColorValue>>;

export type TerrainMixMap = Readonly<Record<Terrain, number>>;
