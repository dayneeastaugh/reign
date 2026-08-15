---
name: Reign
colors:
  surface: '#fef9ef'
  surface-dim: '#dedad0'
  surface-bright: '#fef9ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3e9'
  surface-container: '#f2ede3'
  surface-container-high: '#ede8de'
  surface-container-highest: '#e7e2d8'
  on-surface: '#1d1c16'
  on-surface-variant: '#4b463f'
  inverse-surface: '#32302a'
  inverse-on-surface: '#f5f0e6'
  outline: '#7d766e'
  outline-variant: '#cec5bc'
  surface-tint: '#635d56'
  primary: '#29251e'
  on-primary: '#ffffff'
  primary-container: '#3f3a33'
  on-primary-container: '#aba49a'
  inverse-primary: '#cec5bb'
  secondary: '#745b1f'
  on-secondary: '#ffffff'
  secondary-container: '#fedc93'
  on-secondary-container: '#785f23'
  tertiary: '#242529'
  on-tertiary: '#ffffff'
  tertiary-container: '#3a3a3f'
  on-tertiary-container: '#a5a4aa'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eae1d7'
  primary-fixed-dim: '#cec5bb'
  on-primary-fixed: '#1f1b15'
  on-primary-fixed-variant: '#4b463f'
  secondary-fixed: '#ffdf9c'
  secondary-fixed-dim: '#e4c27c'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#5a4308'
  tertiary-fixed: '#e4e1e8'
  tertiary-fixed-dim: '#c7c5cc'
  on-tertiary-fixed: '#1b1b20'
  on-tertiary-fixed-variant: '#46464b'
  background: '#fef9ef'
  on-background: '#1d1c16'
  surface-variant: '#e7e2d8'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 42px
    fontWeight: '700'
    lineHeight: 48px
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Source Sans 3
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-sm:
    fontFamily: Source Sans 3
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Source Sans 3
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  margin-edge: 20px
  gutter: 12px
  board-padding: 8px
---

## Brand & Style
The design system for this mobile logic game is rooted in the **Letterpress** aesthetic—a tactile, high-end stationery experience that feels like physically manipulated paper and ink. The brand personality is scholarly yet approachable, evoking the quiet concentration of a library or a luxury board game room.

The design style is **Tactile / Skeuomorphic**, utilizing subtle inner shadows to simulate debossing (letterpress) and soft drop shadows to simulate layered paper (die-cutting). Every interaction should feel like a physical object being placed or pressed onto high-quality stock.

## Colors
The color system operates on two distinct planes: the standard "Study" mode and the "Tournament" mode.

- **Base (Light):** Uses "Paper" as the canvas and "Ink" for primary contrast. "Raised Paper" is used for elements that sit above the board, while "Ink" elements should appear slightly recessed into the page.
- **Tournament (Dark):** Shifts to "The Grand Orbit." This utilizes a vertical gradient from the horizon to deep space. UI elements here transition to "Cream" text and "Gold" accents to simulate celestial navigation tools.
- **Gameplay:** A palette of 11 dusty, desaturated tones used for the N×N grid regions. These colors must always maintain a high enough contrast ratio against the "Ink" borders.

## Typography
The typography strategy pairings a sophisticated, literary serif with a functional, neutral sans-serif.

- **Libre Caslon Text:** Used for all "Display" and "Headline" roles. It carries the weight of the brand, appearing as if printed by a physical press. In headers, use `letter-spacing: -0.02em`.
- **Source Sans 3:** Used for all functional UI text, instructions, and settings. It provides clarity against the textured backgrounds.
- **Styling:** Headings in the light mode should use "Ink" (#3F3A33) with a subtle `text-shadow: 0px 1px 0px rgba(255,255,255,0.5)` to simulate the light catching the edge of a debossed letter.

## Layout & Spacing
This design system utilizes a **Fixed Grid** for the main menu and cabinet areas, and a **Fluid Aspect-Ratio** container for the game board to ensure it remains perfectly square on all mobile devices.

- **The Cabinet:** Uses a vertical stack with "shelves" spaced at 120px intervals.
- **The Board:** Centered with a 20px margin from the screen edges. 
- **Grid Rhythm:** All spacing is based on a 4px baseline. Components like "Tags" use 12px horizontal padding and 8px vertical padding.

## Elevation & Depth
Elevation is not achieved through high-contrast shadows, but through **Paper Stacking** and **Debossing**:

- **Level 0 (The Table):** The background "Paper" texture.
- **Level 1 (The Board):** Slightly recessed. Use an `inner-shadow` (1px, 2px, blur 4px) to make the board look like it is pressed into the paper.
- **Level 2 (The Tags/Buttons):** Raised. Use a soft, wide-spread shadow (0px 4px 10px rgba(63, 58, 51, 0.1)) to simulate thick cardstock.
- **Level 3 (Overlays/Glass Jars):** High elevation. Use a light blue-tinted background blur (12px) with a 1px white "glint" border to simulate glass.

## Shapes
The shape language balances geometric precision with hand-finished softness.

- **Pills:** All interactive "Tag" buttons use full-round caps (Pill shape).
- **The Board:** The main grid container has a subtle 8px radius.
- **The Regions:** Individual grid cells remain sharp (0px) where they meet other cells to ensure the region borders look continuous and hand-drawn.

## Components

### Tag Buttons
- **Shape:** Pill-shaped.
- **Border:** 1.5px dashed "Ink" or "Deep Gold" border to simulate stitching.
- **State:** When pressed, the button scales down to 0.96 and the shadow disappears, simulating the button being pushed flat against the paper.

### The Game Board
- **Regions:** Each region is filled with a color from the Gameplay Palette.
- **Borders:** Thick 3px "Ink" borders between different color regions. Thin 0.5px "Soft Ink" hairlines between cells of the same color.
- **Symbols:** 
  - **Crown (♛):** Placed with a "Scale-Settle" animation. It should appear slightly textured, like an ink stamp with a bit of "noise" or opacity variation.
  - **Mark (×):** Rendered in "Soft Ink," appearing as a light pencil or faint stamp mark.

### The Cabinet
- **Shelves:** Horizontal wooden textures (dark grain).
- **Glass Bell Jars:** High-gloss overlays with a circular base. Items inside appear slightly magnified via a CSS `backdrop-filter: scale(1.05)`.
- **Engraved Plaques:** Small rectangular elements with the `inner-shadow` deboss effect, using "Gold Accent" text.

### Motion & Feedback
- **Rubber-Stamp Effect:** When a Crown is placed, it starts at 1.5x scale and "slams" down to 1.0x with a slight bounce (overshoot), accompanied by a haptic tap.
- **Paper Shift:** Transitions between screens should use a "Slide" that looks like a sheet of paper being pulled off the top of a stack.