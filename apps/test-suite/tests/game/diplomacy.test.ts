import { describe, expect, test } from 'bun:test';
import { createRng } from '@the-big-war/game-engine/rng/rng.service';
import type { Empire } from '@the-big-war/client/game/empire/empire.types';
import type { GameState } from '@the-big-war/client/game/state/state.types';
import { dispatch } from '@the-big-war/client/game/commands/commands.service';
import type { GameConfig } from '@the-big-war/client/game/config/config.types';
import type { HexCell, HexGrid } from '@the-big-war/client/game/map/map.types';
import { makeGrid } from '@the-big-war/game-engine/world-tile/world-tile.service';
import { DEFAULT_GAME_CONFIG } from '@the-big-war/client/game/config/config.constants';
import { emptyModifierTotals } from '@the-big-war/client/game/modifier/modifier.service';
import { agreePeace, declareWar, getRelation, isProtected, offerCooldown, relationKey } from '@the-big-war/client/game/diplomacy/diplomacy.service';

function createTestState(configOverrides: Partial<GameConfig> = {}): GameState {
  const config: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    map: { ...DEFAULT_GAME_CONFIG.map, width: 8, height: 6, seed: 123 },
    start: { ...DEFAULT_GAME_CONFIG.start, empireCount: 3 },
    ...configOverrides,
  };

  const grid: HexGrid = makeGrid<HexCell>(config.map.width, config.map.height, hex => ({
    q: hex.q,
    r: hex.r,
    terrain: 'plain',
    owner: -1,
    building: null,
  }));

  const empires: Empire[] = [];
  for (let id = 0; id < config.start.empireCount; id++) {
    empires.push({
      id,
      name: `Empire ${id}`,
      factionId: 'ironclad',
      isHuman: id === 0,
      neutralState: false,
      colorIndex: id,
      gold: 500,
      science: 500,
      civilians: 50,
      civilianBalance: 0,
      soldiers: 100,
      reserveCap: 200,
      bonuses: emptyModifierTotals(),
      research: { completed: [], chosen: {}, active: null },
      unlocks: [],
      hexCount: 0,
      alive: true,
      eliminatedAt: null,
    });
  }

  for (const cell of grid.cells) {
    if (cell.q < 4) cell.owner = 0;
    else cell.owner = 1;
  }

  return {
    config,
    status: 'playing',
    playerEmpire: 0,
    grid,
    empires,
    fronts: [],
    expeditions: [],
    landHexCount: grid.cells.length,
    elapsed: 0,
    tick: 0,
    speed: 1,
    rng: createRng(config.map.seed),
    winner: null,
    endReason: null,
    nextBuildingId: 1,
    relations: {},
    offerCooldowns: {},
    agentAccumulator: 0,
  };
}

describe('diplomacy contracts', () => {
  test('relationKey is canonical and symmetric', () => {
    expect(relationKey(0, 1)).toBe('0:1');
    expect(relationKey(1, 0)).toBe('0:1');
    expect(relationKey(2, 5)).toBe('2:5');
    expect(relationKey(5, 2)).toBe('2:5');
  });

  test('all nations start neutral by default', () => {
    const state = createTestState();
    expect(getRelation(state, 0, 1).status).toBe('neutral');
    expect(getRelation(state, 1, 0).status).toBe('neutral');
    expect(isProtected(state, 0, 1)).toBe(false);
  });

  test('attacking another nation declares war', () => {
    const state = createTestState();
    const result = dispatch(state, {
      type: 'SendTroops',
      empire: 0,
      hex: { q: 3, r: 0 },
      target: { q: 4, r: 0 },
      percent: 50,
      intent: 'attack',
    });
    expect(result.ok).toBe(true);
    expect(getRelation(state, 0, 1).status).toBe('war');
    expect(getRelation(state, 1, 0).status).toBe('war');
  });

  test('cannot offer peace when not at war', () => {
    const state = createTestState();
    const result = dispatch(state, {
      type: 'OfferPeace',
      empire: 0,
      target: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_diplomacy');
  });

  test('offer peace during war dissolves fronts and grants 30s protection', () => {
    const state = createTestState();
    
    dispatch(state, {
      type: 'SendTroops',
      empire: 0,
      hex: { q: 3, r: 0 },
      target: { q: 4, r: 0 },
      percent: 50,
      intent: 'attack',
    });
    expect(state.fronts.length).toBe(1);
    expect(state.empires[0]!.soldiers).toBe(50);
    state.empires[1]!.soldiers = 40;

    const peaceResult = dispatch(state, {
      type: 'OfferPeace',
      empire: 0,
      target: 1,
    });
    expect(peaceResult.ok).toBe(true);

    const rel = getRelation(state, 0, 1);
    expect(rel.status).toBe('peace');
    expect(rel.expiresAt).toBe(state.elapsed + 30);

    expect(state.fronts.length).toBe(0);
    expect(state.empires[0]!.soldiers).toBe(100);

    const attackBlocked = dispatch(state, {
      type: 'SendTroops',
      empire: 0,
      hex: { q: 3, r: 0 },
      target: { q: 4, r: 0 },
      percent: 50,
      intent: 'attack',
    });
    expect(attackBlocked.ok).toBe(false);
    if (!attackBlocked.ok) expect(attackBlocked.reason).toBe('in_peace');
  });

  test('peace protection expires back to neutral after duration', () => {
    const state = createTestState();
    agreePeace(state, 0, 1);
    expect(getRelation(state, 0, 1).status).toBe('peace');

    state.elapsed = 31;
    expect(getRelation(state, 0, 1).status).toBe('neutral');
    expect(isProtected(state, 0, 1)).toBe(false);
  });

  test('pact offers 90s protection and blocks attacks', () => {
    const state = createTestState();
    const pactResult = dispatch(state, {
      type: 'OfferPact',
      empire: 0,
      target: 1,
    });
    expect(pactResult.ok).toBe(true);

    const rel = getRelation(state, 0, 1);
    expect(rel.status).toBe('pact');
    expect(rel.expiresAt).toBe(state.elapsed + 90);

    const attackBlocked = dispatch(state, {
      type: 'SendTroops',
      empire: 0,
      hex: { q: 3, r: 0 },
      target: { q: 4, r: 0 },
      percent: 50,
      intent: 'attack',
    });
    expect(attackBlocked.ok).toBe(false);
    if (!attackBlocked.ok) expect(attackBlocked.reason).toBe('in_pact');

    const repeatPact = dispatch(state, {
      type: 'OfferPact',
      empire: 0,
      target: 1,
    });
    expect(repeatPact.ok).toBe(false);
    if (!repeatPact.ok) expect(repeatPact.reason).toBe('in_pact');
  });

  test('cannot offer pact while at war', () => {
    const state = createTestState();
    declareWar(state, 0, 1);
    const result = dispatch(state, {
      type: 'OfferPact',
      empire: 0,
      target: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_at_war');
  });

  test('a much stronger bot rejects peace and the offer goes on cooldown', () => {
    const state = createTestState();
    declareWar(state, 0, 1);
    state.empires[0]!.soldiers = 10;

    const first = dispatch(state, { type: 'OfferPeace', empire: 0, target: 1 });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.reason).toBe('offer_rejected');
    expect(getRelation(state, 0, 1).status).toBe('war');
    expect(offerCooldown(state, 0, 1, 'peace')?.rejectedBy).toBe(1);

    const retry = dispatch(state, { type: 'OfferPeace', empire: 0, target: 1 });
    if (!retry.ok) expect(retry.reason).toBe('offer_cooldown');

    state.elapsed += state.config.diplomacy.rejectCooldownSeconds;
    expect(offerCooldown(state, 0, 1, 'peace')).toBeNull();
  });

  test('declare war works from neutral but not under a pact', () => {
    const state = createTestState();
    expect(dispatch(state, { type: 'DeclareWar', empire: 0, target: 1 }).ok).toBe(true);
    expect(getRelation(state, 0, 1).status).toBe('war');

    expect(dispatch(state, { type: 'OfferPact', empire: 0, target: 2 }).ok).toBe(true);
    const blocked = dispatch(state, { type: 'DeclareWar', empire: 0, target: 2 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('cannot_declare_war_under_protection');
  });
});
