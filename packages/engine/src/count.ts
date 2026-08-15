import type { Puzzle } from './types';

/** Count solutions by backtracking row by row, stopping once `limit` is reached. */
export function countSolutions(puzzle: Puzzle, limit = 2): number {
  const { size, regions } = puzzle;
  const usedCol = new Array<boolean>(size).fill(false);
  const usedReg = new Array<boolean>(size).fill(false);
  let count = 0;
  const dfs = (row: number, prevCol: number): void => {
    if (count >= limit) return;
    if (row === size) {
      count++;
      return;
    }
    for (let c = 0; c < size; c++) {
      if (usedCol[c]) continue;
      if (prevCol >= 0 && Math.abs(prevCol - c) === 1) continue;
      const g = regions[row * size + c];
      if (usedReg[g]) continue;
      usedCol[c] = true;
      usedReg[g] = true;
      dfs(row + 1, c);
      usedCol[c] = false;
      usedReg[g] = false;
      if (count >= limit) return;
    }
  };
  dfs(0, -1);
  return count;
}

export function firstSolution(puzzle: Puzzle): number[] | null {
  const { size, regions } = puzzle;
  const usedCol = new Array<boolean>(size).fill(false);
  const usedReg = new Array<boolean>(size).fill(false);
  const cols: number[] = [];
  const dfs = (row: number): boolean => {
    if (row === size) return true;
    for (let c = 0; c < size; c++) {
      if (usedCol[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) === 1) continue;
      const g = regions[row * size + c];
      if (usedReg[g]) continue;
      usedCol[c] = true;
      usedReg[g] = true;
      cols.push(c);
      if (dfs(row + 1)) return true;
      usedCol[c] = false;
      usedReg[g] = false;
      cols.pop();
    }
    return false;
  };
  return dfs(0) ? cols : null;
}
