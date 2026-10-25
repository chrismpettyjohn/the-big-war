import { civilianGrowthRateOf } from './economy.system';
import type { Empire } from '../../empire/empire.types';
import type { GameState } from '../../state/state.types';
import { deployedTroops } from '../../troops/troops.service';
import { countBuildingsOfKind } from '../../building/building.service';
import { resolveModifier } from '@the-big-war/game-engine/modifier/modifier.service';

export function stepRecruitment(state: GameState, dt: number): void {
  const recruit = state.config.recruit;

  for (const empire of state.empires) {
    if (!empire.alive) {
      empire.civilianBalance = 0;
      empire.troopBalance = 0;
      continue;
    }
    const barracks = countBuildingsOfKind(state, empire.id, 'barracks');
    const cap = reserveCapOf(state, empire);
    empire.reserveCap = cap;

    const speed = barracks > 0 ? Math.max(0, resolveModifier(barracks, empire.bonuses.recruitSpeed)) : 0;

    const targetReserve = cap * recruit.targetReserveRatio;
    const fielded = empire.soldiers + deployedTroops(state, empire.id);
    const draftTarget = Math.min(targetReserve, cap * recruit.draftUntilRatio);
    if (barracks > 0 && fielded < draftTarget) empire.drafting = true;
    if (barracks <= 0 || fielded >= draftTarget || empire.civilians < recruit.civiliansPerSoldier) empire.drafting = false;

    let drafted = 0;
    if (empire.drafting) {
      drafted = Math.min(
        draftTarget - fielded,
        dt / recruit.draftSecondsPerSoldier,
        empire.civilians / recruit.civiliansPerSoldier,
      );
      empire.soldiers += drafted;
      empire.civilians = Math.max(0, empire.civilians - drafted * recruit.civiliansPerSoldier);
    }

    const grown = Math.max(0, civilianGrowthRateOf(empire.id)) * dt;
    const trained = Math.max(
      0,
      Math.min(targetReserve - fielded - drafted, (speed / recruit.secondsPerSoldier) * dt, grown / recruit.civiliansPerSoldier),
    );
    empire.soldiers += trained;
    empire.civilians = Math.max(0, empire.civilians + civilianGrowthRateOf(empire.id) * dt - trained * recruit.civiliansPerSoldier);

    const consumed = (drafted + trained) * recruit.civiliansPerSoldier;
    empire.civilianBalance = civilianGrowthRateOf(empire.id) - consumed / dt;
    empire.troopBalance = (drafted + trained) / dt;
  }
}

export function reserveCapOf(state: GameState, empire: Empire): number {
  const recruit = state.config.recruit;
  const barracks = countBuildingsOfKind(state, empire.id, 'barracks');
  const forts = countBuildingsOfKind(state, empire.id, 'fort');
  const cities = countBuildingsOfKind(state, empire.id, 'city');
  const raw = cities * recruit.cityReserveCap + barracks * recruit.barracksReserveCap + forts * recruit.fortReserveCap;
  return Math.max(
    0,
    Math.floor(
      resolveModifier(raw, empire.bonuses.reserveCap),
    ),
  );
}
