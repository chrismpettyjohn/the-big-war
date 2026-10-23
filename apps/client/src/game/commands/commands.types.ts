import type { EmpireId } from '../empire/empire.types';
import type { GameSpeed } from '../config/config.types';
import type { BuildingKind } from '../building/building.types';
import type { FrontId, FrontMode } from '../front/front.types';
import type { Axial } from '@the-big-war/game-engine/world-tile/world-tile.types';
import type { CommandOutcome, CommandLogEntry as EngineCommandLogEntry } from '@the-big-war/game-engine/commands/command.types';

export type CommandError =
  | 'not_playing'
  | 'no_empire'
  | 'insufficient_gold'
  | 'insufficient_science'
  | 'insufficient_troops'
  | 'reserve_full'
  | 'invalid_target'
  | 'not_researched'
  | 'cooldown'
  | 'research_unavailable'
  | 'in_peace'
  | 'in_pact'
  | 'in_alliance'
  | 'already_at_war'
  | 'cannot_declare_war_under_protection'
  | 'invalid_diplomacy'
  | 'offer_rejected'
  | 'offer_cooldown';

export interface SendTroopsCommand {
  readonly type: 'SendTroops';
  readonly empire: EmpireId;

  readonly hex: Axial;

  readonly target: Axial;

  readonly percent: number;

  readonly intent: 'attack' | 'defence';

}

export interface SetFrontModeCommand {
  readonly type: 'SetFrontMode';
  readonly empire: EmpireId;
  readonly frontId: FrontId;
  readonly mode: FrontMode;
}

export interface RetreatFrontCommand {
  readonly type: 'RetreatFront';
  readonly empire: EmpireId;
  readonly frontId: FrontId;
}

export interface PlaceBuildingCommand {
  readonly type: 'PlaceBuilding';
  readonly empire: EmpireId;
  readonly hex: Axial;
  readonly kind: BuildingKind;
}

export interface DemolishBuildingCommand {
  readonly type: 'DemolishBuilding';
  readonly empire: EmpireId;
  readonly hex: Axial;
}

export interface FireCannonCommand {
  readonly type: 'FireCannon';
  readonly empire: EmpireId;

  readonly from: Axial;
  readonly target: Axial;
}

export interface StartResearchCommand {
  readonly type: 'StartResearch';
  readonly empire: EmpireId;
  readonly nodeId: string;

  readonly optionId?: string;
}

export interface SetGameSpeedCommand {
  readonly type: 'SetGameSpeed';
  readonly speed: GameSpeed;
}

export interface SelectFactionCommand {
  readonly type: 'SelectFaction';
  readonly empire: EmpireId;
  readonly factionId: string;
}

export interface SetPausedCommand {
  readonly type: 'SetPaused';
  readonly paused: boolean;
}

export interface OfferPeaceCommand {
  readonly type: 'OfferPeace';
  readonly empire: EmpireId;
  readonly target: EmpireId;
}

export interface OfferPactCommand {
  readonly type: 'OfferPact';
  readonly empire: EmpireId;
  readonly target: EmpireId;
}

export interface OfferAllianceCommand {
  readonly type: 'OfferAlliance';
  readonly empire: EmpireId;
  readonly target: EmpireId;
}

export interface DeclareWarCommand {
  readonly type: 'DeclareWar';
  readonly empire: EmpireId;
  readonly target: EmpireId;
}

export type Command =
  | SendTroopsCommand
  | SetFrontModeCommand
  | RetreatFrontCommand
  | PlaceBuildingCommand
  | DemolishBuildingCommand
  | FireCannonCommand
  | StartResearchCommand
  | SetGameSpeedCommand
  | SelectFactionCommand
  | SetPausedCommand
  | OfferPeaceCommand
  | OfferPactCommand
  | OfferAllianceCommand
  | DeclareWarCommand;

export type CommandType = Command['type'];

export type CommandResult = CommandOutcome<Command, CommandError>;

export type CommandLogEntry = EngineCommandLogEntry<Command, CommandResult>;
