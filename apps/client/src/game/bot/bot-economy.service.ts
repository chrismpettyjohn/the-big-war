import type { Bot } from './bot.types';
import { BOT_TUNING } from './bot.constants';
import type { Empire } from '../empire/empire.types';
import type { GameState } from '../state/state.types';
import type { Command } from '../commands/commands.types';
import type { BuildingKind } from '../building/building.types';
import type { ResearchNode } from '../research/research.types';
import { RESEARCH_NODES } from '../research/research.constants';
import { findCannonShot, findSite } from './bot-queries.service';
import { meetsRequirements } from '../research/research.service';
import { chance } from '@the-big-war/game-engine/rng/rng.service';

const ECONOMY_PLAN: readonly BuildingKind[] = ['market', 'farm', 'lumberjack', 'miner', 'lab', 'city'];

const MILITARY_PLAN: readonly BuildingKind[] = [
  'barracks',
  'fort',
  'cannon',
  'machine_gun',
  'market',
  'farm',
  'city',
];

export function pickResearch(bot: Bot, empire: Empire): ResearchNode | null {
  if (empire.research.active) return null;
  const available = RESEARCH_NODES.filter(
    node =>
      !empire.research.completed.includes(node.id) &&
      meetsRequirements(empire.research, node) &&
      empire.science >= node.cost,
  );
  if (available.length === 0) return null;

  available.sort((a, b) => {
    const prioA = (a.branch === 'military' ? bot.personality.aggression : bot.personality.economy) * 100 - a.cost;
    const prioB = (b.branch === 'military' ? bot.personality.aggression : bot.personality.economy) * 100 - b.cost;
    return prioB - prioA;
  });
  return available[0] ?? null;
}

export function researchCommand(bot: Bot, empire: Empire): Command | null {
  const node = pickResearch(bot, empire);
  if (!node) return null;
  const optionId =
    node.kind === 'choice' && node.options && node.options.length > 0
      ? node.options[bot.empire % node.options.length]!.id
      : undefined;
  return optionId
    ? { type: 'StartResearch', empire: bot.empire, nodeId: node.id, optionId }
    : { type: 'StartResearch', empire: bot.empire, nodeId: node.id };
}

export function constructionCommands(bot: Bot, state: GameState, empire: Empire): Command[] {
  const commands: Command[] = [];
  const plan = bot.personality.economy >= bot.personality.aggression ? ECONOMY_PLAN : MILITARY_PLAN;
  for (const kind of plan) {
    const spec = state.config.buildings[kind];
    if (!spec) continue;
    if (empire.gold < spec.cost) continue;
    const site = findSite(state, bot.empire, kind);
    if (!site) continue;
    commands.push({ type: 'PlaceBuilding', empire: bot.empire, hex: site, kind });
    break;
  }

  if (
    empire.gold > state.config.buildings.barracks.cost * 2 &&
    chance(bot.rng, BOT_TUNING.militaryBuildChance * (1 - bot.personality.economy))
  ) {
    const site = findSite(state, bot.empire, 'barracks');
    if (site) commands.push({ type: 'PlaceBuilding', empire: bot.empire, hex: site, kind: 'barracks' });
  }
  return commands;
}

export function cannonCommand(bot: Bot, state: GameState, empire: Empire): Command | null {
  if (!chance(bot.rng, BOT_TUNING.cannonFireChance)) return null;
  const shot = findCannonShot(state, bot.empire);
  if (!shot || empire.gold < state.config.cannon.cost) return null;
  return { type: 'FireCannon', empire: bot.empire, from: shot.from, target: shot.target };
}
