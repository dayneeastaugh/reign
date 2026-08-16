import { describe, it, expect } from 'vitest';
import {
  generatePuzzle,
  countSolutions,
  solveLogically,
  difficultyForTier,
  nextHint,
  validateSolution,
  regionsContiguous,
  EMPTY,
  X,
  QUEEN,
  type Difficulty,
  type Puzzle,
} from '../src/index';

function toPuzzle(rows: string[]): Puzzle {
  const size = rows.length;
  const letters = new Map<string, number>();
  const regions = rows
    .join('')
    .split('')
    .map((ch) => {
      if (!letters.has(ch)) letters.set(ch, letters.size);
      return letters.get(ch)!;
    });
  return { size, regions };
}

const KNOWN = toPuzzle(['AABBB', 'ACCBB', 'ACDBB', 'EEDDB', 'EEDDD']);

describe('board validation', () => {
  it('accepts a known valid solution', () => {
    expect(validateSolution(KNOWN, [0, 2, 4, 1, 3])).toBe(true);
    expect(regionsContiguous(KNOWN)).toBe(true);
  });

  it('rejects duplicate columns, duplicate regions, and diagonal touches', () => {
    expect(validateSolution(KNOWN, [0, 2, 4, 1, 1])).toBe(false);
    expect(validateSolution(KNOWN, [0, 1, 4, 2, 3])).toBe(false);
    expect(validateSolution(KNOWN, [0, 2, 4, 3, 1])).toBe(false);
  });

  it('finds at least one solution on the known board', () => {
    expect(countSolutions(KNOWN, 10)).toBeGreaterThanOrEqual(1);
  });
});

describe('generator', () => {
  const cases: Array<[Difficulty, number[]]> = [
    ['easy', [11, 22, 33]],
    ['medium', [11, 22]],
    ['hard', [11]],
  ];
  for (const [difficulty, seeds] of cases) {
    for (const seed of seeds) {
      it(`generates a valid, unique, logic-solvable ${difficulty} puzzle (seed ${seed})`, () => {
        const g = generatePuzzle({ difficulty, seed });
        expect(regionsContiguous(g.puzzle)).toBe(true);
        expect(validateSolution(g.puzzle, g.solution)).toBe(true);
        expect(countSolutions(g.puzzle, 2)).toBe(1);
        const res = solveLogically(g.puzzle);
        expect(res.solved).toBe(true);
        expect(difficultyForTier(Math.max(1, res.tier))).toBe(difficulty);
        const solved = res.queens.sort((a, b) => a - b);
        const expected = g.solution.map((c, r) => r * g.puzzle.size + c).sort((a, b) => a - b);
        expect(solved).toEqual(expected);
      });
    }
  }

  it('is deterministic for the same seed', () => {
    const a = generatePuzzle({ difficulty: 'easy', seed: 5 });
    const b = generatePuzzle({ difficulty: 'easy', seed: 5 });
    expect(a.puzzle.regions).toEqual(b.puzzle.regions);
    expect(a.solution).toEqual(b.solution);
    expect(a.id).toBe(b.id);
  });
});

describe('property sweep', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    it(`holds all invariants across 10 ${difficulty} seeds`, () => {
      for (let seed = 1000; seed < 1010; seed++) {
        const g = generatePuzzle({ difficulty, seed });
        expect(regionsContiguous(g.puzzle), `contiguity seed ${seed}`).toBe(true);
        expect(validateSolution(g.puzzle, g.solution), `solution seed ${seed}`).toBe(true);
        expect(countSolutions(g.puzzle, 2), `uniqueness seed ${seed}`).toBe(1);
        const res = solveLogically(g.puzzle);
        expect(res.solved, `logic-solvable seed ${seed}`).toBe(true);
        expect(difficultyForTier(Math.max(1, res.tier)), `grade seed ${seed}`).toBe(difficulty);
      }
    });
  }
});

describe('region quality', () => {
  const floors: Array<[Difficulty, number]> = [
    ['medium', 3],
    ['hard', 3],
  ];
  for (const [difficulty, floor] of floors) {
    it(`never generates a ${difficulty} region smaller than ${floor} cells`, () => {
      for (let seed = 4000; seed < 4006; seed++) {
        const g = generatePuzzle({ difficulty, seed });
        const counts = new Array<number>(g.puzzle.size).fill(0);
        for (const region of g.puzzle.regions) counts[region]++;
        expect(Math.min(...counts), `seed ${seed} smallest region`).toBeGreaterThanOrEqual(floor);
      }
    });
  }
});

describe('hints', () => {
  it('flags a wrong queen before anything else', () => {
    const g = generatePuzzle({ difficulty: 'easy', seed: 3 });
    const n = g.puzzle.size;
    const solutionCells = new Set(g.solution.map((c, r) => r * n + c));
    const marks = new Array<number>(n * n).fill(EMPTY);
    let wrong = -1;
    for (let i = 0; i < n * n; i++) {
      if (!solutionCells.has(i)) {
        wrong = i;
        break;
      }
    }
    marks[wrong] = QUEEN;
    const hint = nextHint(g, marks);
    expect(hint.kind).toBe('mistake');
    if (hint.kind === 'mistake') {
      expect(hint.cell).toBe(wrong);
      expect(hint.reason).toBe('wrong-queen');
    }
  });

  it('flags an X sitting on a solution queen', () => {
    const g = generatePuzzle({ difficulty: 'easy', seed: 4 });
    const n = g.puzzle.size;
    const marks = new Array<number>(n * n).fill(EMPTY);
    const queenCell = g.solution[0] /* col */ + 0 * n;
    marks[queenCell] = X;
    const hint = nextHint(g, marks);
    expect(hint.kind).toBe('mistake');
    if (hint.kind === 'mistake') expect(hint.reason).toBe('wrong-x');
  });

  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    it(`walks the player to the full solution on a ${difficulty} board`, () => {
      const g = generatePuzzle({ difficulty, seed: 7 });
      const n = g.puzzle.size;
      const marks = new Array<number>(n * n).fill(EMPTY);
      let done = false;
      for (let i = 0; i < 1000 && !done; i++) {
        const hint = nextHint(g, marks);
        if (hint.kind === 'complete') {
          done = true;
          break;
        }
        expect(hint.kind).toBe('step');
        if (hint.kind !== 'step') return;
        if (hint.step.kind === 'place') marks[hint.step.cell] = QUEEN;
        else for (const c of hint.step.cells) marks[c] = X;
      }
      expect(done).toBe(true);
      const queens = [];
      for (let i = 0; i < n * n; i++) if (marks[i] === QUEEN) queens.push(i);
      const expected = g.solution.map((c, r) => r * n + c).sort((a, b) => a - b);
      expect(queens.sort((a, b) => a - b)).toEqual(expected);
    });
  }
});
