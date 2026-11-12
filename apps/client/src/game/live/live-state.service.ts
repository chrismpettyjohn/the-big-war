import type { HexCell } from '../map/map.types';
import type { UnitKind } from '../unit/unit.types';
import { UNIT_KINDS } from '../unit/unit.constants';
import type { Empire } from '../empire/empire.types';
import type { GameState } from '../state/state.types';
import type { DiplomacyPatch } from '../sim/sim.types';
import { batch, createSignal, untrack } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { mirrorRoster } from '../sim/codecs/units.codec';
import { createKeyedStores } from './keyed-store.service';
import { populationByEmpire } from '../unit/unit.service';
import { createTriggerCache } from './trigger-cache.service';
import type { ProductionQueue, Unit } from '../unit/unit.types';
import type { FrameChanges, MatchFields } from '../sim/sim.types';
import type { LiveSlice, LiveState, UnitCounts } from './live.types';
import { gridInBounds, gridIndex } from '@the-big-war/game-engine/world-tile/world-tile.service';

type Diplomacy = { -readonly [K in keyof DiplomacyPatch]: DiplomacyPatch[K] };

const NO_UNITS: UnitCounts = Object.fromEntries(UNIT_KINDS.map(kind => [kind, 0])) as UnitCounts;

const clone = <T>(value: T): T => (typeof value === 'object' && value !== null ? structuredClone(value) : value);

function matchFields(state: GameState): MatchFields {
  return {
    status: state.status,
    playerEmpire: state.playerEmpire,
    speed: state.speed,
    tick: state.tick,
    elapsed: state.elapsed,
    winner: state.winner,
    endReason: state.endReason,
    landHexCount: state.landHexCount,
    spawnSites: clone(state.spawnSites),
  };
}

function diplomacyOf(state: GameState): Diplomacy {
  return clone({ relations: state.relations, offerCooldowns: state.offerCooldowns, pendingOffers: state.pendingOffers });
}

function countUnits(state: GameState): Record<number, UnitCounts> {
  const counts: Record<number, Record<UnitKind, number>> = {};
  for (const unit of state.units) {
    counts[unit.empire] ??= { ...NO_UNITS };
    counts[unit.empire]![unit.kind] += 1;
  }
  return counts;
}

function populations(state: GameState): Record<number, number> {
  return Object.fromEntries(populationByEmpire(state));
}

export function createLiveState(initial: GameState): LiveState {
  let raw = initial;
  const slices = createTriggerCache<LiveSlice>();
  const tiles = createKeyedStores<number, HexCell>(at => raw.grid.cells[at] ?? null);
  const units = createKeyedStores<number, Unit>(id => mirrorRoster(raw).get(id) ?? null);
  const lines = createKeyedStores<number, ProductionQueue>(building => raw.production.find(line => line.building === building) ?? null);
  const [match, setMatch] = createStore<MatchFields>(matchFields(raw));
  const [empires, setEmpires] = createStore<Empire[]>(clone(raw.empires));
  const [diplomacy, setDiplomacy] = createStore<Diplomacy>(diplomacyOf(raw));
  const [population, setPopulation] = createStore<Record<number, number>>(populations(raw));
  const [counts, setCounts] = createStore<Record<number, UnitCounts>>(countUnits(raw));
  const [paused, setPaused] = createSignal(false);

  const refreshArmies = (): void => {
    setPopulation(reconcile(populations(raw)));
    setCounts(reconcile(countUnits(raw)));
  };

  const view: GameState = {
    get config() {
      slices.track('static');
      return raw.config;
    },
    get map() {
      slices.track('static');
      return raw.map;
    },
    get status() {
      return match.status;
    },
    get playerEmpire() {
      return match.playerEmpire;
    },
    get speed() {
      return match.speed;
    },
    get tick() {
      return match.tick;
    },
    get elapsed() {
      return match.elapsed;
    },
    get winner() {
      return match.winner;
    },
    get endReason() {
      return match.endReason;
    },
    get landHexCount() {
      return match.landHexCount;
    },
    get spawnSites() {
      return match.spawnSites as GameState['spawnSites'];
    },
    get empires() {
      return empires;
    },
    get relations() {
      return diplomacy.relations;
    },
    get offerCooldowns() {
      return diplomacy.offerCooldowns;
    },
    get pendingOffers() {
      return diplomacy.pendingOffers as GameState['pendingOffers'];
    },
    get grid() {
      slices.track('grid');
      return raw.grid;
    },
    get index() {
      slices.track('grid');
      return raw.index;
    },
    get units() {
      slices.track('units');
      return raw.units;
    },
    get production() {
      slices.track('production');
      return raw.production;
    },
    get ships() {
      slices.track('ships');
      return raw.ships;
    },
    get shipHash() {
      slices.track('ships');
      return raw.shipHash;
    },
    get walkers() {
      slices.track('walkers');
      return raw.walkers;
    },
    get unitEvents() {
      slices.track('events');
      return raw.unitEvents;
    },
    get rng() {
      return raw.rng;
    },
    get tradeClock() {
      return raw.tradeClock;
    },
    get agentAccumulator() {
      return raw.agentAccumulator;
    },
    get nextShipId() {
      return raw.nextShipId;
    },
    get nextUnitId() {
      return raw.nextUnitId;
    },
    get nextUnitEventId() {
      return raw.nextUnitEventId;
    },
    get nextBuildingId() {
      return raw.nextBuildingId;
    },
  } as GameState;

  const cell = (at: number): HexCell | null => tiles.get(at);

  return {
    view,
    get raw() {
      return raw;
    },
    paused,
    setPaused,
    cell,
    cellAt(hex) {
      if (!hex) return null;
      slices.track('static');
      if (!gridInBounds(raw.grid, hex.q, hex.r)) return null;
      return cell(gridIndex(raw.grid, hex.q, hex.r));
    },
    productionFor(building) {
      return lines.get(building);
    },
    unit(id) {
      return units.get(id);
    },
    roster() {
      slices.track('roster');
      return raw.units;
    },
    population(empire) {
      return population[empire] ?? 0;
    },
    unitCounts(empire) {
      return counts[empire] ?? NO_UNITS;
    },
    load(state) {
      raw = state;
      untrack(() =>
        batch(() => {
          setMatch(reconcile(matchFields(raw)));
          setEmpires(reconcile(clone(raw.empires)));
          setDiplomacy(reconcile(diplomacyOf(raw)));
          refreshArmies();
          slices.dirtyAll();
          tiles.dirtyAll();
          lines.dirtyAll();
          units.dirtyAll();
        }),
      );
    },
    apply(changes: FrameChanges) {
      untrack(() =>
        batch(() => {
          for (const field of changes.fields) {
            const value = raw[field];
            (setMatch as (key: keyof MatchFields, next: unknown) => void)(field, typeof value === "object" && value !== null ? reconcile(clone(value)) : value);
          }
          for (const at of changes.empires) setEmpires(at, reconcile(clone(raw.empires[at]!)));
          if (changes.diplomacy) setDiplomacy(reconcile(diplomacyOf(raw)));
          if (changes.tiles.size > 0 || changes.buildings.size > 0) {
            slices.dirty('grid');
            for (const at of changes.tiles) tiles.dirty(at);
            for (const at of changes.buildings) tiles.dirty(at);
          }
          if (changes.production.size > 0) {
            slices.dirty('production');
            for (const building of changes.production) lines.dirty(building);
          }
          if (changes.units) slices.dirty('units');
          for (const id of changes.unitIds) units.dirty(id);
          if (changes.unitRoster) slices.dirty('roster');
          if (changes.ships) slices.dirty('ships');
          if (changes.walkers) slices.dirty('walkers');
          if (changes.unitEvents) slices.dirty('events');
          if (changes.unitRoster || changes.ships || changes.production.size > 0) refreshArmies();
        }),
      );
    },
  };
}
