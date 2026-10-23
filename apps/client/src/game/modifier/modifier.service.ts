import { MODIFIER_KEYS } from './modifier.constants';
import type { Modifier, ModifierTotals } from './modifier.types';
import {
  aggregateModifiers as aggregateEngineModifiers,
  emptyModifierTotals as emptyEngineModifierTotals,
} from '@the-big-war/game-engine/modifier/modifier.service';

export function aggregateModifiers(modifiers: readonly Modifier[]): ModifierTotals {
  return aggregateEngineModifiers(MODIFIER_KEYS, modifiers);
}

export function emptyModifierTotals(): ModifierTotals {
  return emptyEngineModifierTotals(MODIFIER_KEYS);
}
