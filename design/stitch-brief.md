# Reign — design brief

## Product

Reign is a mobile-first puzzle game — a polished take on the "Queens" logic puzzle —
shipped as a PWA installed to an iPhone home screen. Design for **portrait phone,
390×844**. One player, quiet daily sessions. The audience is an adult who likes
elegant, calm games; nothing childish or loud.

**Game rules (immutable — they shape the board component):** an N×N grid (7–11)
divided into N irregular colored regions. Place exactly one queen per row, column,
and color region; queens may not touch, even diagonally. Tap cycles a cell
empty → × → queen → empty; dragging paints × marks. Region colors are
gameplay-critical: every region must be clearly distinguishable from its neighbours.
Thick dark borders separate regions; hairlines divide cells within a region.

## Brand identity: "Letterpress"

Personality: a fine stationery / paper-goods shop with Monument Valley warmth.
Tactile, refined, warm. Not cartoonish, not sterile. No glossy gradients, no plastic
3D buttons, no neon. Think cream paper, pressed ink, stitched tags, wax-stamp
moments, faint paper grain.

**Base (light) tokens:**
- Paper #f6f1e7 · raised paper #fdfaf3 · ink #3f3a33 · soft ink #6e675c
- Gold accent #e3c27c (deep gold #a8813f) · danger red #a8402f
- Board region palette: dusty rose #d8a79a, sage #a9b494, ochre #d9b97e,
  slate #9db0c4, mauve #b39ab0, terracotta #cd8f6e, seafoam #93b8a5,
  olive #b3b072, lilac #a08cbf, sand #e2cfa8, denim #6f8fae
- Queen mark: ink-stamped crown ♛ · × marks: soft ink

**Type:** serif display for titles (Iowan Old Style / Palatino feel), system sans
for UI text. **Buttons are "tags":** pill shapes with 1.5px dashed borders (stitched
look); active/selected = solid ink fill with paper text; primary action = gold fill.

**Motion:** subtle and tactile — queens land like rubber stamps (scale-settle),
tags depress on press, a quiet flourish on completion. No confetti storms.

## Theming: tournaments reskin the game

Tournaments fully reskin the playfield and map while board geometry, mark meanings,
tap/drag interactions, and the tag-chrome structure stay constant. The first
tournament is **"The Grand Orbit" (space)**: deep starfield with an altitude
gradient (#0c081f top → #26305c horizon), nebula washes, gold #e3c27c accents,
cream #f2ead8 chrome on dark, dashed-tag language preserved.

Playfield **variants tint per level**: dusk (default), rust world (warm wash),
ice world (cool wash, frost ❅ queens), violet, ember, and **station interiors**
(steel palette, gear ⚙ queens, panel lines, porthole to stars). The queen glyph
changes with the level's world; the × mark is always neutral.

## Screens to design (each with listed states)

1. **Quick play (home).** Serif "Reign" masthead, one-line rule caption, difficulty
   tags (Easy · Medium · Hard · New), status row (pause ❙❙, timer 1:24, Undo, Hint,
   settings ⚙), the board (7×7–11×11), instruction caption. States: playing ·
   paused (paper cover over board, "Paused" + Resume) · hint active (dashed-gold
   message card under board, e.g. "Look at the rose region — only one cell can hold
   its ♛", with gold-ringed highlighted cells) · mistake hint (red-ringed cell,
   message "This ♛ can't be right") · solved (rotated gold stamp "Solved · 1:24" +
   Play again).

2. **Tournament map — "The Grand Orbit." The hero screen.** A vertical scrolling
   journey of 50 levels from a warm home-planet launchpad at the bottom to a ringed
   golden final planet at the top. Dashed constellation path ahead; solid gold trail
   behind. Nodes: varied shaded planets (banded, cratered, some ringed), space
   stations at levels 8/16/24/32/40 (solar-panel silhouettes, part badge), locked
   levels as unlit moons, the current level pulsing with a small rocket parked
   beside it. Legible level numbers on every node, and a **row of three tiny stars
   under every node** — empty outlines until earned, filled gold after. Header:
   back chevron, "The Grand Orbit", goal line "Build the brass orrery", progress
   "9 / 50", and a five-slot orrery part tray (⚙ ◉ ◠ ✶ ✧ — earned parts
   brass-filled, unearned as dashed empty slots).

3. **Tournament playfield.** Dark themed play screen: "‹ Map" tag, serif title
   "Level 8 · Station I · Dock 8", subline "hard · part on completion", status row,
   board in the variant palette with the themed queen glyph, caption. States:
   playing · paused · hint · solved (three large earned stars above a stamp
   "Part secured ⚙ · 1:20", then gold "Next level" + "Map" tags). Also show one
   planet-world variant (e.g. rust or ice) for contrast with the station interior.

4. **Collector's cabinet (achievements).** Always base Letterpress light: paper
   background, wooden shelf, completed keepsakes displayed **under glass bell
   jars** — first keepsake is an illustrated brass orrery — with small plaque
   labels ("The Grand Orbit ★"). Future tournaments appear as dashed empty jars
   with "?". Quiet lifetime stats as small engraved plaques: puzzles solved,
   streak, total stars.

5. **Settings.** Tag-style toggles: Auto-× (on/off), Show clashes (on/off), Sound
   (on/muted); Export backup / Import backup tags; small version line.

6. **iOS install onboarding.** One-time sheet in the stationery voice explaining
   Share → Add to Home Screen, with a small crown icon preview.

## Hard constraints — do not "improve" these away

- Portrait phone only; no horizontal page scroll; respect safe areas; dark themes
  paint edge-to-edge (including behind notch and home indicator).
- Region colors are functional. Palettes must keep neighbouring regions clearly
  distinguishable (aim color-vision-deficiency-safe; an optional pattern overlay
  exists as a fallback).
- Touch targets ≥44px. Board cells are square with crisp lines.
- Board geometry, mark meanings (× and queen), and tap/drag interactions are fixed.
- Keep the dashed-tag chrome and serif-title language consistent across light and
  dark screens — the app must always feel like one product.

## Deliverables

One design per screen above, plus the listed states for screens 1 and 3. The build
implements designs in Svelte with CSS custom-property tokens, so consistent spacing,
color tokens, and reusable component styles across screens matter more than
per-screen pixel effects.
