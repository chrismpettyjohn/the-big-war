import { civilianGrowthRateOf } from './economy.system';
import { ENGINE_TUNING } from '../simulation.constants';
import type { GameState } from '../../state/state.types';
import { deployedTroops } from '../../troops/troops.service';
import { countBuildingsOfKind } from '../../building/building.service';
import { resolveModifier } from '@the-big-war/game-engine/modifier/modifier.service';

export function stepRecruitment(state: GameState, dt: number): void {
  const recruit = state.config.recruit;

  for (const empire of state.empires) {
    if (!empire.alive) {
      empire.civilianBalance = 0;
      continue;
    }
    const barracks = countBuildingsOfKind(state, empire.id, 'barracks');
    const forts = countBuildingsOfKind(state, empire.id, 'fort');
    const cap = Math.max(
      0,
      Math.floor(
        resolveModifier(recruit.baseReserveCap + barracks * recruit.barracksReserveCap, empire.bonuses.reserveCap),
      ),
    );
    empire.reserveCap = cap;

    const structureBonus =
      1 + barracks * ENGINE_TUNING.barracksRecruitBonusPer + forts * ENGINE_TUNING.fortRecruitBonusPer;
    const speed = Math.max(0, resolveModifier(structureBonus, empire.bonuses.recruitSpeed));

    const targetReserve = cap * recruit.targetReserveRatio;
    const fielded = empire.soldiers + deployedTroops(state, empire.id);
    let consumed = 0;
    if (fielded < targetReserve && empire.civilians >= 1) {
      const ratePerSecond = (1 / recruit.secondsPerSoldier) * speed;
      const wantSoldiers = Math.min(
        targetReserve - fielded,
        ratePerSecond * dt,
        empire.civilians / recruit.civiliansPerSoldier,
      );
      if (wantSoldiers > 0) {
        empire.soldiers += wantSoldiers;
        consumed = wantSoldiers * recruit.civiliansPerSoldier;
        empire.civilians = Math.max(0, empire.civilians - consumed);
      }
    }

    empire.civilianBalance = civilianGrowthRateOf(empire.id) - consumed / dt;
  }
}
