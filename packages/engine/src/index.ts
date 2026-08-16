export * from './types';
export { mulberry32, shuffle, randInt, type Rng } from './rng';
export { cellIndex, rowOf, colOf, validateSolution, regionsContiguous } from './board';
export { countSolutions, firstSolution } from './count';
export { solveLogically, difficultyForTier, type LogicResult, type SolveOptions } from './logic';
export { generatePuzzle } from './generate';
export { nextHint } from './hints';
export {
  checkPalette,
  requiredDelta,
  deltaE2000,
  contrastRatio,
  parseColor,
  simulate,
  VISIONS,
  DEFAULT_LIMITS,
  type Vision,
  type PaletteInput,
  type PaletteLimits,
} from './palette';
export {
  CONTENT_SCHEMA_VERSION,
  validateTournament,
  scoreStars,
  starsForOverhead,
  overheadFloor,
  type StarRuleDef,
  type MapThemeDef,
  type PlayfieldVariantDef,
  type ThemeDef,
  type LevelDef,
  type CollectibleDef,
  type TournamentDef,
} from './content';
