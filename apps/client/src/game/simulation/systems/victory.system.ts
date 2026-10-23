import type { EmpireId } from '../../empire/empire.types';
import type { EndReason, GameState } from '../../state/state.types';

export function checkWinConditions(state: GameState): void {
  if (state.status !== 'playing') return;

  const contenders = state.empires.filter(empire => !empire.neutralState);
  const alive = contenders.filter(empire => empire.alive);
  if (contenders.length > 1 && alive.length <= 1) endMatch(state, alive[0]?.id ?? null, 'elimination');
}

function endMatch(state: GameState, winner: EmpireId | null, reason: EndReason): void {
  state.status = 'ended';
  state.winner = winner;
  state.endReason = reason;
}
