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

export interface ThemeDef {
  id: string;
  name: string;
  defaultVariant: string;
  variants: PlayfieldVariantDef[];
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
