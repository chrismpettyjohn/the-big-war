

import './MapMenu.css';
import { Show } from 'solid-js';
import { terrainLabel } from '../text';
import type { MapMenuProps } from './MapMenu.types';
import type { Front } from '../../game/front/front.types';
import { gameStore } from '../../game/store/store.service';
import { getRelation } from '../../game/diplomacy/diplomacy.service';
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

      const rel = getRelation(store.state, player(), current.owner);
      if (rel.status === 'war') {
        list.push({
          type: 'item',
          label: 'Offer Peace',
          note: '30s Protection',
          onClick: () => {
            const result = store.dispatch({
              type: 'OfferPeace',
              empire: player(),
              target: current.owner,
            });
            if (!result.ok) props.controllers.notice(result.reason);
          },
        });
      } else if (rel.status === 'neutral') {
        list.push({
          type: 'item',
          label: 'Offer Pact',
          note: '90s Non-Aggression',
          onClick: () => {
            const result = store.dispatch({
              type: 'OfferPact',
              empire: player(),
              target: current.owner,
            });
            if (!result.ok) props.controllers.notice(result.reason);
          },
        });
      } else {
        const remaining = Math.max(
          0,
          Math.ceil((rel.expiresAt ?? store.state.elapsed) - store.state.elapsed),
        );
        list.push({
          type: 'item',
          label: 'Diplomacy',
          note: `Protected for ${remaining}s`,
          onClick: () => props.onDiplomacy?.(),
        });
      }

      if (props.onDiplomacy && rel.status !== 'peace' && rel.status !== 'pact' && rel.status !== 'alliance') {
        list.push({
          type: 'item',
          label: 'Diplomacy',
          onClick: () => props.onDiplomacy!(),
        });
      }

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
