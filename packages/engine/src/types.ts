export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Puzzle {
  size: number;
  /** regions[row * size + col] = region id in 0..size-1 */
  regions: number[];
}

export const EMPTY = 0;
export const X = 1;
export const QUEEN = 2;
export type Mark = typeof EMPTY | typeof X | typeof QUEEN;

export interface GeneratedPuzzle {
  puzzle: Puzzle;
  /** solution[row] = column of the queen in that row */
  solution: number[];
  difficulty: Difficulty;
  seed: number;
  id: string;
}

export type Technique = 'forced' | 'confinement' | 'forcing' | 'hypothesis';

export interface UnitRef {
  type: 'row' | 'col' | 'region';
  index: number;
}

export interface PlaceStep {
  kind: 'place';
  cell: number;
  unit: UnitRef;
  technique: Technique;
}

export interface ElimStep {
  kind: 'eliminate';
  cells: number[];
  technique: Technique;
  unit?: UnitRef;
}

export type Step = PlaceStep | ElimStep;

export type Hint =
  | { kind: 'mistake'; cell: number; reason: 'wrong-queen' | 'wrong-x' }
  | { kind: 'step'; step: Step }
  | { kind: 'complete' };
