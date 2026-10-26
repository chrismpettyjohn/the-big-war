import { MAP_SHAPE } from './map.constants';
import type { GameConfig } from '../config/config.types';
import { NEUTRAL_OWNER } from '../empire/empire.constants';
import type { HexCell, HexGrid, Terrain } from './map.types';
import type { Rng } from '@the-big-war/game-engine/rng/rng.types';
import { nextFloat, nextInt } from '@the-big-war/game-engine/rng/rng.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { area, distance, gridAt, gridInBounds, makeGrid, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';

function paintBlob(grid: HexGrid, rng: Rng, center: Axial, radius: number, terrain: Terrain): void {
  for (const hex of area(center, radius)) {
    if (!gridInBounds(grid, hex.q, hex.r)) continue;

    if (distance(center, hex) === radius && nextFloat(rng) < 0.5) continue;
    const cell = gridAt(grid, hex);
    if (!cell || cell.terrain === 'mountain') continue;

    cell.terrain = terrain;
  }
}

function paintRange(grid: HexGrid, rng: Rng, start: Axial): void {
  const length =
    MAP_SHAPE.rangeMinLength + nextInt(rng, MAP_SHAPE.rangeMaxLength - MAP_SHAPE.rangeMinLength + 1);
  let heading = nextFloat(rng) * Math.PI * 2;
  let x = start.q;
  let y = start.r;
  const spine: Axial[] = [{ q: start.q, r: start.r }];
  while (spine.length < length) {
    heading += (nextFloat(rng) - 0.5) * MAP_SHAPE.rangeBend;
    x += Math.cos(heading);
    y += Math.sin(heading);
    const target = { q: Math.round(x), r: Math.round(y) };
    let last = spine[spine.length - 1]!;
    while (last.q !== target.q || last.r !== target.r) {
      last = last.q !== target.q && (last.r === target.r || nextFloat(rng) < 0.5)
        ? { q: last.q + Math.sign(target.q - last.q), r: last.r }
        : { q: last.q, r: last.r + Math.sign(target.r - last.r) };
      spine.push(last);
    }
  }

  spine.forEach((hex, index) => {
    const along = index / Math.max(1, spine.length - 1);
    const core = along > MAP_SHAPE.rangeTaper && along < 1 - MAP_SHAPE.rangeTaper;
    paintMountain(grid, hex);
    if (!core) return;
    for (const side of neighbors(hex)) {
      if (nextFloat(rng) < MAP_SHAPE.rangeWidenChance) paintMountain(grid, side);
    }
  });
}

function paintMountain(grid: HexGrid, hex: Axial): void {
  const cell = gridAt(grid, hex);
  if (cell) cell.terrain = 'mountain';
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

  const inset = MAP_SHAPE.rangeEdgeInset;
  for (let i = 0; i < MAP_SHAPE.mountainRanges; i++) {
    paintRange(grid, rng, { q: inset + nextInt(rng, width - inset * 2), r: inset + nextInt(rng, height - inset * 2) });
  }
  for (let i = 0; i < MAP_SHAPE.forestPatches; i++) {
    const radius =
      MAP_SHAPE.patchMinRadius + nextInt(rng, MAP_SHAPE.patchMaxRadius - MAP_SHAPE.patchMinRadius + 1);
    paintBlob(grid, rng, randomCenter(), radius, 'forest');
  }

  for (const cell of grid.cells) {
    if (cell.terrain !== 'plain') continue;
    if (nextFloat(rng) < MAP_SHAPE.forestVeinChance) cell.terrain = 'forest';
  }

  pruneLoneMountains(grid);
  placeOre(grid, rng);
  return grid;
}

export function pruneLoneMountains(grid: HexGrid): void {
  for (const cell of grid.cells) {
    if (cell.terrain !== 'mountain') continue;
    if (!neighbors(cell).some(hex => gridAt(grid, hex)?.terrain === 'mountain')) cell.terrain = 'plain';
  }
}

function placeOre(grid: HexGrid, rng: Rng): void {
  const foothills = grid.cells.filter(
    cell => cell.terrain === 'plain' && neighbors(cell).some(hex => gridAt(grid, hex)?.terrain === 'mountain'),
  );
  if (foothills.length === 0) return;
  const deposits: Axial[] = [];
  for (let attempt = 0; attempt < foothills.length && deposits.length < MAP_SHAPE.oreDeposits; attempt++) {
    const seed = foothills[nextInt(rng, foothills.length)]!;
    if (seed.terrain !== 'plain') continue;
    if (deposits.some(existing => distance(existing, seed) < MAP_SHAPE.oreSpacing)) continue;
    deposits.push(seed);
    const size = MAP_SHAPE.oreMinSize + nextInt(rng, MAP_SHAPE.oreMaxSize - MAP_SHAPE.oreMinSize + 1);
    const vein: HexCell[] = [seed];
    seed.terrain = 'ore';
    while (vein.length < size) {
      const from = vein[nextInt(rng, vein.length)]!;
      const options = neighbors(from)
        .map(hex => gridAt(grid, hex))
        .filter((cell): cell is HexCell => cell !== undefined && (cell.terrain === 'plain' || cell.terrain === 'forest'));
      if (options.length === 0) break;
      const next = options[nextInt(rng, options.length)]!;
      next.terrain = 'ore';
      vein.push(next);
    }
  }
}
