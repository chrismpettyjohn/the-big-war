/**
 * The app shell: composes the world, the HUD, the rail and the panels into one
 * screen, and owns the menu → faction picker → match → end-screen flow.
 *
 * Nothing in here reaches into the sim directly — it renders `gameStore()` and
 * talks to the `MatchRuntime` (input + camera) and the controllers. That keeps
 * the playable loop easy to reason about: one loop, one command path.
 *
 * Ordering matters at match start: `startMatch()` replaces the state, then the
 * world is initialised (PIXI 8 `init()` is async), and only then does the
 * runtime start its frame loop.
 */

import { createSignal, For, Show } from 'solid-js';
import { createGameStore } from '../game/store';
import { createInitialState } from '../game/setup';
import type { GameStore } from '../game/store';
import { createMatchRuntime, type MatchRuntime } from '../session/runtime';
import { botFactionIds, configFromSettings, createMatchFlow } from '../session/flow';
import { t } from '../i18n';
import { createWorld, type WorldRenderer } from '../render/world';
import { ArmyPanel } from './ArmyPanel';
import { BuildPanel } from './BuildPanel';
import { EndScreen } from './EndScreen';
import { FactionPicker } from './FactionPicker';
import { HexPanel } from './HexPanel';
import { Hud } from './Hud';
import { MapMenu } from './MapMenu';
import { MenuScreen } from './MenuScreen';
import { ResearchPanel } from './ResearchPanel';
import { Rail, RailAction } from './kit/Rail';
import { errorLabel, factionLabel } from './text';

type PanelId = 'build' | 'army' | 'research' | 'empires' | null;

export const Shell = () => {
  const store = createGameStore({ createMatch: createInitialState });
  const flow = createMatchFlow();

  const [panel, setPanel] = createSignal<PanelId>(null);
  const [world, setWorld] = createSignal<WorldRenderer | null>(null);
  const [runtime, setRuntime] = createSignal<MatchRuntime | null>(null);
  let host: HTMLDivElement | undefined;

  /** Start a fresh match from the current menu settings + picked faction. */
  const startMatch = async () => {
    const settings = flow.settings();
    store.startMatch(configFromSettings(settings));

    // Factions: the human takes the picker's choice, bots get the rest, dealt
    // deterministically from the match seed so a given seed always plays out
    // the same lineup.
    store.dispatch({
      type: 'SelectFaction',
      empire: store.state.playerEmpire,
      factionId: flow.playerFaction(),
    });
    const bots = botFactionIds(
      store.state.empires.length - 1,
      flow.playerFaction(),
      seededRandom(settings.seed),
    );
    for (let id = 0; id < bots.length; id++) {
      const factionId = bots[id];
      if (factionId) store.dispatch({ type: 'SelectFaction', empire: id + 1, factionId });
    }
    flow.enterMatch();
    setPanel(null);

    if (!host) return;
    let activeWorld = world();
    if (!activeWorld) {
      activeWorld = createWorld({ host, initialScale: 0.85, background: 0x0c0e11 });
      await activeWorld.init();
      if (!host) return; // unmounted while initialising
      setWorld(activeWorld);
    }

    runtime()?.stop();
    const next = createMatchRuntime({
      store,
      world: activeWorld,
      host,
      onEnded: winner => flow.showResult(winner, store.state.playerEmpire),
    });
    setRuntime(next);
    next.centreOnEmpire(store.state.playerEmpire);
    next.start();
  };

  const backToMenu = () => {
    runtime()?.stop();
    setRuntime(null);
    store.returnToMenu();
    setPanel(null);
    flow.backToMenu();
  };

  const showingMatch = () => flow.screen() === 'match' || flow.screen() === 'end';

  return (
    <>
      <div ref={el => (host = el)} class="world-host" />

      <Show when={flow.screen() === 'menu'}>
        <MenuScreen
          settings={flow.settings()}
          onChange={patch => flow.updateSettings(patch)}
          onStart={() => flow.openFactionPicker()}
        />
      </Show>

      <Show when={flow.screen() === 'faction'}>
        <FactionPicker
          selected={flow.playerFaction()}
          onSelect={factionId => flow.chooseFaction(factionId)}
          onConfirm={() => void startMatch()}
          onBack={() => flow.backToMenu()}
        />
      </Show>

      <Show when={showingMatch()}>
        <Hud onFaction={() => setPanel(current => (current === 'empires' ? null : 'empires'))} />

        <Rail label={t('app.title')} brand={<span>⚔</span>} onBrand={() => setPanel(null)}>
          <RailAction
            label={t('rail.build')}
            icon={<span>🏛</span>}
            active={panel() === 'build'}
            onClick={() => setPanel(current => (current === 'build' ? null : 'build'))}
          />
          <RailAction
            label={t('rail.army')}
            icon={<span>🎖</span>}
            active={panel() === 'army'}
            badge={store.state.fronts.length}
            badgeAccent
            onClick={() => setPanel(current => (current === 'army' ? null : 'army'))}
          />
          <RailAction
            label={t('rail.research')}
            icon={<span>🔬</span>}
            active={panel() === 'research'}
            onClick={() => setPanel(current => (current === 'research' ? null : 'research'))}
          />
          <RailAction label={t('rail.menu')} icon={<span>☰</span>} danger onClick={() => backToMenu()} />
        </Rail>

        <Show when={panel() === 'build' && runtime()}>
          {active => <BuildPanel controllers={active().controllers} onClose={() => setPanel(null)} />}
        </Show>
        <Show when={panel() === 'army' && runtime()}>
          {active => <ArmyPanel controllers={active().controllers} onClose={() => setPanel(null)} />}
        </Show>
        <Show when={panel() === 'research'}>
          <ResearchPanel onClose={() => setPanel(null)} />
        </Show>
        <Show when={panel() === 'empires'}>
          <EmpiresPanel store={store} onClose={() => setPanel(null)} />
        </Show>

        <Show when={runtime()}>
          {active => (
            <>
              <Show when={active().controllers.selectedHex()}>
                <HexPanel
                  controllers={active().controllers}
                  onClose={() => active().controllers.selectHex(null)}
                />
              </Show>
              <MapMenu
                controllers={active().controllers}
                onInspect={() => setPanel(null)}
                onArmy={() => setPanel('army')}
                onBuild={() => setPanel('build')}
              />
              <Notices controllers={active().controllers} />
            </>
          )}
        </Show>

        <div class="kit-map-hint">
          <strong>{t('menu.tutorialHint')}</strong>
        </div>
      </Show>

      <Show when={flow.screen() === 'end'}>
        <EndScreen
          playerWon={flow.lastResult()?.playerWon ?? false}
          onAgain={() => void startMatch()}
          onMenu={() => backToMenu()}
        />
      </Show>
    </>
  );
};

/** Toast stack driven by rejected commands (see controllers.notice). */
const Notices = (props: { readonly controllers: MatchRuntime['controllers'] }) => (
  <div class="kit-toasts" aria-live="polite">
    <For each={props.controllers.notices()}>
      {notice => <div class="kit-toast">{errorLabel(notice.reason)}</div>}
    </For>
  </div>
);

/** Read-only empire overview (kept inline: it is a flat list, no commands). */
const EmpiresPanel = (props: { readonly store: GameStore; readonly onClose: () => void }) => (
  <div class="street-drawer-panel">
    <header class="street-drawer-panel-head">
      <h2 class="street-drawer-panel-title">{t('panel.empires.title')}</h2>
      <button type="button" class="street-drawer-panel-close" onClick={() => props.onClose()}>
        ✕
      </button>
    </header>
    <div class="street-drawer-panel-body">
      <For each={props.store.state.empires}>
        {empire => (
          <div class="kit-row" style={{ opacity: empire.alive ? 1 : 0.4 }}>
            <span class="hud-card-swatch" style={{ background: `var(--faction-${empire.colorIndex})` }} />
            <span class="hud-card-sub" style={{ flex: '1' }}>
              {factionLabel(empire.factionId)}
              {empire.id === props.store.state.playerEmpire ? ` · ${t('panel.empires.you')}` : ''}
            </span>
            <span class="hud-bar-value kit-num">{empire.hexCount}</span>
            <span class="hud-bar-value kit-num">{Math.floor(empire.soldiers)}</span>
          </div>
        )}
      </For>
    </div>
  </div>
);

/** Mulberry32 — a tiny deterministic PRNG so faction dealing is seed-stable. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
