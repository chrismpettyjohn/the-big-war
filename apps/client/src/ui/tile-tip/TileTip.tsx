import './TileTip.css';
import { Show } from 'solid-js';
import type { TileTipProps } from './TileTip.types';
import { buildingLabel, terrainLabel } from '../text';
import { gameStore } from '../../game/store/store.service';
import { gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';

export type { TileTipProps };

export const TileTip = (props: TileTipProps) => {
  const store = gameStore();
  const hex = () => props.runtime.controllers.hoverHex();
  const cell = () => {
    store.version();
    const at = hex();
    return at ? (gridAt(store.state.grid, at) ?? null) : null;
  };

  return (
    <Show when={cell()}>
      {current => {
        const at = () => props.runtime.hexTopToClient(current());
        const owner = () => store.state.empires[current().owner];
        const label = () => {
          const building = cell()?.building;
          return building ? buildingLabel(building.kind) : terrainLabel(current().terrain);
        };
        const bonus = () =>
          Math.round((store.state.config.combat.terrainDefence[current().terrain] - 1) * 100);
        return (
          <div class="tile-tip" style={{ left: `${at().x}px`, top: `${at().y}px` }}>
            <span
              class="tile-tip-swatch"
              style={{ background: owner() ? `var(--faction-${owner()!.colorIndex})` : 'transparent' }}
            />
            <span>{label()}</span>
            <Show when={!cell()?.building}>
              <span class="kit-num">+{bonus()}%</span>
            </Show>
          </div>
        );
      }}
    </Show>
  );
};
