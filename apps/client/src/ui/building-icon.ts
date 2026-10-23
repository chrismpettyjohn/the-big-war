import type { BuildingKind } from '../game/building/building.types';
import { BUILDING_SPRITES, SPRITE_PALETTE, SPRITE_SIZE } from '../render/pixel-sprites';

const iconCache = new Map<BuildingKind, string>();

export function buildingIcon(kind: BuildingKind): string {
  const cached = iconCache.get(kind);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;
  BUILDING_SPRITES[kind].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = SPRITE_PALETTE[ch];
      if (color === undefined) return;
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  const url = canvas.toDataURL();
  iconCache.set(kind, url);
  return url;
}
