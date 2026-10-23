import type { Bot } from './bot.types';
import type { Empire } from '../empire/empire.types';
import type { GameState } from '../state/state.types';
import type { Command } from '../commands/commands.types';
import { troopsOnFrontsAgainst } from './bot-queries.service';
import { getRelation, offerCooldown } from '../diplomacy/diplomacy.service';

export function evaluateDiplomacy(bot: Bot, state: GameState, empire: Empire): Command | null {

  for (const other of state.empires) {
    if (other.id === bot.empire || !other.alive) continue;
    const rel = getRelation(state, bot.empire, other.id);
    if (rel.status === 'war') {
      const ourFront = troopsOnFrontsAgainst(state, bot.empire, other.id);
      const enemyFront = troopsOnFrontsAgainst(state, other.id, bot.empire);
      const ourTotal = empire.soldiers + ourFront;
      const enemyTotal = other.soldiers + enemyFront;
      const outnumbered =
        enemyTotal > ourTotal * 1.3 ||
        (ourFront > 0 && enemyFront > ourFront * 1.5) ||
        (empire.soldiers < empire.reserveCap * 0.25 && enemyTotal > ourTotal);
      if (outnumbered && !offerCooldown(state, bot.empire, other.id, 'peace')) {
        return { type: 'OfferPeace', empire: bot.empire, target: other.id };
      }
    }
  }

  if (empire.neutralState) return null;

  let atWarElsewhere = false;
  for (const other of state.empires) {
    if (other.id === bot.empire || !other.alive) continue;
    if (getRelation(state, bot.empire, other.id).status === 'war') {
      atWarElsewhere = true;
      break;
    }
  }

  for (const other of state.empires) {
    if (other.id === bot.empire || !other.alive) continue;
    const rel = getRelation(state, bot.empire, other.id);
    if (rel.status !== 'neutral') continue;
    if (offerCooldown(state, bot.empire, other.id, 'pact')) continue;

    const enemyPressure = troopsOnFrontsAgainst(state, other.id, bot.empire);
    const lowPressure = enemyPressure <= 5;
    const wantsPact =
      atWarElsewhere ||
      (lowPressure && (bot.personality.economy >= 0.4 || bot.personality.aggression < 0.75));

    if (wantsPact) {
      return { type: 'OfferPact', empire: bot.empire, target: other.id };
    }
  }

  return null;
}

