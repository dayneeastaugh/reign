import type { Puzzle } from './types';

export const cellIndex = (size: number, row: number, col: number): number => row * size + col;
export const rowOf = (size: number, cell: number): number => Math.floor(cell / size);
export const colOf = (size: number, cell: number): number => cell % size;

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function validateSolution(puzzle: Puzzle, solution: number[]): boolean {
  const { size, regions } = puzzle;
  if (solution.length !== size) return false;
  const cols = new Set<number>();
  const regs = new Set<number>();
  for (let r = 0; r < size; r++) {
    const c = solution[r];
    if (c < 0 || c >= size || cols.has(c)) return false;
    cols.add(c);
    const g = regions[r * size + c];
    if (regs.has(g)) return false;
    regs.add(g);
    if (r > 0 && Math.abs(solution[r - 1] - c) === 1) return false;
  }
  return true;
}

export function regionsContiguous(puzzle: Puzzle): boolean {
  const { size, regions } = puzzle;
  const seen = new Array<boolean>(size * size).fill(false);
  let components = 0;
  for (let start = 0; start < size * size; start++) {
    if (seen[start]) continue;
    components++;
    const g = regions[start];
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      const cur = stack.pop()!;
      const r = rowOf(size, cur);
      const c = colOf(size, cur);
      for (const [dr, dc] of ORTHO) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const ni = nr * size + nc;
        if (!seen[ni] && regions[ni] === g) {
          seen[ni] = true;
          stack.push(ni);
        }
      }
    }
  }
  const ids = new Set(regions);
  return components === size && ids.size === size;
}
