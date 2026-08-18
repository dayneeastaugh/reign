# The Clockwork Post — design brief (round two)

**This is a head-to-head.** The same brief is going to two tools. Whichever
produces the more usable design wins the work. Read the "How this will be
judged" section at the end before you start — it is not a normal beauty contest.

---

## 1. The product

**Reign** is a shipping mobile puzzle game — a Queens-style logic puzzle
installed as a PWA on iPhone. It has a quick-play mode and themed **quests**.
Design for **portrait phone, 390×844**. No landscape, no tablet.

The house style is **"Letterpress"**: a fine stationery shop with Monument
Valley warmth.

| | |
|---|---|
| Paper | `#f6f1e7` |
| Pressed ink | `#3f3a33` |
| Gold | `#a8813f` |
| Titles | Libre Caslon Text (serif) |
| UI text | Source Sans 3 |
| Buttons | pill "tags", 1.5px dashed border, letter-spaced small caps |

Fixed furniture, present on every screen — **do not redesign these**: a sticky
app bar (crown mark, screen title, settings gear) and a bottom nav of three
items — Play · Quest · Cabinet.

Every quest reskins the game; the house structure stays constant.

## 2. The quest

**The Clockwork Post.** A letter travels up through a Victorian sorting house by
pneumatic tube, from the front-door slot to the postmaster's desk in the loft.
On the way it passes four **sorting halls**, each yielding one part of a brass
letter scale. All four parts assemble the keepsake.

- **30 levels** — 12 easy, 13 medium, 5 hard. Deliberately gentler than the
  game's space quest: somewhere to go on a tired evening.
- **Sorting halls at levels 6, 13, 20 and 27**; finale at level 30, "The Golden
  Scale". The halls and the finale are the only hard boards.
- **Rooms**, in order up the building: Intake (levels 1–8), Sorting floor
  (9–16), Franking room (17–23), Poste restante (24–30). The four halls sit
  inside those rooms as their own space.
- **Level names**, in three bands:
  - *Intake* — The Slot, Doormat, Wicker Basket, First Sort, Franking Bench,
    Ink Well, Pigeonhole, Twine Drawer, Blotter
  - *Sorting* — Ledger Row, Sealing Wax, Nightshift, Counter Six, Registered
    Post, Airmail, Parcel Chute, Bell Pull, The Weighbridge
  - *Upper* — Poste Restante, The Loft, Undeliverable, Cobweb Row, Return to
    Sender, Last Collection, The Postmaster, Final Round, The Golden Scale
- **Stars**: 1–3 per level, earned on move economy — solve within 1 wasted move
  for three stars, within 6 for two. Shown as three small marks under each stop
  on the map, empty until earned.

## 3. Colours — treat as fixed

These are already in the build and were chosen by a validator (see §6). Design
**around** them; proposing different ones wastes your entry.

- **Map, dim loft at top down to lamplight at the foot**:
  `#191309` → `#221a10` → `#2e2416` → `#3d2e1c` → `#513c26`
- **Route travelled** brass `#c9a24a`; **route ahead** `#8d7a5e`
- **Highlights / dust** `#e8dcc0`, `#cfc0a0`, `#f2e8d0`
- **Chrome on dark**: text `#f4ead6`, muted `#a8977d`
- **Five rooms**, each with its own board background and queen glyph:

| Room | Background | Glyph |
|---|---|---|
| `intake` | `#2c2118 → #3a2c1e` | ✉ |
| `sorting` | `#241d16 → #322820` | ◈ |
| `franking` | `#2a1614 → #38201c` | ✱ |
| `restante` | `#1e2018 → #2a2c22` | ✒ |
| `hall` (sorting halls) | flat `#20180f` | ✜ |

## 4. What already exists, and what I want beaten

Two of the four surfaces are **done and shipping**. I am showing you them so you
can match their level, not redo them.

- ✅ **Keepsake artwork** — a brass letter scale under a glass dome on a dark
  wooden base, engraved plaque beneath. Matches an existing keepsake (a brass
  orrery under a dome) so the two read as a matched set in a collector's
  cabinet. Shipping as a real image.
- ✅ **Part marks** — pan, beam, poise weight, base, as four simple line SVGs on
  a 24×24 grid. They render at ~16px inside a 34px circle. Improve them only if
  you can do so obviously and cheaply.

The two below are the actual job.

### 4a. The quest map — beat what I built

A vertical scrolling scene, roughly 2800px tall, rendered procedurally. The
current build looks like this:

- The route is a **pneumatic tube**: it runs in one of two vertical lanes and
  jogs across at right angles every four stops, drawn as a thick pipe with a
  lighter core and a brass **coupling** at each bend. Behind the player it is
  brass; ahead it is dull grey.
- **Storeys**: a floor plate crosses the full width every few stops. Where the
  route passes into a new room the plate carries the room name in small caps.
- **Stops** come in three sizes — an ordinary level is a small perforated
  **stamp** sitting on the tube; every fifth level is a **parcel**, twine cross
  and paper ticket; a sorting hall is a **franking counter**, two benches and a
  press with a lever. Finished stops light up; the finale carries a wax seal.
- **Wall fittings** placed clear of the tube: pigeonhole racks, shelves of
  parcels, pendant lamps with their light pools, clock faces, letters drifting.
- **Ends**: a lamplit letter slot and doormat at the foot; a loft at the top
  with a pigeonhole wall, the postmaster's desk, a ledger and a lamp, with the
  tube running up into it.
- The player's marker is an envelope travelling the route; a canister
  occasionally whisks past in the background.

**What I want from you.** Not a reskin of the above — a better *composition*.
The failure mode I have already hit twice is a map that reads as "objects
floating in a void along a winding path", which looks like outer space no
matter what colour it is painted. A building is not a void. Specifically:

1. **What tells the player they are climbing?** Right now: floor plates. Is
   there something better — a stairwell, a lift shaft, a wall that changes
   character floor by floor?
2. **How should a sorting hall differ from an ordinary stop** so that it reads
   as "this one is hard and worth something" at a glance, at 375px wide?
3. **Where do the three stars go** under each stop without cluttering the wall?
4. **How does the room change announce itself** as the player scrolls past?
5. **Does the tube read as the route**, or should the route be something else
   entirely (a stairwell, a chute, a conveyor) with the tube as scenery?

Give me the scene in a **flat, top-to-bottom scroll strip** I can read as one
image, plus a detail sheet of the three stop types in all four states —
**locked, current, done, and done-with-three-stars**.

### 4b. The five playfield rooms — nothing exists yet

**This is the most valuable half of the brief.** Today each of the five rooms is
a flat colour gradient behind the board. Nobody has designed them.

The board is a square grid sitting in the middle at ~92% of screen width. Board
sizes: 7×7 and 8×8 for easy, 9×9 for medium, 10×10 for hard. Above it: a timer,
and Undo · Hint · Clear tags. Below: a one-line rule reminder and, very faint, a
board reference code.

Design the **room around the board** for each of the five. Panel lines, a shelf
edge, lamplight falling from one side, a pigeonhole wall behind, the lip of a
counter — enough to say *you are somewhere* without competing with the puzzle.

Constraints that matter here:
- The board must stay the brightest, highest-contrast thing on screen.
- Nothing may sit within ~8px of the board's edge or read as part of the grid.
- Room decoration lives in the margins: the strip above the board, the strip
  below, and the ~4% either side. Assume the board fills the middle.
- The five must be recognisably one building — a family, not five wallpapers.

Deliverable: five screens, each showing the full play screen with a board in
place, so I can see the decoration against a real grid rather than an empty box.

## 5. Hard constraints — do not change

- Portrait phone only. No horizontal scrolling. Respect iOS safe areas.
- **Region colours on the board are gameplay information, not decoration.** They
  are fixed by a validator that measures every pair of regions for perceptual
  separation under normal vision and simulated protanopia, deuteranopia and
  tritanopia. Do not restyle them, recolour them, or add texture over them.
- Board geometry is fixed: square cells, heavy lines between colour regions,
  hairlines within them. Two marks only — a queen glyph and a neutral ×.
- Touch targets ≥ 44px.
- Nothing may obscure the board during play.
- Keep the app bar, the bottom nav, the tag buttons and the two typefaces
  exactly as they are.

## 6. What is actually implementable — read this, it decides the winner

The map and the rooms are **drawn in code** — CSS gradients, borders, box
shadows and small inline SVG — not from image files. A quest ships as a few
kilobytes of JSON and must work offline. So:

- **Your map and room illustrations are references, not shipped assets.** I
  rebuild them procedurally. A strong idea in three shapes and two colours is
  worth more to me than a beautifully rendered scene I cannot build.
- Fine texture, photographic detail, hand-painted lighting, per-level bespoke
  artwork: **cannot ship**. If your design depends on them, it loses.
- Anything you propose should survive the question *"can this be made from
  rectangles, circles, gradients, and a path?"*
- Where you do want something specific, **say it in numbers** — this bar is 14px
  tall, this plate spans the full width, this glow is a 130px radial at 16%
  opacity. Numbers get built. Vibes get approximated.
- The one exception is the keepsake image, which ships as a real picture — and
  that one is already done.

## 7. How this will be judged

Two tools are getting this brief. I am scoring on, in order:

1. **Does the map stop reading as space?** Composition first, ornament second.
2. **Is it buildable from primitives?** See §6. Specificity beats polish.
3. **Do the five rooms read as one building** while staying out of the board's way?
4. **Do the stop states read at a glance** — locked vs current vs done vs
   three-starred — on a 375px-wide screen at arm's length.
5. **Warmth.** The game must not feel cartoonish and must not feel sterile. This
   is a gift, not a product.

Answer §4a's five questions in words as well as pictures. A short written
rationale carries real weight — if I can understand *why* the composition works,
I can rebuild it faithfully, and that is the whole point.
