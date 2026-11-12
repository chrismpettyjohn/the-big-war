import { describe, expect, test } from 'bun:test';
import { gameStore, setGameStore } from '@the-big-war/client/game/store/store.service';

describe('default game store', () => {
  test('without an installed store, gameStore runs an in-process sim', async () => {
    const previous = setGameStore(null);
    const store = gameStore();
    await store.startMatch();
    const tick = store.state.tick;
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(store.state.tick).toBeGreaterThan(tick);
    expect(gameStore()).toBe(store);
    store.returnToMenu();
    setGameStore(previous);
  });
});
