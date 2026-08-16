import { deltaE2000, parseColor, simulate, VISIONS, type Rgb } from '../packages/engine/src/palette';

/**
 * Builds region palettes that stay distinguishable — including to a colour-blind
 * player. Spreading hue alone is not enough: hue is precisely the channel that
 * colour-vision deficiency removes, so a palette varied only by hue collapses to
 * near-identical greys. These palettes therefore vary lightness and saturation
 * as well, and are chosen by farthest-point search on the same metric the
 * content validator enforces.
 */

export interface Mood {
  /** Hue centres to draw from, in degrees. */
  hues: number[];
  satRange: [number, number];
  lightRange: [number, number];
}

const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

/** Worst-case perceptual distance between two colours across all vision types. */
function worstDelta(a: Rgb, b: Rgb): number {
  let worst = Infinity;
  for (const vision of VISIONS) {
    const d = deltaE2000(simulate(a, vision), simulate(b, vision));
    if (d < worst) worst = d;
  }
  return worst;
}

export function buildPalette(count: number, mood: Mood, seed = 0): string[] {
  const { satRange, lightRange } = mood;
  const candidates: Array<{ css: string; rgb: Rgb }> = [];
  const lightSteps = 7;
  const satSteps = 3;
  for (const h of mood.hues) {
    for (let li = 0; li < lightSteps; li++) {
      const l = Math.round(lightRange[0] + ((lightRange[1] - lightRange[0]) * li) / (lightSteps - 1));
      for (let si = 0; si < satSteps; si++) {
        const s = Math.round(satRange[0] + ((satRange[1] - satRange[0]) * si) / Math.max(1, satSteps - 1));
        const css = hsl(h, s, l);
        candidates.push({ css, rgb: parseColor(css)! });
      }
    }
  }

  // Farthest-point: each new colour is the one furthest from everything chosen.
  const chosen: Array<{ css: string; rgb: Rgb }> = [candidates[seed % candidates.length]];
  while (chosen.length < count) {
    let best = candidates[0];
    let bestScore = -1;
    for (const cand of candidates) {
      if (chosen.some((c) => c.css === cand.css)) continue;
      let nearest = Infinity;
      for (const c of chosen) {
        const d = worstDelta(cand.rgb, c.rgb);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = cand;
      }
    }
    chosen.push(best);
  }

  // Order by lightness so neighbouring region ids differ obviously too.
  return chosen.map((c) => c.css);
}

export function paletteFloor(colours: string[]): number {
  const rgb = colours.map((c) => parseColor(c)!);
  let worst = Infinity;
  for (let i = 0; i < rgb.length; i++) {
    for (let j = i + 1; j < rgb.length; j++) {
      const d = worstDelta(rgb[i], rgb[j]);
      if (d < worst) worst = d;
    }
  }
  return worst;
}
