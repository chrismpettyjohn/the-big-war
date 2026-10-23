# The Big War — Architecture

Casual hex RTS. Up to 8 empires (1 human + bots), free-for-all from `t=0`.
Bun 1.4 + TypeScript 7 + Vite 8 + PIXI 8 (world) + SolidJS (overlay UI) +
Lightning CSS. Tests: `bun test`. Everything must keep
`bun run typecheck`, `bun test`, `bun run build` green.

This document is the contract. **The contracts in `src/game/*.ts` are written and
compile today**; the `TODO(ICT3-A)` markers inside `engine.ts`, `commands.ts` and
`bot.ts` are the gameplay engineer's work list. `TODO(ICT3-B)` in `store.ts` is
the bot-driver hook for session/integration.

---

## 1. Principles

1. **Sim is a pure data island.** `src/game` has no DOM, no PIXI, no Solid
   *runtime* import (one exception: `store.ts` imports `createSignal` — the store
   is the deliberate boundary, see §6). The sim is unit-testable in Bun with no
   browser.
2. **Deterministic.** One seeded rng (`src/game/rng.ts`) on `state.rng`. No
   `Math.random()` inside `src/game`. Iterate arrays, never object keys. Fixed
   timestep, integer-ish math where reasonable.
3. **One mutation path.** The ONLY way anything changes `GameState` is
   `dispatch(state, command)` (`commands.ts`) or `engine.step` (`engine.ts`).
   Player UI and bots both go through the command bus.
4. **Data over code.** Tuning lives in `config.ts`; research lives in
   `research.ts`; factions are data. Adding a research node or a faction must not
   require touching the engine.
5. **Boring, explicit, tunable.** No ECS, no DI container, no event bus, no
   barrels (`index.ts`). Flat modules with named exports. Strict TS, no `any`,
   no non-null-assertion where a guard reads better.

---

## 2. Folder layout

```
src/
  main.tsx                 # app entry (owned by senior; do not edit in this pass)
  session/                 # input handling, controllers, match flow (SENIOR)
    input.ts               #   pointer/keyboard → intents (pan/zoom/tap/long-press)
    camera.ts              #   camera transform + culling rect (fed to renderer)
    controllers.ts         #   selected hex/building/front, pending build, slider %
    flow.ts                #   menu → faction picker → match → end screen
  render/                  # PIXI world renderer (ICT3-B)
    world.ts               #   Application, layers, ticker wiring
    terrainLayer.ts        #   hex fills (owner colour) — batched
    overlayLayer.ts        #   selection, front badges, cannon aim, range rings
    buildingsLayer.ts      #   building sprites per kind/level
    camera.ts              #   view → world transform helpers (uses session camera)
    theme.ts               #   terrain/building colours + shape radii
  ui/                      # Solid overlay (ICT3-C)
    kit/                   # FROZEN design kit (do not modify)
    Hud.tsx                #   top bar: gold/science/civilians/soldiers/timer/speed
    Rail.tsx (app-level)   #   RailAction wiring: Map/Build/Research/Army/Menu
    BuildPanel.tsx         #   building list, costs, placement hints
    HexPanel.tsx           #   selected hex/building detail + Demolish + Cannon
    ArmyPanel.tsx          #   troop slider, front modes
    ResearchPanel.tsx      #   DATA-DRIVEN from RESEARCH_NODES
    FactionPicker.tsx      #   pre-match, DATA-DRIVEN from FACTIONS
    Toasts.tsx             #   CommandError → message map
  game/                    # the simulation (shared contracts + gameplay)
    types.ts               # CONTRACT — state types
    hex.ts  hex.test.ts    # CONTRACT — hex math (+tests)
    rng.ts                 # CONTRACT — deterministic rng
    config.ts              # CONTRACT — tuning + FACTIONS
    research.ts            # CONTRACT — research schema + nodes
    fronts.ts              # CONTRACT — front identity/bookkeeping plumbing
    commands.ts            # CONTRACT — command bus + dispatch
    engine.ts              # CONTRACT — step() stage skeleton (ICT3-A fills)
    bot.ts                 # CONTRACT — bot interface + stub (ICT3-A fills)
    setup.ts               # ICT3-A — real createInitialState + map gen
    devstate.ts            # CONTRACT — THROWAWAY renderable state (ICT3-B may use)
  types/bun-test.d.ts      # ambient bun:test types (delete if @types/bun added)
```

`dist/`, `public/webfonts`, `index.html`, `vite.config.ts`, `package.json`
scripts are off-limits.

---

## 3. Data flow

```
 pointer/keyboard            (session/input.ts)
        │  intents: Pan | Zoom | TapHex | LongPress | KeySpeed | ...
        ▼
 session/controllers.ts      → builds a Command (validates cheap UI preconditions)
        │
        ├──────────────► store.dispatch(cmd) ──► commands.dispatch(state, cmd) ──► CommandResult
        │                                                                             │
        │   (error → Toasts.tsx shows "Not enough gold" etc.) ◄──────────────────────┘
        ▼
 store.step(dtSeconds)       (rAF / PIXI ticker drives it, SENIOR)
        │  accumulator += dt * state.speed ; while >= FIXED_DT: engine.step(state, FIXED_DT)
        │  bots: every config.bot.tickSeconds → botTick() → store.dispatch(each)
        ▼
 GameState (mutable)  ──► store.version signal bumped once per frame
        │                                   │
        ▼                                   ▼
 render/world.ts                     ui/*.tsx (Solid)
 (reads state, rebuilds dirty        (read state fields inside getters that
  cell/front views, draws PIXI)       depend on store.version())
```

Rule of thumb: **UI never mutates state; renderer never mutates state; only the
bus and the engine do.**

---

## 4. Fixed-timestep loop and game speed

- `FIXED_DT = 1/30` game-second (`engine.ts`). Never pass a variable frame delta
  into `engine.step` — a variable `dt` breaks determinism and combat tuning.
- `store.step(dtSeconds)` takes **real** seconds from the frame loop, multiplies
  by `state.speed` (1/2/4), and consumes whole steps from an accumulator. The
  remaining fraction carries to the next frame. Game speed is therefore a pure
  multiplier on game time: 4x means four game-seconds per real second, and the
  15-minute time limit is *game* time.
- Spiral-of-death guard: each `store.step` call consumes at most
  `MAX_GAME_SECONDS_PER_STEP` (0.25) of **real** seconds' worth of game time, so a
  backgrounded tab resumes smoothly instead of simulating minutes. Normal frame
  loops are far below this; the clamp only bites after a stall.
- Speed change is a command (`SetGameSpeed`) so it is replayable, but the store
  also exposes `setSpeed()` which dispatches it for you.
- Bot cadence is measured in game time (`config.bot.tickSeconds`), advanced
  inside the accumulator loop — bots must not run once per frame.

---

## 5. Renderer layering and cull/redraw

Four PIXI layers in one `Application` (one canvas), bottom → top:

1. **terrainLayer** — one batched mesh/graphics pass for hex fills. Owner colour
   is `--faction-{owner}` (read once into `render/theme.ts` hex values). Terrain
   tint (forest/mountain/water) drawn as a second, cheaper pass.
2. **buildingsLayer** — building sprites, one per `cell.building`, keyed by
   `Building.id` so re-use/recycling is cheap. Update a sprite only when its
   `id`/`level`/`demolishAt` changes.
3. **overlayLayer** — selection outline, front badges (troop counts from
   `front.sideA/B`, loss arrows from `front.resolution`), cannon range ring,
   aim reticle, hover highlight.
4. **uiLayer** — PIXI-side transient FX only (cannon puff, capture flash).
   Everything textual lives in Solid, not here.

**Culling:** the visible hex range is computed from the camera rect via
`pixelToHex` on the four corners (`hex.ts`), then clamped. Only cells in that
range are drawn. At `hexSize 32` and a 1080p viewport, ~600–900 hexes are on
screen of the 3024 grid.

**Redraw strategy:** per-frame, the renderer reads a small "view model" that the
sim exposes cheaply (owner array, building list, front list). Rebuilds are
scoped: terrain rebuilds only when the visible owner/terrain slice changes (the
engine's housekeeping stage sets a `dirty` marker; the renderer compares a cheap
hash of the visible slice), buildings and fronts rebuild on `version` change but
only for visible/incident items. No per-hex per-frame allocations; reuse
`Graphics`/`Sprite` objects and typed arrays for the fill pass.

**Performance budget** (target: smooth 60 fps at ~3000 hexes, mid mobile):
- Sim: ≤ 3 ms/frame at 1x (economy is O(buildings), combat O(fronts); both are
  small — do NOT scan all 3000 hexes per tick).
- Render: ≤ 4 ms/frame; ≤ 1 draw call per layer for terrain, sprite batching for
  buildings; text is HTML/Solid (never PIXI `Text` per badge).
- UI: `version` signal wakes ≤ a few dozen Solid computations; HUD numbers are
  the only always-on reactive text. Panels are mounted lazily (only when open).
- Allocation: no new objects in the per-frame path (reuse scratch `{q,r}`
  objects; `hex.ts` helpers allocate, so prefer index math in hot loops).

---

## 6. How Solid observes the mutable sim (chosen mechanism)

**Choice: a single monotonically-increasing `version` signal per store, bumped
once per frame after stepping; components read fields through their own getters
that touch `version()` first.**

Why this and not the alternatives:

- **versus deep proxied state (Solid `createStore`)**: the sim mutates hot arrays
  (`grid.cells`, `fronts`) many times per tick. Proxying every cell access in the
  sim's inner loops would dominate the frame budget and tangle sim code with
  reactivity. `createStore` also fights "one mutation path" discipline.
- **versus one signal per empire/front/hex**: tens of thousands of signals, and
  every engine write would have to be routed through setters — alloc churn and
  ceremony for a jam-scale game.
- **versus manual `setInterval` UI polling**: no change tracking at all; panels
  would either lag or over-render, and the HUD could not react to match end.

The version signal is coarse on purpose: at 60 fps, a few dozen Solid
computations re-running against plain number reads is cheaper than fine-grained
tracking, and it is trivially correct — anything derived from `state` recomputes
when the sim advances. Panels that must not re-render every frame (the research
grid) wrap their derived data in `createMemo` keyed off specific fields
(`empire.research.completed.length`, `science`) so they only recompute when those
change.

Usage pattern (for `src/ui`):

```tsx
const store = gameStore();
const gold = () => (store.version(), store.state.empires[store.state.playerEmpire]!.gold);
```

`store.state` is stable for the life of a match (the store swaps the whole object
on `startMatch`/`returnToMenu` and bumps `version`), so `state` references are
safe to capture in `createMemo`/`createEffect` closures as long as the effect
also depends on `version()`.

---

## 7. Simulation pipeline (frozen order)

`engine.step(state, dt)` increments `elapsed`/`tick`, then runs, in this order:

1. **economy** — gold/science/civilian growth, farm growth, worker scarcity,
   `civilianBalance`.
2. **research** — advance active node progress; `completeResearch` at 1.
3. **recruitment** — civilians → soldiers up to `reserveCap`.
4. **buildings** — cannon reload decrement, timers.
5. **combat** — refresh `side.modifiers`, resolve losses, capture, write
   `front.resolution`.
6. **housekeeping** — clusters, front idle/collapse, demolitions, `hexCount`,
   eliminations, dirty marker.
7. **win check** — last standing / 75 % land / time limit.

Why this order: production must land before it is spent (research/recruitment read
this tick's gold/science); combat reads this tick's troop counts and refreshed
modifiers; housekeeping cleans up the state combat just changed, so the next tick
sees a consistent world; the win check is last so a match never ends on a
half-resolved world.

### Combat model (contract for ICT3-A)

A **Front** is a contested edge between two adjacent hostile hexes, keyed by
`edgeId(a,b)` (`fronts.ts`). Created lazily when troops are committed
(`SendTroops` → `ensureFront`), removed by stage 6 when the edge stops being
hostile, when neither side attacked for `front.idleEndSeconds`, or when a side is
wiped out. Both sides hold `troops`, a `mode` (`attack` | `defence` |
`counterattack`) and resolved `modifiers` (attack/defence multipliers + tooltip
`lines`).

Per tick (stage 5):

```
atk = resolveModifier(1, bonuses.attack)  * frontAttack bonus
def = resolveModifier(1, bonuses.defence) * frontDefence bonus
    * terrainDefence[defenderHex.terrain]  * fortSupport  * cityDefenceSupport
    * counterattack multipliers
    * (1 + multiFrontBonus)      # distinct front.clusters vs the same enemy
pressure = side.troops * atk / otherSide.troops * def
losses  = pressure * combat.baseLossesPerSecond * dt
```

Multi-front bonus counts **distinct clusters** (`front.cluster`), not individual
edges, so one long border is one front — otherwise a wide border would trivially
max the bonus. City/barracks/fort support use the `config.support` radii over
`area()`/`neighbors()` (`hex.ts`). Terrain that a cannon destroys becomes plain
in stage 4/5.

---

## 8. Command bus and error reporting

`Command` is a discriminated union (`commands.ts`): `SendTroops`,
`SetFrontMode`, `PlaceBuilding`, `DemolishBuilding`, `FireCannon`,
`StartResearch`, `SetGameSpeed`, `SelectFaction`, `SetPaused`.

- `dispatch(state, cmd): CommandResult` never throws for gameplay reasons. It
  returns `{ ok: true, type }` or `{ ok: false, type, reason: CommandError }`.
- `CommandError` (`types.ts`) is a small closed enum: `not_playing`,
  `no_empire`, `insufficient_gold`, `insufficient_science`, `insufficient_troops`,
  `reserve_full`, `invalid_target`, `not_researched`, `cooldown`,
  `research_unavailable`. UI maps each to a toast/highlight; bots branch on it.
- Validation lives in the command body, not the UI. The UI may run the *same*
  checks for greying-out buttons, but the command is authoritative.
- Commands apply cheap, immediate changes only. Everything rate-based is done by
  the engine stages, so a command can never smuggle a frame's worth of production.
- Bots use the identical bus, calling `store.dispatch` with the same `<Command>`
  objects. No bot-only fast paths.

---

## 9. Research schema (how "unique armies later" fits)

`ResearchNode` (`research.ts`) has `kind: 'modifier' | 'unlock' | 'choice'`, a
`branch` (panel tab), `cost`, `duration`, `requires`, a `position` for the grid,
`effects: ResearchEffect[]`, and — for `choice` — `options`.

- The panel renders **from the data**: tabs = branches, nodes placed by
  `position`, prerequisites from `requires` (met/unmet styling), cost/status from
  `empire.research`. It must not hardcode node ids.
- `modifier` effects fold into `empire.bonuses` via `aggregateModifiers`
  (`effective = (base + add) * mul`).
- `unlock` effects push keys like `building:cannon` into `empire.unlocks`;
  commands check `hasUnlock`.
- `choice` nodes let the player pick an `optionId` at start; the option's effects
  apply on completion. `EmpireResearch.chosen` records it.
- **Adding unique armies later:** add a node (e.g. `kind: 'choice'` with options
  that unlock `army:cataphract` / grant unit modifiers) plus, if a new effect
  shape is needed, one new `ResearchEffect` variant. Panel and state shapes do not
  change; only `ResearchEffect` grows and the panel's `switch (effect.kind)` gains
  a branch.

---

## 10. Coding conventions

- Strict TS. No `any`, no `as unknown as`, no `@ts-ignore`. Prefer `unknown` +
  narrowing.
- **No barrel files** — import the concrete module (`import { step } from './game/engine'`).
- Named exports only; no default exports in `src/game`.
- `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Public functions get a one-line doc comment explaining *why*, not *what*.
- Keep `src/game` free of `document`/`window`/PIXI. The lint-by-eye rule: if a
  file in `src/game` mentions `window`, it belongs in `session` or `render`.
- Constants come from `config.ts`; never inline a magic number in the engine.
- Every new gameplay rule gets a `bun test` in the owning engineer's area
  (see §12 for the test-ownership split).

---

## 11. File ownership map

| Path | Owner | Notes |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | **STAFF (this session)** | frozen reference |
| `src/game/types.ts` | STAFF | contract; changes need a heads-up |
| `src/game/hex.ts`, `hex.test.ts` | STAFF | contract + tests |
| `src/game/rng.ts` | STAFF | contract |
| `src/game/config.ts` | STAFF writes, **ICT3-A tunes** | numbers only, free to adjust |
| `src/game/research.ts` | STAFF writes, **ICT3-A tunes** | add nodes freely |
| `src/game/fronts.ts` | STAFF | front identity plumbing |
| `src/game/commands.ts` | STAFF writes, **ICT3-A implements TODO bodies** | signatures frozen |
| `src/game/engine.ts` | **ICT3-A** | fill the 7 stages in the given order |
| `src/game/bot.ts` | **ICT3-A** | `createBot` + `botTick` |
| `src/game/setup.ts` | **ICT3-A** | real `createInitialState` + map gen |
| `src/game/devstate.ts` | STAFF (throwaway) | ICT3-B may read/import |
| `src/game/store.ts` | STAFF writes, **SENIOR** last-mile bot hook | `TODO(ICT3-B/session)` marker |
| `src/render/**` | **ICT3-B** | PIXI only |
| `src/ui/**` except `kit/**` | **ICT3-C** | Solid only |
| `src/ui/kit/**` | FROZEN | do not modify |
| `src/session/**` | **SENIOR** | input, camera, controllers, flow |
| `src/main.tsx`, `vite.config.ts`, `package.json` | SENIOR | do not edit |

**Cross-boundary imports allowed:**

- `render` and `ui` may import types + pure helpers from `src/game` and the store
  singleton `gameStore()`.
- `session` may import `store`, `commands`, `hex`, `config`.
- `game` may **not** import from `render`, `ui` (except nothing at all) or
  `session`. `game/store.ts` is the only file allowed to import Solid.

**Interface freeze:** `dispatch`, `step`, `createBot`, `botTick`, `createDevState`,
`GameStore` and every type in `types.ts` are frozen. If a change is needed,
message it in the shared channel; the other engineer's compile must not break.

---

## 12. Test ownership

- `hex.test.ts` — STAFF (done, 10 tests).
- `command.test.ts` — ICT3-A (dispatch rejections per `CommandError`).
- `engine.test.ts` — ICT3-A (economy/recruitment/combat/win determinism; same seed
  + same command log ⇒ identical state hash).
- `bot.test.ts` — ICT3-A (bots only emit valid commands; never mutate state).
- `render` tests — none required; ICT3-B verifies visually with `createDevState`.
- `store.test.ts` — SENIOR (fixed-step accumulation, speed multiplier, pause).

Suggested determinism assertion helper (ICT3-A): run N ticks twice with the same
seed and a fixed command list, compare a cheap hash of `gold/soldiers/owners`.

---

## 13. Implementation plan / milestones

**M0 — contracts compile (DONE, this session).**
`types.ts`, `hex.ts` + tests, `rng.ts`, `config.ts`, `research.ts`, `fronts.ts`,
`commands.ts`, `engine.ts` skeleton, `bot.ts` stub, `devstate.ts`, `store.ts`.
`bun run typecheck` and `bun test` green.

**M1 — renderer can draw (ICT3-B, unblocked now).**
Use `createDevState()` + `gameStore()`. Lay out the 4 PIXI layers, draw terrain +
buildings, cull with the camera rect, show HUD churn via `store.version()`. No
gameplay needed.

**M2 — real match boot (ICT3-A).**
`setup.ts` `createInitialState`: terrain gen, empire placement, starting troops,
initial territory from cities. Wire `GameStore.startMatch` to it. UI's faction
picker starts dispatching `SelectFaction`.

**M3 — economy loop (ICT3-A).**
Engine stages 1–4. `civilianBalance` + worker scarcity tooltip data. Buildings
pay for themselves; markets/farms/labs produce.

**M4 — war (ICT3-A).**
Engine stages 5–6: modifiers, multi-front bonus, capture, front idle/collapse,
demolition removal, elimination. `SendTroops`/`SetFrontMode` bodies complete.

**M5 — bots (ICT3-A) + endgame (ICT3-A).**
`botTick`, then stage 7 win conditions and the end screen data.

**M6 — UI completion (ICT3-C).**
HUD, Build panel, Hex panel (Demolish confirm), Army panel (slider + modes),
Research panel (data-driven), Faction picker, Toasts from `CommandError`.

**M7 — integration & tuning (SENIOR).**
Input, camera feel, session flow, bot-driver wiring in `store.step`
(`TODO(ICT3-B/session)`), balance pass, 60 fps measurement at ~3000 hexes.

**Milestone gates:** each of M1–M6 ends with `bun run typecheck && bun test &&
bun run build` green, and a one-paragraph note in the shared channel.

---

## 14. Known risks / decisions to watch

- **Cluster computation** for the multi-front bonus is the most expensive
  housekeeping step; keep it O(fronts), not O(hexes) — fronts are few.
- **Civilian balance sign convention:** `civilianBalance` is the net civilians per
  game second; negative drives the tooltip. It is written in exactly one stage.
- **Deferred actions:** none in v1. Everything (recruitment, cannon reload,
  demolition, research) is a timer advanced by a stage, which keeps replays exact.
- **Determinism vs. floating point:** all rates are floats multiplied by the same
  `FIXED_DT`, so two runs are bit-identical on the same machine. Cross-machine
  determinism is not promised (no networking in v1).
