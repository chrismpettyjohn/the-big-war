/**
 * Data-driven research: schema helpers + the initial node set.
 *
 * The research panel in `src/ui` renders entirely from `RESEARCH_NODES` — it
 * must not hardcode node ids. Node kinds (`modifier`, `unlock`, `choice`) are
 * open-ended so expensive future options (unique unit types / armies) can be
 * added as new node/effect data without redesigning the panel or the state:
 * add a node with `kind: 'choice'` (or a new kind + effect shape) and the panel
 * falls back to rendering `options`/`effects`.
 *
 * Rules:
 * - Science cost is paid up-front by `StartResearch` (commands.ts).
 * - One active research per empire; progress is a0..1 ratio advanced by
 *   engine stage2; completion is applied by `completeResearch` below.
 * - Effects fold into `Empire.bonuses` via `recomputeEmpireBonuses`.
 */

import { FACTIONS, aggregateModifiers } from './config';
import type {
  Empire,
  EmpireId,
  EmpireResearch,
  GameState,
  Modifier,
  ResearchNode,
  ResearchOption,
} from './types';

/* ------------------------------------------------------------ nodes ---- */

/**
 * The v1 tree (12 nodes). Economy/military/territory branches; costs and
 * durations in game seconds; `position` drives the panel grid. All numbers are
 * starting-point tuning — the gameplay owner tunes them here.
 */
export const RESEARCH_NODES: readonly ResearchNode[] = [
  /* economy */
  {
    id: 'market_guilds',
    name: 'Market Guilds',
    description: 'Traders organise: +15% gold income.',
    kind: 'modifier',
    branch: 'economy',
    cost: 40,
    duration: 20,
    requires: [],
    position: { col: 0, row: 0 },
    effects: [{ kind: 'modifier', modifiers: [{ key: 'goldIncome', mul: 1.15, label: 'Market Guilds' }] }],
  },
  {
    id: 'logging',
    name: 'Logging Industry',
    description: 'Efficient timber: buildings15% cheaper, +5% gold.',
    kind: 'modifier',
    branch: 'economy',
    cost: 50,
    duration: 25,
    requires: ['market_guilds'],
    position: { col: 1, row: 0 },
    effects: [
      {
        kind: 'modifier',
        modifiers: [
          { key: 'buildCost', mul: 0.85, label: 'Logging Industry' },
          { key: 'goldIncome', mul: 1.05, label: 'Logging Industry' },
        ],
      },
    ],
  },
  {
    id: 'deep_mining',
    name: 'Deep Mining',
    description: 'Miners harden the army: +5% attack and defence.',
    kind: 'modifier',
    branch: 'economy',
    cost: 50,
    duration: 25,
    requires: ['market_guilds'],
    position: { col: 1, row: 1 },
    effects: [
      {
        kind: 'modifier',
        modifiers: [
          { key: 'attack', mul: 1.05, label: 'Deep Mining' },
          { key: 'defence', mul: 1.05, label: 'Deep Mining' },
        ],
      },
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    description: 'Better harvests: +25% civilian growth.',
    kind: 'modifier',
    branch: 'economy',
    cost: 40,
    duration: 20,
    requires: [],
    position: { col: 0, row: 1 },
    effects: [{ kind: 'modifier', modifiers: [{ key: 'growth', mul: 1.25, label: 'Agriculture' }] }],
  },
  {
    id: 'scientific_method',
    name: 'Scientific Method',
    description: 'Labs run hotter: +35% science.',
    kind: 'modifier',
    branch: 'economy',
    cost: 60,
    duration: 30,
    requires: ['market_guilds'],
    position: { col: 2, row: 0 },
    effects: [{ kind: 'modifier', modifiers: [{ key: 'scienceRate', mul: 1.35, label: 'Scientific Method' }] }],
  },

  /* military */
  {
    id: 'drill',
    name: 'Drill',
    description: 'Disciplined ranks: +10% attack.',
    kind: 'modifier',
    branch: 'military',
    cost: 40,
    duration: 20,
    requires: [],
    position: { col: 0, row: 0 },
    effects: [{ kind: 'modifier', modifiers: [{ key: 'attack', mul: 1.1, label: 'Drill' }] }],
  },
  {
    id: 'fortification',
    name: 'Fortification',
    description: 'Field works: +15% defence on fronts.',
    kind: 'modifier',
    branch: 'military',
    cost: 40,
    duration: 25,
    requires: [],
    position: { col: 0, row: 1 },
    effects: [{ kind: 'modifier', modifiers: [{ key: 'frontDefence', mul: 1.15, label: 'Fortification' }] }],
  },
  {
    id: 'conscription',
    name: 'Conscription',
    description: 'Bigger armies: +20% reserve cap and recruitment speed.',
    kind: 'modifier',
    branch: 'military',
    cost: 50,
    duration: 25,
    requires: ['drill'],
    position: { col: 1, row: 0 },
    effects: [
      {
        kind: 'modifier',
        modifiers: [
          { key: 'reserveCap', mul: 1.2, label: 'Conscription' },
          { key: 'recruitSpeed', mul: 1.2, label: 'Conscription' },
        ],
      },
    ],
  },
  {
    id: 'artillery',
    name: 'Artillery',
    description: 'Unlocks the cannon building.',
    kind: 'unlock',
    branch: 'military',
    cost: 80,
    duration: 40,
    requires: ['drill'],
    position: { col: 1, row: 1 },
    effects: [{ kind: 'unlock', key: 'building:cannon', label: 'Cannon' }],
  },

  /* territory */
  {
    id: 'surveying',
    name: 'Surveying',
    description: 'Charted lands: cheaper buildings, +5% gold.',
    kind: 'modifier',
    branch: 'territory',
    cost: 40,
    duration: 20,
    requires: [],
    position: { col: 0, row: 0 },
    effects: [
      {
        kind: 'modifier',
        modifiers: [
          { key: 'buildCost', mul: 0.9, label: 'Surveying' },
          { key: 'goldIncome', mul: 1.05, label: 'Surveying' },
        ],
      },
    ],
  },
  {
    id: 'urban_planning',
    name: 'Urban Planning',
    description: 'Cities house and feed more: +15% reserve cap, +10% growth.',
    kind: 'modifier',
    branch: 'territory',
    cost: 60,
    duration: 30,
    requires: ['surveying'],
    position: { col: 1, row: 0 },
    effects: [
      {
        kind: 'modifier',
        modifiers: [
          { key: 'reserveCap', mul: 1.15, label: 'Urban Planning' },
          { key: 'growth', mul: 1.1, label: 'Urban Planning' },
        ],
      },
    ],
  },

  /* grand choice — exercises the `choice` kind; unique-army nodes can follow the same shape */
  {
    id: 'grand_strategy',
    name: 'Grand Strategy',
    description: 'Commit the war economy to one doctrine (choose one).',
    kind: 'choice',
    branch: 'military',
    cost: 100,
    duration: 50,
    requires: ['conscription'],
    position: { col: 2, row: 0 },
    effects: [],
    options: [
      {
        id: 'blitz',
        name: 'Blitz',
        description: 'All-out offense: +20% attack, −10% defence.',
        effects: [
          {
            kind: 'modifier',
            modifiers: [
              { key: 'attack', mul: 1.2, label: 'Blitz' },
              { key: 'defence', mul: 0.9, label: 'Blitz' },
            ],
          },
        ],
      },
      {
        id: 'bulwark',
        name: 'Bulwark',
        description: 'Hold everything: +20% defence, −10% attack.',
        effects: [
          {
            kind: 'modifier',
            modifiers: [
              { key: 'defence', mul: 1.2, label: 'Bulwark' },
              { key: 'attack', mul: 0.9, label: 'Bulwark' },
            ],
          },
        ],
      },
      {
        id: 'war_economy',
        name: 'War Economy',
        description: 'Fund the fight: +25% gold, −5% attack.',
        effects: [
          {
            kind: 'modifier',
            modifiers: [
              { key: 'goldIncome', mul: 1.25, label: 'War Economy' },
              { key: 'attack', mul: 0.95, label: 'War Economy' },
            ],
          },
        ],
      },
    ],
  },
];

/** Id → node lookup, built once. */
export const RESEARCH_BY_ID: ReadonlyMap<string, ResearchNode> = new Map(
  RESEARCH_NODES.map(node => [node.id, node]),
);

/* --------------------------------------------------------- helpers ---- */

/** Node by id, or undefined. */
export function researchNode(id: string): ResearchNode | undefined {
  return RESEARCH_BY_ID.get(id);
}

/** True when the node is completed. */
export function isComplete(research: EmpireResearch, nodeId: string): boolean {
  return research.completed.includes(nodeId);
}

/** Ids of unmet prerequisites (empty when requirements are met). */
export function missingRequirements(research: EmpireResearch, node: ResearchNode): string[] {
  return node.requires.filter(req => !isComplete(research, req));
}

/** Convenience: are all prerequisites met? */
export function meetsRequirements(research: EmpireResearch, node: ResearchNode): boolean {
  return missingRequirements(research, node).length === 0;
}

/** The chosen option of a `choice` node, or undefined. */
export function chosenOption(research: EmpireResearch, node: ResearchNode): ResearchOption | undefined {
  const optionId = research.chosen[node.id];
  if (!optionId || !node.options) return undefined;
  return node.options.find(option => option.id === optionId);
}

/** All modifiers currently granted by research (completed nodes + chosen options). */
export function researchModifiers(research: EmpireResearch): Modifier[] {
  const modifiers: Modifier[] = [];
  for (const nodeId of research.completed) {
    const node = RESEARCH_BY_ID.get(nodeId);
    if (!node) continue;
    for (const effect of node.effects) {
      if (effect.kind === 'modifier') modifiers.push(...effect.modifiers);
    }
    const option = chosenOption(research, node);
    if (option) {
      for (const effect of option.effects) {
        if (effect.kind === 'modifier') modifiers.push(...effect.modifiers);
      }
    }
  }
  return modifiers;
}

/**
 * Recompute `empire.bonuses` = faction modifiers + completed research modifiers.
 * Call after SelectFaction, research completion, or any state rebuild. Building
 * and terrain bonuses are contextual (support radii, placement) and are
 * computed at point of use in the engine — they do not live here.
 */
export function recomputeEmpireBonuses(state: GameState, empireId: EmpireId): void {
  const empire = state.empires[empireId];
  if (!empire) return;
  const faction = FACTIONS.find(f => f.id === empire.factionId);
  const modifiers: Modifier[] = [
    ...(faction?.bonuses ?? []),
    ...researchModifiers(empire.research),
  ];
  empire.bonuses = aggregateModifiers(modifiers);
}

/**
 * Complete whatever research `empire` has in flight: mark completed, record the
 * chosen option, append unlock keys, refresh bonuses, clear the active slot.
 * Called by engine stage2 when progress reaches1. No-op when nothing is active.
 */
export function completeResearch(state: GameState, empireId: EmpireId): void {
  const empire = state.empires[empireId];
  if (!empire) return;
  const active = empire.research.active;
  if (!active) return;
  const node = RESEARCH_BY_ID.get(active.nodeId);
  if (!node) return;
  empire.research.completed.push(node.id);
  if (active.optionId !== null) empire.research.chosen[node.id] = active.optionId;
  for (const effect of node.effects) {
    if (effect.kind === 'unlock') empire.unlocks.push(effect.key);
  }
  const option = chosenOption(empire.research, node);
  if (option) {
    for (const effect of option.effects) {
      if (effect.kind === 'unlock') empire.unlocks.push(effect.key);
    }
  }
  empire.research.active = null;
  recomputeEmpireBonuses(state, empireId);
}

/** Does the empire have the given unlock key (e.g. "building:cannon")? */
export function hasUnlock(empire: Empire, key: string): boolean {
  return empire.unlocks.includes(key);
}
