import { solveLogically } from './logic';
import { QUEEN, X, type GeneratedPuzzle, type Hint } from './types';

/**
 * The next hint for the player's current board. Mistakes are surfaced before
 * anything else; otherwise the logical solver runs from the player's position
 * (their queens placed, their X marks treated as eliminations) and returns the
 * next deducible step. The UI decides how much of the step to reveal (tiered
 * hints: nudge at the unit, then the reasoning, then the cells).
 */
export function nextHint(
  gen: Pick<GeneratedPuzzle, 'puzzle' | 'solution'>,
  marks: ArrayLike<number>,
): Hint {
  const { puzzle, solution } = gen;
  const n = puzzle.size;
  const solutionCells = new Set(solution.map((c, r) => r * n + c));
  for (let i = 0; i < n * n; i++) {
    if (marks[i] === QUEEN && !solutionCells.has(i)) return { kind: 'mistake', cell: i, reason: 'wrong-queen' };
    if (marks[i] === X && solutionCells.has(i)) return { kind: 'mistake', cell: i, reason: 'wrong-x' };
  }
  const queens: number[] = [];
  const eliminated: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (marks[i] === QUEEN) queens.push(i);
    else if (marks[i] === X) eliminated.push(i);
  }
  if (queens.length === n) return { kind: 'complete' };
  const res = solveLogically(puzzle, { queens, eliminated, stopAfterFirstStep: true });
  if (res.steps.length) return { kind: 'step', step: res.steps[0] };
  // Fallback (should not occur on valid puzzles): reveal an unplaced solution cell.
  for (const cell of solutionCells) {
    if (marks[cell] !== QUEEN) {
      return {
        kind: 'step',
        step: { kind: 'place', cell, unit: { type: 'row', index: Math.floor(cell / n) }, technique: 'forced' },
      };
    }
  }
  return { kind: 'complete' };
}
