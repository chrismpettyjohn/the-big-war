/**
 * Map context menu — the right-click / long-press quick actions on a hex.
 *
 * Uses the design kit's `nitro-context-menu` (the same component the rail uses
 * for hover hints), anchored at the pointer. Entries adapt to the target:
 * attack, hold/defend on an existing front, inspect, cannon fire, demolish.
 */

import { Show } from 'solid-js';
import { gridAt, neighbors } from '../game/hex';
import { gameStore } from '../game/store';
import type { Front } from '../game/types';
import { t } from '../i18n';
import { ContextMenu, type MenuEntry } from '../ui/kit/ContextMenu';
import type { Controllers } from '../session/controllers';
import { terrainLabel } from '../ui/text';

export interface MapMenuProps {
  readonly controllers: Controllers;
  readonly onInspect: () => void;
  readonly onArmy: () => void;
  readonly onBuild: () => void;
}

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
    return !!current && current.owner !== player() && current.owner >= 0 && current.terrain !== 'water';
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
      list.push({
        type: 'item',
        label: `${t('panel.army.attack')} (${props.controllers.troopPercent()}%)`,
        disabled: !attackFrom() || store.state.empires[player()]!.soldiers <= 0,
        note: attackFrom() ? undefined : t('error.invalid_target'),
        onClick: () => send('attack'),
      });
      list.push({
        type: 'item',
        label: t('panel.army.hold'),
        disabled: !attackFrom() || store.state.empires[player()]!.soldiers <= 0,
        onClick: () => send('defence'),
      });
      list.push({ type: 'divider' });
    }

    list.push({
      type: 'item',
      label: t('panel.hex.title'),
      onClick: () => props.onInspect(),
    });

    if (isOwn()) {
      list.push({ type: 'item', label: t('panel.build.title'), onClick: () => props.onBuild() });
      if (current.building?.kind === 'cannon' && current.building.cooldown <= 0) {
        list.push({
          type: 'item',
          label: `${t('panel.hex.fire')} · ${store.state.config.cannon.cost}`,
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
          label: t('panel.hex.demolish'),
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
    list.push({ type: 'item', label: t('panel.army.title'), onClick: () => props.onArmy() });

    if (front()) {
      list.push({
        type: 'item',
        label: t('front.title'),
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
