import type { Difficulty } from './types';
import { countSolutions } from './count';
import { solveLogically, difficultyForTier } from './logic';
import { regionsContiguous, validateSolution } from './board';

/** Bumped whenever the content format changes; old apps skip content they don't understand. */
export const CONTENT_SCHEMA_VERSION = 1;

export interface PlayfieldVariantDef {
  id: string;
  /** CSS background for the play screen (color or gradient). */
  background: string;
  boardLine: string;
  /** Cycled by region id; must cover the largest board in the tournament. */
  regionPalette: string[];
  queenGlyph: string;
  queenColor: string;
  xColor: string;
  chromeColor: string;
  chromeSoft: string;
}

/** Decoration for the journey map. The layout is generated; the theme paints it. */
export interface MapThemeDef {
  /** Vertical gradient stops, top (far) to bottom (home). */
  sky: string[];
  /** Ambient cloud washes; rgba strings. */
  nebulas: string[];
  starColors: string[];
  pathBehind: string;
  pathAhead: string;
  /** Colour triples (light, mid, dark) cycled across ordinary nodes. */
  bodyPalettes: string[][];
  lockedPalette: string[];
  currentPalette: string[];
  /** The origin body at the foot of the map. */
  homePalette: string[];
  finalGlyph: string;
  /** Deep-field decoration. */
  galaxyColor?: string;
  /**
   * Enables an occasional drifting streak across the field, in this colour.
   * Omit for themes where it makes no sense — a garden has no comets.
   */
  cometColor?: string;
  /**
   * What travels the route. Omit for the built-in rocket; give a glyph for
   * quests where a rocket would be absurd — a letter through a sorting house.
   */
  vehicleGlyph?: string;
  /**
   * Which set of shapes the map draws with. 'orbital' is planets, stations and
   * a deep field; 'interior' is a building — stamps, parcels, counters, clock
   * faces, tube runs. Recolouring one to look like the other never convinces.
   */
  style?: 'orbital' | 'interior';
  constellationColor?: string;
  asteroidColor?: string;
}

export interface ThemeDef {
  id: string;
  name: string;
  defaultVariant: string;
  variants: PlayfieldVariantDef[];
  map?: MapThemeDef;
}

export interface LevelDef {
  index: number;
  name: string;
  size: number;
  regions: number[];
  solution: number[];
  difficulty: Difficulty;
  special?: boolean;
  /** Which collectible part this level awards (special levels only). */
  partIndex?: number;
  variant?: string;
  seed?: number;
}

export interface CollectibleDef {
  name: string;
  partGlyphs: string[];
  /**
   * Optional line art per part, as SVG path data on a 24x24 grid, drawn with a
   * stroke. Falls back to partGlyphs where absent, so older content still works.
   */
  partPaths?: string[];
  /** Path to the keepsake artwork, relative to the content root. */
  art?: string;
}

export interface StarRuleDef {
  /**
   * Metric family. 'moves' counts queen placements + removals + hints used
   * against a par of one placement per row; X notes are free.
   */
  metric: 'moves';
  /** Maximum overhead over par for three stars. */
  three: number;
  /** Maximum overhead over par for two stars (completion alone is one star). */
  two: number;
}

/** Stars for a given overhead over par. */
export function starsForOverhead(rule: StarRuleDef, overhead: number): 1 | 2 | 3 {
  if (overhead <= rule.three) return 3;
  if (overhead <= rule.two) return 2;
  return 1;
}

/** Stars earned for a completed level under a star rule. */
export function scoreStars(
  rule: StarRuleDef,
  queenActions: number,
  hintsUsed: number,
  size: number,
): 1 | 2 | 3 {
  return starsForOverhead(rule, queenActions + hintsUsed - size);
}

/**
 * The least overhead still reachable from a position mid-solve — every queen
 * yet to be placed costs at least one more move. Placing a queen leaves this
 * unchanged, removing one costs two, and a hint costs one, so it never falls:
 * a rating shown from it can only slip, never quietly improve. On a solved
 * board every queen is placed, so it equals the final overhead exactly.
 */
export function overheadFloor(
  queenActions: number,
  hintsUsed: number,
  queensPlaced: number,
): number {
  return queenActions + hintsUsed - queensPlaced;
}

export interface TournamentDef {
  schemaVersion: number;
  id: string;
  name: string;
  version: number;
  goal: string;
  setup: {
    levelCount: number;
    specialLevels: number[];
    partCount: number;
    stars?: StarRuleDef;
  };
  collectible: CollectibleDef;
  theme: ThemeDef;
  levels: LevelDef[];
}

/**
 * Full content validation: setup consistency plus, per level, contiguity,
 * solution validity, uniqueness, logic-solvability, and honest difficulty.
 * Returns a list of problems; empty means the tournament is shippable.
 */
export function validateTournament(t: TournamentDef): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  if (t.schemaVersion !== CONTENT_SCHEMA_VERSION) {
    err(`schemaVersion ${t.schemaVersion} != ${CONTENT_SCHEMA_VERSION}`);
  }
  if (t.setup.levelCount !== t.levels.length) {
    err(`setup.levelCount ${t.setup.levelCount} != levels.length ${t.levels.length}`);
  }
  if (t.setup.partCount !== t.collectible.partGlyphs.length) {
    err(`setup.partCount ${t.setup.partCount} != partGlyphs.length ${t.collectible.partGlyphs.length}`);
  }
  if (t.setup.stars) {
    const s = t.setup.stars;
    if (s.metric !== 'moves') err(`unknown star metric ${(s as { metric: string }).metric}`);
    if (s.three < 0) err(`stars.three must be >= 0, got ${s.three}`);
    if (s.two < s.three) err(`stars.two (${s.two}) must be >= stars.three (${s.three})`);
  }
  const specials = new Set(t.setup.specialLevels);
  if (specials.size !== t.setup.specialLevels.length) err('specialLevels contains duplicates');
  for (const s of specials) {
    if (s < 0 || s >= t.levels.length) err(`special level index ${s} out of range`);
  }
  const partIndexes = new Set<number>();
  const variantIds = new Set(t.theme.variants.map((v) => v.id));
  if (!variantIds.has(t.theme.defaultVariant)) {
    err(`defaultVariant ${t.theme.defaultVariant} not among variants`);
  }

  t.levels.forEach((level, i) => {
    const at = `level ${i} (${level.name})`;
    if (level.index !== i) err(`${at}: index ${level.index} != position ${i}`);
    const isSpecial = specials.has(i);
    if (!!level.special !== isSpecial) err(`${at}: special flag disagrees with setup.specialLevels`);
    if (isSpecial) {
      if (level.partIndex === undefined) err(`${at}: special level missing partIndex`);
      else if (level.partIndex < 0 || level.partIndex >= t.setup.partCount) {
        err(`${at}: partIndex ${level.partIndex} out of range`);
      } else if (partIndexes.has(level.partIndex)) err(`${at}: duplicate partIndex ${level.partIndex}`);
      else partIndexes.add(level.partIndex);
    } else if (level.partIndex !== undefined) {
      err(`${at}: non-special level has partIndex`);
    }
    const variant = level.variant ?? t.theme.defaultVariant;
    if (!variantIds.has(variant)) err(`${at}: unknown variant ${variant}`);
    const v = t.theme.variants.find((x) => x.id === variant);
    if (v && v.regionPalette.length < level.size) {
      err(`${at}: variant ${variant} palette has ${v.regionPalette.length} colours for size ${level.size}`);
    }

    const puzzle = { size: level.size, regions: level.regions };
    if (level.regions.length !== level.size * level.size) {
      err(`${at}: regions length ${level.regions.length} != ${level.size * level.size}`);
      return;
    }
    if (!regionsContiguous(puzzle)) err(`${at}: regions not contiguous`);
    if (!validateSolution(puzzle, level.solution)) err(`${at}: stored solution invalid`);
    if (countSolutions(puzzle, 2) !== 1) err(`${at}: solution not unique`);
    const res = solveLogically(puzzle);
    if (!res.solved) err(`${at}: not solvable by logic alone`);
    else {
      const graded = difficultyForTier(Math.max(1, res.tier));
      if (graded !== level.difficulty) {
        err(`${at}: graded ${graded} but declared ${level.difficulty}`);
      }
    }
    const isFinal = i === t.levels.length - 1;
    if ((isSpecial || isFinal) && level.difficulty !== 'hard') {
      err(`${at}: special/final levels must be hard, got ${level.difficulty}`);
    }
  });

  if (partIndexes.size !== t.setup.partCount) {
    err(`parts assigned (${partIndexes.size}) != partCount (${t.setup.partCount})`);
  }
  return errors;
}
