import type { Bot } from './bot.types';
import { BOT_TUNING } from './bot.constants';
import type { GameState } from '../state/state.types';
import type { Command } from '../commands/commands.types';
import type { Empire, EmpireId } from '../empire/empire.types';
import { chance } from '@the-big-war/game-engine/rng/rng.service';
import { borderingEmpires, effectiveAggression, troopsOnFrontsAgainst } from './bot-queries.service';
import { getRelation, isProtected, offerCooldown, pendingOffer } from '../diplomacy/diplomacy.service';

function canOfferPeace(bot: Bot, state: GameState, target: EmpireId): boolean {
  return !offerCooldown(state, bot.empire, target) && !pendingOffer(state, bot.empire, target);
}

function warTarget(bot: Bot, state: GameState, empire: Empire, aggression: number, atWar: boolean): EmpireId | null {
  if (aggression < BOT_TUNING.warAggressionFloor) return null;
  if (atWar && aggression < BOT_TUNING.multiFrontAggression) return null;
  if (!chance(bot.rng, aggression * aggression * BOT_TUNING.warChancePerSecond * state.config.bot.tickSeconds)) return null;

  const ourStrength = empire.soldiers + empire.hexCount;
  const required = BOT_TUNING.warSuperiorityBase - aggression;
  let best: EmpireId | null = null;
  let bestStrength = Infinity;
  for (const id of borderingEmpires(state, bot.empire)) {
    const other = state.empires[id];
    if (!other || !other.alive) continue;
    if (getRelation(state, bot.empire, id).status === 'war' || isProtected(state, bot.empire, id)) continue;
    const strength = other.soldiers + other.hexCount;
    if (ourStrength < strength * required || strength >= bestStrength) continue;
    best = id;
    bestStrength = strength;
  }
  return best;
}

export function evaluateDiplomacy(bot: Bot, state: GameState, empire: Empire): Command | null {
  let atWar = false;
  for (const other of state.empires) {
    if (other.id === bot.empire || !other.alive) continue;
    if (getRelation(state, bot.empire, other.id).status !== 'war') continue;
    atWar = true;
    const ourFront = troopsOnFrontsAgainst(state, bot.empire, other.id);
    const enemyFront = troopsOnFrontsAgainst(state, other.id, bot.empire);
    const ourTotal = empire.soldiers + ourFront;
    const enemyTotal = other.soldiers + enemyFront;
    const outnumbered =
      enemyTotal > ourTotal * 1.3 ||
      (ourFront > 0 && enemyFront > ourFront * 1.5) ||
      (empire.soldiers < empire.reserveCap * 0.25 && enemyTotal > ourTotal);
    if (outnumbered && canOfferPeace(bot, state, other.id)) {
      return { type: 'OfferPeace', empire: bot.empire, target: other.id };
    }
  }

  if (empire.neutralState) return null;

  const target = warTarget(bot, state, empire, effectiveAggression(bot, state), atWar);
  return target === null ? null : { type: 'DeclareWar', empire: bot.empire, target };
}
