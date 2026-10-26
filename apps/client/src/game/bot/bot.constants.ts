import type { BotPersonality } from './bot.types';

export const BOT_PERSONALITIES: readonly BotPersonality[] = [
  { aggression: 0.3, economy: 0.7, expansion: 0.5 },
  { aggression: 0.6, economy: 0.4, expansion: 0.5 },
  { aggression: 0.85, economy: 0.2, expansion: 0.7 },
  { aggression: 0.5, economy: 0.5, expansion: 0.3 },
];

export const BOT_TUNING = {
  researchScienceFloor: 50,
  reserveFloorRatio: 0.25,
  militaryBuildChance: 0.5,
  trenchTarget: 4,
  trenchManPercent: 30,
  cannonFireChance: 0.7,
  attackSuperiority: 1.1,
  defenceThreshold: 0.8,
  warAggressionFloor: 0.4,
  warChancePerSecond: 0.06,
  warSuperiorityBase: 1.6,
  multiFrontAggression: 0.85,
};
