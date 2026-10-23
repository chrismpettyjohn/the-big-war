import { MAP_SHAPE } from './map.constants';
import type { GameConfig } from '../config/config.types';
import { NEUTRAL_OWNER } from '../empire/empire.constants';
import type { HexCell, HexGrid, Terrain } from './map.types';
import type { Rng } from '@the-big-war/game-engine/rng/rng.types';
import { nextFloat, nextInt } from '@the-big-war/game-engine/rng/rng.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { area, distance, gridAt, gridInBounds, makeGrid, neighbor } from '@the-big-war/game-engine/world-tile/world-tile.service';

function paintBlob(grid: HexGrid, rng: Rng, center: Axial, radius: number, terrain: Terrain): void {
  for (const hex of area(center, radius)) {
    if (!gridInBounds(grid, hex.q, hex.r)) continue;

    if (distance(center, hex) === radius && nextFloat(rng) < 0.5) continue;
    const cell = gridAt(grid, hex);
    if (!cell) continue;

    cell.terrain = terrain;
  }
}

function paintRange(grid: HexGrid, rng: Rng, start: Axial): void {
  const length =
    MAP_SHAPE.rangeMinLength + nextInt(rng, MAP_SHAPE.rangeMaxLength - MAP_SHAPE.rangeMinLength + 1);
  let direction = nextInt(rng, 6);
  let hex = start;
  for (let step = 0; step < length; step++) {
    const cell = gridAt(grid, hex);
    if (cell) cell.terrain = 'mountain';
    if (nextFloat(rng) < MAP_SHAPE.rangeWidenChance) {
      const side = gridAt(grid, neighbor(hex, (direction + (nextFloat(rng) < 0.5 ? 1 : 5)) % 6));
      if (side) side.terrain = 'mountain';
    }
    if (nextFloat(rng) < MAP_SHAPE.rangeTurnChance) direction = (direction + (nextFloat(rng) < 0.5 ? 1 : 5)) % 6;
    hex = neighbor(hex, direction);
    if (!gridInBounds(grid, hex.q, hex.r)) return;
  }
}

export function generateTerrain(config: GameConfig, rng: Rng): HexGrid {
  const { width, height } = config.map;
  const grid = makeGrid<HexCell>(width, height, hex => ({
    q: hex.q,
    r: hex.r,
    terrain: 'plain',
    owner: NEUTRAL_OWNER,
    building: null,
  }));

  const randomCenter = (): Axial => ({
    q: nextInt(rng, width),
    r: nextInt(rng, height),
  });

  for (let i = 0; i < MAP_SHAPE.mountainRanges; i++) paintRange(grid, rng, randomCenter());
  for (let i = 0; i < MAP_SHAPE.forestPatches; i++) {
    const radius =
      MAP_SHAPE.patchMinRadius + nextInt(rng, MAP_SHAPE.patchMaxRadius - MAP_SHAPE.patchMinRadius + 1);
    paintBlob(grid, rng, randomCenter(), radius, 'forest');
  }

  for (const cell of grid.cells) {
    if (cell.terrain !== 'plain') continue;
    if (nextFloat(rng) < MAP_SHAPE.forestVeinChance) cell.terrain = 'forest';
  }

  return grid;
}

