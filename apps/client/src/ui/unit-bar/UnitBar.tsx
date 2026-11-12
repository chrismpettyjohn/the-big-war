import './UnitBar.css';
import { createMemo, For, Show } from 'solid-js';
import type { UnitBarProps } from './UnitBar.types';
import { gameStore } from '../../game/store/store.service';
import type { UnitKind } from '../../game/unit/unit.types';
import { populationCap } from '../../game/unit/unit.service';
import { UNIT_KINDS, UNIT_STATS } from '../../game/unit/unit.constants';

export type { UnitBarProps };

export const UnitBar = (props: UnitBarProps) => {
  const store = gameStore();
  const units = () => props.controllers.units;
  const player = () => store.state.playerEmpire;
  const counts = createMemo(() => {
    const selected = units().selected();
    const tally = new Map<UnitKind, number>();
    for (const unit of store.live.roster()) {
      if (selected.has(unit.id)) tally.set(unit.kind, (tally.get(unit.kind) ?? 0) + 1);
    }
    return UNIT_KINDS.filter(kind => tally.has(kind)).map(kind => ({ kind, count: tally.get(kind)! }));
  });
  const population = () => `${store.live.population(player())}/${populationCap(store.state, player())}`;
  const ownUnits = () => Object.values(store.live.unitCounts(player())).some(count => count > 0);

  return (
    <Show when={ownUnits() || counts().length > 0}>
      <div class="unit-bar kit-glass">
        <span class="unit-bar-pop" title="Units and units in training / unit limit">
          Units {population()}
        </span>
        <For each={counts()}>
          {entry => (
            <button
              type="button"
              class="unit-bar-chip"
              title={`${UNIT_STATS[entry.kind].name}: press ${UNIT_STATS[entry.kind].hotkey} to select all`}
              onClick={() => units().selectKind(entry.kind, false)}
            >
              <kbd>{UNIT_STATS[entry.kind].hotkey}</kbd> {UNIT_STATS[entry.kind].name} × {entry.count}
            </button>
          )}
        </For>
        <Show when={counts().length > 0}>
          <span class="unit-bar-hint">Click ground to attack-move · right-click for orders · F to find</span>
        </Show>
      </div>
    </Show>
  );
};
