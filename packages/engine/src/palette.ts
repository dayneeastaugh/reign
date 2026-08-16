/**
 * Palette legibility checks for quest themes.
 *
 * Region colour is gameplay information, not decoration: if two regions read as
 * the same colour the board becomes unsolvable in practice, however correct the
 * puzzle is. These checks run in the content pipeline so a palette that fails
 * cannot ship — including under colour-vision deficiency, which no amount of
 * careful eyeballing by a trichromat would catch.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Accepts '#rrggbb', '#rgb' and the 'hsl(H S% L%)' form used by quest content. */
export function parseColor(input: string): Rgb | null {
  const value = input.trim();

  const hsl = value.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if (hsl) {
    const h = Number(hsl[1]);
    const s = Number(hsl[2]) / 100;
    const l = Number(hsl[3]) / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
  }

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

const toLinear = (c: number): number => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

const fromLinear = (x: number): number => {
  const c = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, c * 255));
};

export function relativeLuminance(c: Rgb): number {
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

/** WCAG contrast ratio, 1:1 to 21:1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

export function rgbToLab(c: Rgb): Lab {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const b = toLinear(c.b);
  // sRGB → XYZ (D65), then XYZ → CIELAB
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * CIEDE2000 colour difference. Roughly: under 2 is imperceptible, around 10 is
 * an obvious difference, and large flat areas like board regions need more than
 * a just-noticeable gap to be told apart at a glance.
 */
export function deltaE2000(c1: Rgb, c2: Rgb): number {
  const l1 = rgbToLab(c1);
  const l2 = rgbToLab(c2);
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.hypot(l1.a, l1.b);
  const C2 = Math.hypot(l2.a, l2.b);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * l1.a;
  const a2p = (1 + G) * l2.a;
  const C1p = Math.hypot(a1p, l1.b);
  const C2p = Math.hypot(a2p, l2.b);
  const h1p = C1p === 0 ? 0 : (deg(Math.atan2(l1.b, a1p)) + 360) % 360;
  const h2p = C2p === 0 ? 0 : (deg(Math.atan2(l2.b, a2p)) + 360) % 360;

  const dLp = l2.L - l1.L;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbarp = (l1.L + l2.L) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  return Math.sqrt(
    Math.pow(dLp / (kL * Sl), 2) +
      Math.pow(dCp / (kC * Sc), 2) +
      Math.pow(dHp / (kH * Sh), 2) +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

export type Vision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

/** Machado et al. (2009) simulation matrices, applied in linear RGB. */
const CVD_MATRIX: Record<Exclude<Vision, 'normal'>, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function simulate(colour: Rgb, vision: Vision): Rgb {
  if (vision === 'normal') return colour;
  const m = CVD_MATRIX[vision];
  const r = toLinear(colour.r);
  const g = toLinear(colour.g);
  const b = toLinear(colour.b);
  return {
    r: fromLinear(m[0][0] * r + m[0][1] * g + m[0][2] * b),
    g: fromLinear(m[1][0] * r + m[1][1] * g + m[1][2] * b),
    b: fromLinear(m[2][0] * r + m[2][1] * g + m[2][2] * b),
  };
}

export const VISIONS: Vision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];

export interface PaletteLimits {
  /** Minimum contrast between a glyph and the halo drawn behind it. */
  minGlyphHaloContrast: number;
  /** Minimum contrast between the board line and the regions it separates. */
  minBoardLineContrast: number;
}

export const DEFAULT_LIMITS: PaletteLimits = {
  minGlyphHaloContrast: 4.5,
  minBoardLineContrast: 2.5,
};

/**
 * Required separation for a board of n regions, as worst-case CIEDE2000 across
 * normal and colour-blind vision.
 *
 * The figures are empirical rather than from a standard: they are the highest
 * bar the game's palettes can actually clear while staying muted, measured by
 * searching the palette space. Eleven colours cannot sit as far apart as seven,
 * hence the split — and since boards take the first n colours, small boards get
 * the best-separated ones. Both are far above the ~2 that counts as a just
 * noticeable difference, and regions are further separated by heavy board lines.
 *
 * Colour is doing all the work here, which is why a per-region pattern overlay
 * remains the proper answer for full colour-blind safety on 10-11 region boards.
 */
export function requiredDelta(regions: number): number {
  return regions <= 9 ? 9 : 7;
}

export interface PaletteInput {
  id: string;
  regionPalette: string[];
  boardLine: string;
  queenColor: string;
  xColor: string;
  /**
   * Colour drawn behind the glyphs. Quest variants halo with the board line;
   * the light base theme halos with paper, so it must be given explicitly.
   */
  haloColor?: string;
}

/**
 * Problems with a variant's palette; empty means it is safe to ship. `sizes` are
 * the board sizes this variant is used at, each checked against the prefix of
 * the palette that board would actually draw from.
 */
export function checkPalette(
  v: PaletteInput,
  sizes: number[],
  limits: PaletteLimits = DEFAULT_LIMITS,
): string[] {
  const problems: string[] = [];
  const used = v.regionPalette;
  const colours = used.map(parseColor);

  colours.forEach((c, i) => {
    if (!c) problems.push(`${v.id}: region colour ${i + 1} is not a colour (${used[i]})`);
  });
  const line = parseColor(v.boardLine);
  const halo = parseColor(v.haloColor ?? v.boardLine);
  const queen = parseColor(v.queenColor);
  const cross = parseColor(v.xColor);
  if (!line) problems.push(`${v.id}: boardLine is not a colour`);
  if (!queen) problems.push(`${v.id}: queenColor is not a colour`);
  if (!cross) problems.push(`${v.id}: xColor is not a colour`);
  if (problems.length) return problems;

  for (const size of [...new Set(sizes)].sort((a, b) => a - b)) {
    if (size > colours.length) {
      problems.push(`${v.id}: palette has ${colours.length} colours, a board needs ${size}`);
      continue;
    }
    const limit = requiredDelta(size);
    for (const vision of VISIONS) {
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          const d = deltaE2000(simulate(colours[i]!, vision), simulate(colours[j]!, vision));
          if (d < limit) {
            problems.push(
              `${v.id}: on ${size}x${size} boards, regions ${i + 1} and ${j + 1} are too alike ` +
                `under ${vision} (dE ${d.toFixed(1)}, needs ${limit})`,
            );
          }
        }
      }
    }
  }

  // Marks are drawn with a halo of the board line, so that pairing is what
  // guarantees they read on any region colour beneath them.
  const queenHalo = contrastRatio(queen!, halo ?? line!);
  if (queenHalo < limits.minGlyphHaloContrast) {
    problems.push(
      `${v.id}: queen glyph on its halo is ${queenHalo.toFixed(2)}:1, ` +
        `needs ${limits.minGlyphHaloContrast}:1`,
    );
  }
  const crossHalo = contrastRatio(cross!, halo ?? line!);
  if (crossHalo < limits.minGlyphHaloContrast) {
    problems.push(
      `${v.id}: × mark on its halo is ${crossHalo.toFixed(2)}:1, ` +
        `needs ${limits.minGlyphHaloContrast}:1`,
    );
  }

  const worstLine = Math.min(...colours.map((c) => contrastRatio(line!, c!)));
  if (worstLine < limits.minBoardLineContrast) {
    problems.push(
      `${v.id}: board line barely separates regions (${worstLine.toFixed(2)}:1, ` +
        `needs ${limits.minBoardLineContrast}:1)`,
    );
  }

  return problems;
}
