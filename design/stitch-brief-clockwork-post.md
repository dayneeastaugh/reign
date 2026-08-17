# The Clockwork Post — design brief

A themed quest for **Reign**, an existing mobile puzzle game (a Queens-style logic
puzzle, installed as a PWA on iPhone). The game already ships; this brief covers
one new quest's look. Design for **portrait phone, 390×844**.

## What already exists (do not redesign)

Reign's house style is **"Letterpress"**: a fine stationery shop with Monument
Valley warmth. Cream paper #f6f1e7, pressed ink #3f3a33, gold #a8813f. Buttons
are pill-shaped "tags" with 1.5px dashed borders. Titles are Libre Caslon Text
(serif); UI text is Source Sans 3. There is a sticky app bar (crown mark, screen
title, settings gear) and a bottom nav — Play · Quest · Cabinet.

Every quest reskins the game while the house structure stays constant. Please
keep the tag chrome, the serif titles, and the bottom nav exactly as they are.

## The quest

**The Clockwork Post.** A letter travels up through a Victorian sorting house by
pneumatic tube, from the front-door slot to the postmaster's desk in the loft.
Along the way it passes four **sorting halls**, each yielding one part of a brass
letter scale. Assembling all four completes the keepsake.

- **30 levels**, deliberately gentler than the game's space quest: 12 easy,
  13 medium, 5 hard. The four sorting halls and the finale are the only hard
  boards.
- **Sorting halls at levels 6, 13, 20 and 27**; finale at level 30, "The Golden
  Scale".
- **Level names** run in three bands. Intake: The Slot, Doormat, Wicker Basket,
  First Sort, Franking Bench, Ink Well, Pigeonhole, Twine Drawer, Blotter.
  Sorting: Ledger Row, Sealing Wax, Nightshift, Counter Six, Registered Post,
  Airmail, Parcel Chute, Bell Pull, The Weighbridge. Upper: Poste Restante, The
  Loft, Undeliverable, Cobweb Row, Return to Sender, Last Collection, The
  Postmaster, Final Round, The Golden Scale.
- **Keepsake**: The Letter Scale, built from four parts — pan, beam, poise
  weight, and base.

## Colours already in the build

The quest ships with these, chosen by a validator that checks every region pair
stays distinguishable including under colour blindness. **Treat them as fixed**
and design around them.

- **Map sky**, dim loft at top down to lamplight at the foot:
  `#191309 → #221a10 → #2e2416 → #3d2e1c → #513c26`
- **Travelled path** brass `#c9a24a`; **path ahead** `#8d7a5e`
- **Dust motes / highlights**: `#e8dcc0`, `#cfc0a0`, `#f2e8d0`
- **Chrome on dark**: text `#f4ead6`, muted `#a8977d`
- **Five playfield variants**, each a room with its own board background and
  queen glyph:
  - `intake` — `#2c2118 → #3a2c1e`, glyph ✉
  - `sorting` — `#241d16 → #322820`, glyph ◈
  - `franking` — `#2a1614 → #38201c`, glyph ✱
  - `restante` — `#1e2018 → #2a2c22`, glyph ✒
  - `hall` (sorting halls) — flat `#20180f`, glyph ✜

## What to design

### 1. Keepsake artwork (highest value — this ships as an image)

A **brass letter scale under a glass dome** on a dark wooden base, with an
engraved brass plaque beneath reading "The Letter Scale". Dark brown backdrop,
warm museum lighting, painterly detail, **square composition**.

This must sit on a shelf beside an existing keepsake — a brass orrery under a
glass dome with an engraved plaque — so **match that treatment exactly**: same
dome, same plaque style, same lighting, same dark ground. The two should look
like a matched set in a collector's cabinet.

Deliverable: one square image, JPEG or PNG, at least 800×800.

### 2. Quest map screen

A vertical scrolling journey, currently rendered procedurally. Please design the
**scene**, not a static picture: what the player climbs through.

- Ordinary levels are small waypoints; every fifth level and each sorting hall is
  a larger illustrated stop with its name beside it.
- The route runs from a lamplit **letter slot** at the bottom to the postmaster's
  desk at the top, with a brass trail behind the player and a faint dashed route
  ahead.
- Something travels the route — currently an envelope. A **brass tube canister**
  would be better if you can suggest one that reads at ~24px.
- Deep field currently holds drifting dust, lamplight pools, faint clock faces,
  tube-junction diagrams, and an occasional canister whisking past.

What would help most: **what the stops should be** (pigeonhole racks, ledger
desks, wicker baskets, tube junctions, a franking press) and how a sorting hall
should differ from an ordinary stop.

### 3. Playfield rooms

Five board backgrounds, one per variant above. The puzzle board sits in the
middle at roughly 92% of screen width; everything else is the room around it.
Panel lines, shelf edges, lamplight, a pigeonhole wall — enough to say "you are
somewhere" without competing with the board.

### 4. Four part marks

Small marks shown in a row as the scale is assembled: **pan, beam, poise weight,
base**. They appear at about 16px inside a 34px circle, and again as a badge on a
sorting hall. Currently placeholder characters ▽ ⚖ ◍ ▤ — simple line SVGs would
be better.

## What is implementable (please read)

The map and rooms are **drawn in code** — CSS gradients and shapes — not from
image files, so that content stays a few kilobytes and works offline. So:

- **Illustrations for the map and rooms are references, not shipped assets.**
  They guide colours, composition and mood, and I rebuild them procedurally.
- **The keepsake artwork ships as a real image.** That one is used directly.
- **Part marks** should be simple enough to become small SVGs or single glyphs.
- Anything with fine texture, photographic detail or per-level bespoke artwork
  cannot ship in the map — a strong idea in three shapes and two colours is worth
  more than a rendered scene.

## Hard constraints — do not change

- Portrait phone only; no horizontal scrolling; safe areas respected.
- **Region colours are gameplay information**, not decoration. They are already
  fixed by a validator that measures every pair under normal vision and simulated
  protanopia, deuteranopia and tritanopia. Please do not restyle the board's
  region colours.
- Board geometry is fixed: square cells, heavy lines between colour regions,
  hairlines within them. Marks are a queen glyph and a neutral ×.
- Touch targets ≥44px.
- Nothing may obscure the board during play.
