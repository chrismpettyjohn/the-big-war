import type { GameState } from '../../state/state.types';
import { ok, fail } from '@the-big-war/game-engine/commands/command.service';
import { gridAt } from '@the-big-war/game-engine/world-tile/world-tile.service';
import { buildingCost, createBuilding, placementError } from '../../building/building.service';
import type { CommandResult, DemolishBuildingCommand, PlaceBuildingCommand } from '../commands.types';

export function handlePlaceBuilding(state: GameState, command: PlaceBuildingCommand): CommandResult {
  const error = placementError(state, command.empire, command.hex, command.kind);
  if (error) return fail(command.type, error);
  const empire = state.empires[command.empire]!;
  const cell = gridAt(state.grid, command.hex)!;
  const spec = state.config.buildings[command.kind];

  empire.gold -= buildingCost(state, command.empire, command.kind);
  cell.terrain = 'plain';
  cell.building = createBuilding(state, command.kind, 1, spec.buildSeconds);
  return ok(command.type);
}

export function handleDemolishBuilding(state: GameState, command: DemolishBuildingCommand): CommandResult {
  const empire = state.empires[command.empire];
  if (!empire || !empire.alive) return fail(command.type, 'no_empire');
  const cell = gridAt(state.grid, command.hex);
  if (!cell || !cell.building) return fail(command.type, 'invalid_target');
  if (cell.owner !== command.empire) return fail(command.type, 'invalid_target');

  cell.building.demolishAt = state.elapsed + state.config.demolish.durationSeconds;
  return ok(command.type);
}
