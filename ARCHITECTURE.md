# Reign — architecture

A Queens-style (LinkedIn) puzzle game named **Reign**, built as an offline-first PWA,
with programmatic puzzle generation, tournaments delivered as remote static content,
and a stationery-shop visual identity. App icon: ink-stamped crown on cream.

## Game rules (fixed, never themeable)

- N×N grid divided into N contiguous color regions.
- Exactly one queen per row, column, and region.
- No two queens may touch, including diagonally (adjacent cells only, not full diagonals).
- Tap cycles a cell: empty → X → queen → empty. X marks are player notes.

## Core requirement: puzzle validity

Every puzzle — generated or hand-made — must satisfy both:

1. **Exactly one solution** (verified by a counting backtracking solver that stops at 2).
2. **Solvable by logical deduction alone** — no guessing required, verified by a
   logical solver that applies human-style techniques.

Difficulty is graded honestly by the hardest deduction technique required plus grid size:

| Difficulty | Grid | Techniques |
|---|---|---|
| Easy | 7×7–8×8 | Single-region / single-row-column eliminations |
| Medium | 9×9 | Region-interaction reasoning (region confined to rows/cols) |
| Hard | 10×10–11×11 | Multi-step "wherever this queen goes…" chains |

**Generation pipeline** (runs on-device, offline, sub-second at these sizes):
place valid queen configuration → grow regions around queens → verify uniqueness →
grade with logical solver → retry until target difficulty band met. Seeded, deterministic
RNG so every quick-mode puzzle has a reproducible ID (enables bug reports, sharing,
future daily puzzle).

**Hints** are the logical solver run against the player's current board state:
tier 1 nudge ("look at this region") → tier 2 elimination with reasoning → tier 3 placement.
If the player's board contains an incorrect mark, the first hint points at the mistake.

## Structure

```
reign/
├── packages/engine/     # pure TS, zero UI deps: board model, rules, uniqueness solver,
│                        # logical solver, generator, difficulty grader, hint engine
├── apps/game/           # the PWA
├── apps/editor/         # level editor (web app, reuses engine)
└── content/             # tournament JSON + theme assets + manifest; CI-validated
```

The engine package is built and tested first; every hard problem (generation, hints,
difficulty, editor validation, content CI) consumes it.

## Platform: PWA

- TypeScript + Vite + **Svelte** + vite-plugin-pwa (Workbox). Board rendered as DOM/SVG.
- Installed to iOS home screen via Add to Home Screen (one-time instruction screen;
  iOS has no install prompt). Installed PWAs are exempt from Safari's 7-day storage
  eviction; also call `navigator.storage.persist()`.
- Persistence: IndexedDB (via `idb`), **schema versioned from day one with migrations**
  for every change — history/achievements must survive app updates (req 14).
- Backup: export/import of progress as a small JSON blob (share sheet), covering
  device loss/change.
- Service worker updates surface a quiet "update ready" affordance; never swap mid-game.

## Tournaments: static content, no backend

- Free static hosting (GitHub Pages; Cloudflare Pages equally fine). Publishing a
  tournament = pushing a commit. Total running cost $0.
- App fetches `manifest.json` when online, downloads new/updated tournament packs into
  IndexedDB/Cache Storage; all play is offline afterward.
- Manifest and packs carry a **schema version**; old app versions skip content they
  don't understand.
- Level JSON: grid size, region map, solution, graded difficulty, keystone flag,
  **display name** (e.g. "Rust world", "Station II · Dock 24" — shown in the playfield
  header and on node tap), `variant` field (reserved for future keystone rule twists),
  theme metadata.
- Tournament JSON: ordered level list (mixing difficulties), name, theme section,
  version, and a declared **setup block**: total level count, which levels are special
  (waypoints/keystones), collectible part count and which levels award each part, and
  per-level playfield variant references. CI validates internal consistency: counts
  match the level list, every part maps to a declared special level, every referenced
  playfield variant exists in the theme, and **every special level (and the final
  level) is graded hard difficulty** — the deliberate difficulty spikes of the
  tournament, with parts as the payoff for clearing them.
- Content repo CI re-validates every level with the engine (uniqueness + logic-solvable
  + stated difficulty) and every theme palette (distinguishability + CVD safety)
  before deploy. A bad level or illegible palette cannot ship.
- Level editor (apps/editor): paint regions, live uniqueness/difficulty validation,
  exports level JSON. Reuses the engine package.

### Tournament map screen

Every tournament has a map screen showing all its levels, the player's progress, and
the special levels. The layout is **data-driven, not hand-painted**: the level count
varies per tournament, so the map generates a winding path from the tournament's level
list (serpentine layout with theme-configurable spacing and jitter), and the theme
decorates it. A theme supplies: background layers (altitude gradient, ambient
decoration like starfields/nebulas — procedural where possible to keep packs small),
path stroke styles, node sprites per type and state, vehicle sprite, and header art.
Optional per-node position overrides in the tournament JSON allow hand-tuned layouts.

The map tells a **journey story**, not just a checklist:
- A themed **vehicle** (rocket in space) sits at the current level and advances with
  a short travel animation when a level is completed.
- The **traveled path** is styled differently from the road ahead (solid gold trail
  vs faint dashed), so progress reads at a glance.
- **Node types** are extensible per theme: ordinary stops (planets — shaded, banded,
  cratered, ringed; visually varied) and **waypoint stops** (space stations) which are
  the keystone levels and award collectible parts.
- A journey has a visible origin (home-planet launchpad) and destination (the final
  node), so the path goes *somewhere*.

Node states: locked (unlit/muted, not tappable), current (emphasized + pulse, vehicle
parked here, auto-scrolled on entry), completed (lit, quiet performance marker, tap to
replay — replays never downgrade results), keystone/waypoint (distinct sprite, shows
its part as earned badge or dashed empty slot), final (special sprite; completing it
finishes the tournament and the keepsake with the theme's celebration).

The map is a **scrolling viewport**: tournaments can be long (the first is 50 levels),
so the path extends vertically and the view auto-scrolls to the current level on
entry, freely scrollable to review the journey or peek ahead. Level numbers are
rendered legibly on every node (inside planets, pill labels under stations) — visible
without shouting.

Header: tournament title, goal line ("Build the brass orrery"), progress count. A
**part tray** on the map shows collectible parts earned vs remaining.

### Collectibles and the gallery (tournament meta-progression)

Each tournament defines a **keepsake** — a themed collectible assembled from N parts:
- Parts are awarded at keystone/waypoint levels; the part tray and waypoint badges
  show progress toward assembly.
- Completing the final level completes the keepsake.
- Completed keepsakes are displayed permanently in **the collector's cabinet** — the
  achievements gallery, rendered in the base Letterpress look: each keepsake sits
  **under a glass bell jar on a wooden shelf**, museum-style. Uncompleted tournaments
  appear as dashed empty jars with a "?" — visible aspiration, satisfying req 11
  (lifetime recognition of tournament completion). Keepsake art is illustrated SVG
  (detailed enough to feel collectible, small enough for the pack budget).
- Keepsakes are theme-specific: brass orrery (space), pressed-flower frame
  (botanical), etc. Defined in the tournament JSON: name, part count, part glyphs,
  assembled art (small SVG), and which levels award parts.
- Cabinet also quietly surfaces lifetime stats (puzzles solved, streaks) as plaques.

### Playfield theming

During a tournament, the **board screen itself** carries the theme, not just the map —
and it varies **per level**, not just per tournament. A theme defines a set of
**playfield variants** (background treatment, board region palette, ambient
decoration, **queen glyph**, header label style), and each level references one:
- Planet levels tint the playfield to the world being visited (a rust world gets a
  warm rust wash and palette; an ice world goes cool).
- Station levels get a distinct **interior look** (panel lines, porthole to the stars,
  cooler palette) plus a banner showing the part earned on completion.
- A level with no variant reference falls back to the theme's default playfield.

The queen glyph can change per variant to match the level's world (gold star on
planets, frost flake on ice worlds, gear inside stations); the X mark always stays a
neutral ×, and glyphs must pass the same CI legibility check as palettes (high
contrast against every region color in the variant). The playfield header shows the
level's display name ("Level 14 · Rust world").

The house structure — serif title, dashed-tag chrome, board geometry — stays constant
within a tournament so it still feels like one app. Quick mode remains base
Letterpress (crown queens). Variant palettes go through the same CI legibility
validation as everything else.

## Visual identity

**Base theme: "Letterpress"** — stationery/paper-shop personality with Monument Valley
warmth. Cream paper ground (#f6f1e7), ink-drawn grid (#3f3a33), muted warm region
palette (dusty rose / sage / ochre / slate / mauve), ink-stamped crown queens,
stitched/dashed-border tag chrome, serif display accents. Faint paper-grain texture.
Not cartoonish, not sterile (req 12).

**Animations**: subtle and tactile — queen lands like a rubber stamp with an ink-settle;
tags depress like letterpress; quiet completion flourish. No confetti storms.

**Theming system** — every visual decision is a design token; the renderer reads only
tokens. A tournament skin is a `theme.json` override + small assets (SVG glyphs,
map art) shipped inside its content pack (budget: <500 KB), cached for offline.

Three tiers of skin effort:
1. **Chrome** — background, frame, accent, completion flourish (every tournament).
2. **Board skin** — region palette, queen glyph swap (crown → snowflake, bloom, …;
   X marks stay neutral), cell texture.
3. **World** — themed tournament map screen: path artwork, node styles, keystone
   treatment, header illustration. Monument Valley-style soft gradient skies live here.

Hard rules for skins: geometry, mark meanings, and interactions never change; palettes
must pass CI legibility validation; missing/failed assets fall back silently to base
tokens (a theme is decoration, never a dependency). Quick mode always uses the base
theme. Tournaments may depart fully from the warm base (celestial, botanical, art deco…).

**First tournament: "The Grand Orbit" (space theme)** — a rocket journey from a
home-planet launchpad through varied shaded planets, docking at space stations
(keystones) to collect brass orrery parts, ending at a ringed golden final planet
where the orrery is completed. Deep starfield ground with altitude gradient and
nebulas, gold trail behind the rocket, dashed constellation path ahead. Board skin:
starfield backdrop, per-level world tints (rust world, ice world, …), station
interiors, gold star glyph (✦) for queens, cream dashed-tag chrome.
**Setup: 50 levels, 5 stations (levels 8/16/24/32/40), 5 orrery parts**, difficulties
mixed across the run. **Special levels are always hard difficulty** — a station is a
peak to climb, with the part as the payoff; the levels just before one lean medium so
the ramp feels deliberate rather than sudden. The final level is also hard. Keepsake: the brass orrery under a bell jar in the collector's
cabinet. Working name and details refinable in content, not code.

## Modes and progression

- **Quick**: pick difficulty → generated puzzle (seeded).
- **Tournament**: pre-designed progression — map screen with a path of nodes mixing
  difficulties, keystone levels as special nodes, themed per tournament.
- Progression is subtle (req 10): per-level results (time, hints, mistakes), quiet
  performance markers, tournament completion records, lifetime stats and streaks,
  achievements as a checklist evaluated from stats. No shouting XP bars.
- **Completion stars (tournaments)**: every level shows a 3-star row under its map
  node — empty outlines until played, filled gold on completion. The scoring rule is
  **declared per tournament in the setup block** (`stars: {metric, two, three}`), so
  future tournaments can score differently. Grand Orbit uses the `moves` metric:
  queen placements + removals + hints used, against a par of one placement per row —
  X-mark note-taking is always free. 1★ = completion, 2★/3★ = overhead within the
  declared thresholds. Stars never downgrade on replay, and collectible parts remain
  completion-only — stars are recognition, never a gate.
- Mistake policy: live conflict highlighting by default, "purist mode" toggle to disable.
- QoL: undo stack, drag-to-mark X's, optional auto-X on queen placement, timer with pause.
- Accessibility: CVD-tested palettes plus optional per-region pattern overlay;
  ≥44px touch targets.

## Testing

- Property tests on the engine: every generated board has exactly one solution and is
  logic-solvable at its stated difficulty; hints from any legal position lead to the
  solution.
- Content CI as described above.

## Decisions log

| Decision | Choice | Notes |
|---|---|---|
| Platform | PWA | No Apple developer fee; offline via service worker |
| Framework | Svelte (default) | Lighter PWA; swap to React only if ecosystem/help needed — decide before scaffold |
| Hosting | GitHub Pages (default) | Cloudflare Pages fine too |
| Base look | Letterpress | Chosen over Terracotta dusk, Craft counter, and earlier Linen/Nightfall/Fresh paper rounds |
| Queen glyph | Themeable per tournament and per level | X marks stay neutral; crown in quick mode |
| Puzzle validity | Unique + logic-solvable | Promoted from "solvable" — keystone of the design |
| Backend | None | Static content only |
| App name | Reign | Chosen over Paper Crown, Monarch, The Royal Post |
| Sound | Subtle tactile sounds, mutable | Paper/stamp sounds matching animations; themed per tournament; built in polish phase |
| Dark mode | Light-only at launch | Dark "midnight ink" variant post-launch; cheap via token system |

## Build order

1. `packages/engine` with full test suite (rules → solvers → generator → grader → hints).
2. Minimal playable board UI with Letterpress tokens (quick mode, easy only).
3. Persistence layer + settings + QoL (undo, auto-X, conflicts, timer).
4. Full quick mode (all difficulties) + hint UI.
5. Content schema + first tournament ("The Grand Orbit", space skin) — forces the
   token system and map layout to be real early.
6. Tournament map screen (data-driven serpentine layout, journey vehicle, part
   collection), collector's cabinet gallery, progression/achievements.
7. Level editor + content CI + remote manifest flow.
8. PWA polish: install flow, update flow, export/import backup, subtle sound with
   mute toggle.
