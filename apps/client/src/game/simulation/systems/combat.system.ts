import type { Front } from '../../front/front.types';
import { ENGINE_TUNING } from '../simulation.constants';
import type { GameState } from '../../state/state.types';
import type { EmpireId } from '../../empire/empire.types';
import { terrainDefenceAt } from '../../map/terrain.service';
import { buildFrontContext } from '../combat/front-context.service';
import { assignFrontClusters } from '../combat/front-clusters.service';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import { gridAt, neighbors } from '@the-big-war/game-engine/world-tile/world-tile.service';

export function stepCombat(state: GameState, dt: number): void {
  const combat = state.config.combat;

  assignFrontClusters(state);

  for (const front of state.fronts) {

    const context = buildFrontContext(state, front);
    if (!context) continue;

    const { sideA, sideB, terrainDefenceA, terrainDefenceB } = context;

    front.sideA.modifiers = { attack: sideA.attack, defence: sideA.defence, lines: sideA.lines };
    front.sideB.modifiers = { attack: sideB.attack, defence: sideB.defence, lines: sideB.lines };
    const troopsA = front.sideA.troops;
    const troopsB = front.sideB.troops;
    if (troopsA <= 0 && troopsB <= 0) {
      front.resolution = { at: state.elapsed, lossesA: 0, lossesB: 0, capturedBy: null };
      continue;
    }
    if (!context.attackerA && !context.attackerB) {
      
      front.resolution = { at: state.elapsed, lossesA: 0, lossesB: 0, capturedBy: null };
      continue;
    }

    const pressureA = pressureOf(troopsA, sideA.attack, troopsB, sideB.defence, terrainDefenceB);
    const pressureB = pressureOf(troopsB, sideB.attack, troopsA, sideA.defence, terrainDefenceA);

    let lossesA = 0;
    let lossesB = 0;
    if (context.attackerA) lossesB += pressureA * combat.baseLossesPerSecond * dt;
    if (context.attackerB) lossesA += pressureB * combat.baseLossesPerSecond * dt;

    if (!context.attackerB && context.attackerA) {
      lossesA += pressureB * combat.baseLossesPerSecond * dt * ENGINE_TUNING.holdingFireShare;
    }
    if (!context.attackerA && context.attackerB) {
      lossesB += pressureA * combat.baseLossesPerSecond * dt * ENGINE_TUNING.holdingFireShare;
    }

    const remainingA = Math.max(0, troopsA - lossesA);
    const remainingB = Math.max(0, troopsB - lossesB);

    const collapseA = remainingA <= 0 && troopsA > 0;
    const collapseB = remainingB <= 0 && troopsB > 0;
    const overwhelmingA = context.attackerA && pressureA > pressureB * ENGINE_TUNING.capturePressureRatio;
    const overwhelmingB = context.attackerB && pressureB > pressureA * ENGINE_TUNING.capturePressureRatio;

    let capturedBy: EmpireId | null = null;
    let winning: EmpireId | null = null;
    if (context.attackerA && (collapseB || overwhelmingA) && remainingA > 0) winning = front.sideA.empire;
    else if (context.attackerB && (collapseA || overwhelmingB) && remainingB > 0) winning = front.sideB.empire;
    else if (collapseA && collapseB) {
      winning = pressureA >= pressureB ? front.sideA.empire : front.sideB.empire;
    }

    front.sideA.troops = remainingA;
    front.sideB.troops = remainingB;

    if (winning !== null) {
      if (!front.capture || front.capture.by !== winning) {
        const targetHex = front.sideA.empire === winning ? front.hexB : front.hexA;
        const duration = ENGINE_TUNING.captureSeconds * terrainDefenceAt(state, targetHex);
        front.capture = { by: winning, progress: 0, duration };
      }
      front.capture.progress += dt;
      if (front.capture.progress >= front.capture.duration) capturedBy = winning;
    } else if (front.capture) {
      front.capture.progress -= dt * ENGINE_TUNING.captureDecayRate;
      if (front.capture.progress <= 0) front.capture = null;
    }
    front.resolution = { at: state.elapsed, lossesA, lossesB, capturedBy };

    if (capturedBy !== null) {
      front.capture = null;
      captureHex(state, front, capturedBy);
    }
    if (context.attackerA || context.attackerB) front.lastAttackAt = state.elapsed;
  }
}

function pressureOf(
  attackerTroops: number,
  attack: number,
  defenderTroops: number,
  defence: number,
  terrainDefence: number,
): number {
  if (attackerTroops <= 0) return 0;
  const denominator = Math.max(defenderTroops, 0.0001) * defence * terrainDefence;
  return (attackerTroops * attack) / Math.max(denominator, 0.0001);
}

function captureHex(state: GameState, front: Front, capturedBy: EmpireId): void {
  const defenderId = front.sideA.empire === capturedBy ? front.sideB.empire : front.sideA.empire;
  const targetHex = front.sideA.empire === defenderId ? front.hexA : front.hexB;
  const cell = gridAt(state.grid, targetHex);
  if (!cell || cell.owner !== defenderId) return;
  cell.owner = capturedBy;

  if (cell.building && (cell.building.kind === 'cannon' || cell.building.kind === 'battery')) {
    cell.building.cooldown = 0;
  }
  if (cell.building) cell.building.demolishAt = null;
  else advanceTank(state, targetHex, capturedBy);

  if (front.sideA.empire === defenderId) front.sideA.troops = 0;
  else front.sideB.troops = 0;
}


function advanceTank(state: GameState, hex: Axial, owner: EmpireId): void {
  const cell = gridAt(state.grid, hex);
  if (!cell || cell.terrain !== 'plain') return;
  for (const neighbour of neighbors(hex)) {
    const from = gridAt(state.grid, neighbour);
    const tank = from?.building;
    if (!from || from.owner !== owner || tank?.kind !== 'tank') continue;
    if (tank.buildRemaining > 0 || tank.demolishAt !== null) continue;
    cell.building = tank;
    from.building = null;
    return;
  }
}
