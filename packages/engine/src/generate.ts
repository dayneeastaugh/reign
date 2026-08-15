import { mulberry32, shuffle, randInt, type Rng } from './rng';
import { countSolutions } from './count';
import { solveLogically } from './logic';
import type { Difficulty, GeneratedPuzzle, Puzzle } from './types';

const TIER_FOR: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const SIZES: Record<Difficulty, number[]> = { easy: [7, 8], medium: [9], hard: [10, 11] };
const MAX_ATTEMPTS = 8000;

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function randomQueens(size: number, rnd: Rng): number[] | null {
  const cols: number[] = [];
  const usedCol = new Array<boolean>(size).fill(false);
  const bt = (row: number): boolean => {
    if (row === size) return true;
    const order = shuffle(Array.from({ length: size }, (_, i) => i), rnd);
    for (const c of order) {
      if (usedCol[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) === 1) continue;
      usedCol[c] = true;
      cols.push(c);
      if (bt(row + 1)) return true;
      usedCol[c] = false;
      cols.pop();
    }
    return false;
  };
  return bt(0) ? cols : null;
}

/** Grow regions outward from each queen with a randomized flood fill; always contiguous. */
function growRegions(size: number, queenCols: number[], rnd: Rng): number[] {
  const regions = new Array<number>(size * size).fill(-1);
  for (let r = 0; r < size; r++) regions[r * size + queenCols[r]] = r;
  let unassigned = size * size - size;
  while (unassigned > 0) {
    const frontier: Array<[number, number]> = [];
    for (let i = 0; i < size * size; i++) {
      if (regions[i] < 0) continue;
      const r = Math.floor(i / size);
      const c = i % size;
      for (const [dr, dc] of ORTHO) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const ni = nr * size + nc;
        if (regions[ni] < 0) frontier.push([ni, regions[i]]);
      }
    }
    const [cell, g] = frontier[randInt(rnd, frontier.length)];
    regions[cell] = g;
    unassigned--;
  }
  return regions;
}

/** First valid solution differing from `target`, or null if the solution is unique. */
function findAltSolution(size: number, regions: number[], target: number[]): number[] | null {
  const usedCol = new Array<boolean>(size).fill(false);
  const usedReg = new Array<boolean>(size).fill(false);
  const cols: number[] = [];
  let found: number[] | null = null;
  const dfs = (row: number): void => {
    if (found) return;
    if (row === size) {
      if (cols.some((c, r) => c !== target[r])) found = cols.slice();
      return;
    }
    for (let c = 0; c < size; c++) {
      if (usedCol[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) === 1) continue;
      const g = regions[row * size + c];
      if (usedReg[g]) continue;
      usedCol[c] = true;
      usedReg[g] = true;
      cols.push(c);
      dfs(row + 1);
      usedCol[c] = false;
      usedReg[g] = false;
      cols.pop();
      if (found) return;
    }
  };
  dfs(0);
  return found;
}

function regionStillContiguous(size: number, regions: number[], g: number): boolean {
  const cells: number[] = [];
  for (let i = 0; i < size * size; i++) if (regions[i] === g) cells.push(i);
  if (cells.length === 0) return false;
  const inRegion = new Set(cells);
  const seen = new Set<number>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const cur = stack.pop()!;
    const r = Math.floor(cur / size);
    const c = cur % size;
    for (const [dr, dc] of ORTHO) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const ni = nr * size + nc;
      if (inRegion.has(ni) && !seen.has(ni)) {
        seen.add(ni);
        stack.push(ni);
      }
    }
  }
  return seen.size === cells.length;
}

/**
 * Random blob regions on larger boards almost never yield a unique solution, so
 * we repair: while an alternative solution exists, move one of its queen cells
 * into an adjacent region (which the alternative must also cover, so it gains a
 * second queen there and dies) while the intended solution — whose queen cells
 * are never touched — stays valid. Contiguity is preserved by construction for
 * the growing region and re-checked for the shrinking one.
 */
function repairToUnique(size: number, regions: number[], target: number[], rnd: Rng): boolean {
  const maxRepairs = 3 * size;
  for (let k = 0; k < maxRepairs; k++) {
    const alt = findAltSolution(size, regions, target);
    if (!alt) return true;
    const rows = shuffle(
      Array.from({ length: size }, (_, r) => r).filter((r) => alt[r] !== target[r]),
      rnd,
    );
    let repaired = false;
    for (const r of rows) {
      const b = r * size + alt[r];
      const gOld = regions[b];
      const neighbors = new Set<number>();
      const rr = Math.floor(b / size);
      const cc = b % size;
      for (const [dr, dc] of ORTHO) {
        const nr = rr + dr;
        const nc = cc + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const g = regions[nr * size + nc];
        if (g !== gOld) neighbors.add(g);
      }
      for (const g of shuffle([...neighbors], rnd)) {
        regions[b] = g;
        if (regionStillContiguous(size, regions, gOld)) {
          repaired = true;
          break;
        }
        regions[b] = gOld;
      }
      if (repaired) break;
    }
    if (!repaired) return false;
  }
  return findAltSolution(size, regions, target) === null;
}

/**
 * Generate a puzzle with exactly one solution, solvable by logic alone, whose
 * required technique tier matches the requested difficulty. Deterministic per seed.
 */
export function generatePuzzle(opts: { difficulty: Difficulty; seed: number }): GeneratedPuzzle {
  const { difficulty, seed } = opts;
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sizes = SIZES[difficulty];
    const size = sizes[randInt(rnd, sizes.length)];
    const solution = randomQueens(size, rnd);
    if (!solution) continue;
    const regions = growRegions(size, solution, rnd);
    if (!repairToUnique(size, regions, solution, rnd)) continue;
    const puzzle: Puzzle = { size, regions };
    if (countSolutions(puzzle, 2) !== 1) continue;
    const res = solveLogically(puzzle);
    if (!res.solved) continue;
    if (Math.max(1, res.tier) !== TIER_FOR[difficulty]) continue;
    return { puzzle, solution, difficulty, seed, id: `${difficulty}-${size}-${seed}` };
  }
  throw new Error(`Could not generate a ${difficulty} puzzle for seed ${seed} within ${MAX_ATTEMPTS} attempts`);
}
