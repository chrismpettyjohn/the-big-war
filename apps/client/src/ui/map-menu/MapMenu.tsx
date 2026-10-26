

import './MapMenu.css';
import { Show } from 'solid-js';
import { terrainLabel } from '../text';
import type { MapMenuProps } from './MapMenu.types';
import type { Front } from '../../game/front/front.types';
import { gameStore } from '../../game/store/store.service';
import { getRelation, treatySecondsLeft } from '../../game/diplomacy/diplomacy.service';
import { gridAt, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';
import { ContextMenu, type MenuEntry } from '@the-big-war/frontend/ui/context-menu/ContextMenu';

export type { MapMenuProps };

export const MapMenu = (props: MapMenuProps) => {
  const store = gameStore();
  const menu = () => props.controllers.contextMenu();

  const cell = () => {
    const target = menu();
    return target ? (gridAt(store.state.grid, target.hex) ?? null) : null;
  };
  const player = () => store.state.playerEmpire;
  const isOwn = () => cell()?.owner === player();
  const isForeign = () => {
    const current = cell();
    return !!current && current.owner !== player() && current.owner >= 0;
  };
  const front = (): Front | null => {
    const target = menu();
    if (!target) return null;
    return (
      store.state.fronts.find(
        entry =>
          (entry.hexA.q === target.hex.q && entry.hexA.r === target.hex.r) ||
          (entry.hexB.q === target.hex.q && entry.hexB.r === target.hex.r),
      ) ?? null
    );
  };
  const attackFrom = () => {
    const target = menu();
    if (!target) return null;
    for (const candidate of neighbors(target.hex)) {
      if (gridAt(store.state.grid, candidate)?.owner === player()) return candidate;
    }
    return null;
  };
  const send = (intent: 'attack' | 'defence') => {
    const target = menu();
    const from = attackFrom();
    if (!target || !from) return;
    const result = store.dispatch({
      type: 'SendTroops',
      empire: player(),
      hex: from,
      target: target.hex,
      percent: props.controllers.troopPercent(),
      intent,
    });
    if (!result.ok) props.controllers.notice(result.reason);
  };

  const entries = (): MenuEntry[] => {
    const current = cell();
    const list: MenuEntry[] = [];
    if (!current) return list;

    list.push({
      type: 'header',
      label: `${menu()!.hex.q}, ${menu()!.hex.r} · ${terrainLabel(current.terrain)}`,
    });

    if (isForeign()) {
      const adjacent = attackFrom();

      if (adjacent) {
        list.push({
          type: 'item',
          label: `Land attack (${props.controllers.troopPercent()}%)`,
          disabled: store.state.empires[player()]!.soldiers <= 0,
          onClick: () => send('attack'),
        });
      }

      if (front() || adjacent) {
        list.push({
          type: 'item',
          label: 'Hold',
          disabled: store.state.empires[player()]!.soldiers <= 0,
          onClick: () => send('defence'),
        });
      }

      const atWar = getRelation(store.state, player(), current.owner).status === 'war';
      const treaty = Math.ceil(treatySecondsLeft(store.state, player(), current.owner));
      list.push({
        type: 'item',
        label: atWar ? 'Make Peace' : 'Declare War',
        note: treaty > 0 ? `Treaty ${treaty}s` : undefined,
        disabled: treaty > 0,
        onClick: () => {
          const result = store.dispatch({ type: atWar ? 'OfferPeace' : 'DeclareWar', empire: player(), target: current.owner });
          if (!result.ok) props.controllers.notice(result.reason);
        },
      });

      list.push({ type: 'divider' });
    }

    list.push({
      type: 'item',
      label: 'Territory',
      onClick: () => props.onInspect(),
    });

    if (isOwn()) {
      list.push({ type: 'item', label: 'Construction', onClick: () => props.onBuild() });
      if (current.building?.kind === 'cannon' && current.building.cooldown <= 0) {
        list.push({
          type: 'item',
          label: `Fire Cannon  ·  ${store.state.config.cannon.cost} Gold`,
          danger: true,
          onClick: () => {
            const target = menu();
            if (target) props.controllers.setTool({ kind: 'cannon', from: target.hex });
          },
        });
      }
      const trench = current.building?.kind === 'trench' && current.building.buildRemaining <= 0 ? current.building : null;
      if (trench) {
        const order = (type: 'ManTrench' | 'LeaveTrench', percent: number) => {
          const target = menu();
          if (!target) return;
          const result = store.dispatch({ type, empire: player(), hex: target.hex, percent });
          if (!result.ok) props.controllers.notice(result.reason);
        };
        list.push({
          type: 'item',
          label: `Man trench  ·  ${props.controllers.troopPercent()}%`,
          note: `${Math.floor(trench.garrison)}/${store.state.config.trench.capacity}`,
          onClick: () => order('ManTrench', props.controllers.troopPercent()),
        });
        if (trench.garrison >= 1) {
          list.push({ type: 'item', label: 'Withdraw', onClick: () => order('LeaveTrench', 100) });
          list.push({
            type: 'item',
            label: 'Attack from trench',
            danger: true,
            onClick: () => {
              const target = menu();
              if (target) props.controllers.setTool({ kind: 'trench-attack', from: target.hex });
            },
          });
        }
      }
      if (current.building) {
        list.push({
          type: 'item',
          label: 'Demolish',
          danger: true,
          onClick: () => {
            const target = menu();
            if (!target) return;
            const result = store.dispatch({ type: 'DemolishBuilding', empire: player(), hex: target.hex });
            if (!result.ok) props.controllers.notice(result.reason);
          },
        });
      }
    }

    list.push({ type: 'divider' });
    list.push({ type: 'item', label: 'Combat', onClick: () => props.onArmy() });

    if (front()) {
      list.push({
        type: 'item',
        label: 'Front',
        note: `${Math.floor(front()!.sideA.troops)} : ${Math.floor(front()!.sideB.troops)}`,
        onClick: () => props.onArmy(),
      });
    }

    return list;
  };

  return (
    <Show when={menu()}>
      {target => (
        <ContextMenu
          x={target().at.x}
          y={target().at.y}
          entries={entries()}
          onClose={() => props.controllers.closeContextMenu()}
        />
      )}
    </Show>
  );
};
