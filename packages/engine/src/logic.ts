import type { Difficulty, Puzzle, Step, UnitRef } from './types';

/**
 * Logical solver: solves puzzles the way a human does, using named deduction
 * techniques in escalating tiers. Used for difficulty grading (the tier a board
 * requires) and for hints (the next step from any position).
 *
 * Tier 1 (easy):   forced placement — a row/col/region with one candidate left.
 * Tier 2 (medium): confinement — a region confined to one row/col (or vice versa)
 *                  eliminates the rest of that line/region; and forcing — a cell
 *                  that conflicts with every possible placement of some unit.
 * Tier 3 (hard):   hypothesis — place a queen speculatively, propagate tiers 1-2,
 *                  and eliminate the cell if it leads to contradiction.
 */

interface LState {
  n: number;
  regions: number[];
  cand: boolean[];
  queens: boolean[];
  rowQ: boolean[];
  colQ: boolean[];
  regQ: boolean[];
  placed: number;
}

const UNIT_TYPES: UnitRef['type'][] = ['row', 'col', 'region'];

function newState(puzzle: Puzzle): LState {
  const n = puzzle.size;
  return {
    n,
    regions: puzzle.regions,
    cand: new Array<boolean>(n * n).fill(true),
    queens: new Array<boolean>(n * n).fill(false),
    rowQ: new Array<boolean>(n).fill(false),
    colQ: new Array<boolean>(n).fill(false),
    regQ: new Array<boolean>(n).fill(false),
    placed: 0,
  };
}

function cloneState(s: LState): LState {
  return {
    n: s.n,
    regions: s.regions,
    cand: s.cand.slice(),
    queens: s.queens.slice(),
    rowQ: s.rowQ.slice(),
    colQ: s.colQ.slice(),
    regQ: s.regQ.slice(),
    placed: s.placed,
  };
}

/** True if queens at a and b cannot coexist (row, col, region, or diagonal touch). */
function conflicts(s: LState, a: number, b: number): boolean {
  const n = s.n;
  const ra = Math.floor(a / n);
  const ca = a % n;
  const rb = Math.floor(b / n);
  const cb = b % n;
  if (ra === rb || ca === cb) return true;
  if (s.regions[a] === s.regions[b]) return true;
  return Math.abs(ra - rb) === 1 && Math.abs(ca - cb) === 1;
}

function placeQueen(s: LState, cell: number): void {
  s.queens[cell] = true;
  s.placed++;
  const n = s.n;
  s.rowQ[Math.floor(cell / n)] = true;
  s.colQ[cell % n] = true;
  s.regQ[s.regions[cell]] = true;
  for (let i = 0; i < n * n; i++) {
    if (s.cand[i] && (i === cell || conflicts(s, cell, i))) s.cand[i] = false;
  }
}

function unitHasQueen(s: LState, type: UnitRef['type'], index: number): boolean {
  return type === 'row' ? s.rowQ[index] : type === 'col' ? s.colQ[index] : s.regQ[index];
}

function unitCandidates(s: LState, type: UnitRef['type'], index: number): number[] {
  const n = s.n;
  const out: number[] = [];
  if (type === 'row') {
    for (let c = 0; c < n; c++) if (s.cand[index * n + c]) out.push(index * n + c);
  } else if (type === 'col') {
    for (let r = 0; r < n; r++) if (s.cand[r * n + index]) out.push(r * n + index);
  } else {
    for (let i = 0; i < n * n; i++) if (s.regions[i] === index && s.cand[i]) out.push(i);
  }
  return out;
}

function hasContradiction(s: LState): boolean {
  for (const type of UNIT_TYPES) {
    for (let i = 0; i < s.n; i++) {
      if (!unitHasQueen(s, type, i) && unitCandidates(s, type, i).length === 0) return true;
    }
  }
  return false;
}

function findForced(s: LState): { cell: number; unit: UnitRef } | null {
  for (const type of UNIT_TYPES) {
    for (let i = 0; i < s.n; i++) {
      if (unitHasQueen(s, type, i)) continue;
      const cands = unitCandidates(s, type, i);
      if (cands.length === 1) return { cell: cands[0], unit: { type, index: i } };
    }
  }
  return null;
}

function findConfinement(s: LState): { cells: number[]; unit: UnitRef } | null {
  const n = s.n;
  for (let g = 0; g < n; g++) {
    if (s.regQ[g]) continue;
    const cands = unitCandidates(s, 'region', g);
    if (cands.length < 2) continue;
    const rows = new Set(cands.map((i) => Math.floor(i / n)));
    if (rows.size === 1) {
      const r = Math.floor(cands[0] / n);
      const cells = unitCandidates(s, 'row', r).filter((i) => s.regions[i] !== g);
      if (cells.length) return { cells, unit: { type: 'region', index: g } };
    }
    const cols = new Set(cands.map((i) => i % n));
    if (cols.size === 1) {
      const c = cands[0] % n;
      const cells = unitCandidates(s, 'col', c).filter((i) => s.regions[i] !== g);
      if (cells.length) return { cells, unit: { type: 'region', index: g } };
    }
  }
  for (const type of ['row', 'col'] as const) {
    for (let i = 0; i < n; i++) {
      if (unitHasQueen(s, type, i)) continue;
      const cands = unitCandidates(s, type, i);
      if (cands.length < 2) continue;
      const regs = new Set(cands.map((x) => s.regions[x]));
      if (regs.size === 1) {
        const g = s.regions[cands[0]];
        const inUnit = new Set(cands);
        const cells = unitCandidates(s, 'region', g).filter((x) => !inUnit.has(x));
        if (cells.length) return { cells, unit: { type, index: i } };
      }
    }
  }
  return null;
}

function findForcing(s: LState): { cells: number[]; unit: UnitRef } | null {
  const n = s.n;
  for (const type of UNIT_TYPES) {
    for (let i = 0; i < n; i++) {
      if (unitHasQueen(s, type, i)) continue;
      const cands = unitCandidates(s, type, i);
      if (cands.length < 2) continue;
      const inUnit = new Set(cands);
      const eliminated: number[] = [];
      for (let d = 0; d < n * n; d++) {
        if (!s.cand[d] || inUnit.has(d)) continue;
        if (cands.every((c) => conflicts(s, c, d))) eliminated.push(d);
      }
      if (eliminated.length) return { cells: eliminated, unit: { type, index: i } };
    }
  }
  return null;
}

/** Propagate tiers 1-2 inside a simulation until solved, stuck, or contradiction. */
function simulate(sim: LState): boolean {
  let guard = 4 * sim.n * sim.n;
  while (guard-- > 0) {
    if (hasContradiction(sim)) return true;
    if (sim.placed === sim.n) return false;
    const f = findForced(sim);
    if (f) {
      placeQueen(sim, f.cell);
      continue;
    }
    const conf = findConfinement(sim);
    if (conf) {
      for (const x of conf.cells) sim.cand[x] = false;
      continue;
    }
    const forc = findForcing(sim);
    if (forc) {
      for (const x of forc.cells) sim.cand[x] = false;
      continue;
    }
    return false;
  }
  return false;
}

function findHypothesis(s: LState): { cells: number[] } | null {
  const n = s.n;
  for (let c = 0; c < n * n; c++) {
    if (!s.cand[c]) continue;
    const sim = cloneState(s);
    placeQueen(sim, c);
    if (simulate(sim)) return { cells: [c] };
  }
  return null;
}

export interface LogicResult {
  solved: boolean;
  tier: 0 | 1 | 2 | 3;
  steps: Step[];
  queens: number[];
}

export interface SolveOptions {
  queens?: number[];
  eliminated?: number[];
  stopAfterFirstStep?: boolean;
}

export function solveLogically(puzzle: Puzzle, options: SolveOptions = {}): LogicResult {
  const s = newState(puzzle);
  for (const q of options.queens ?? []) placeQueen(s, q);
  for (const e of options.eliminated ?? []) s.cand[e] = false;
  const steps: Step[] = [];
  let tier = 0;
  const n = puzzle.size;
  let guard = 8 * n * n;
  while (s.placed < n && guard-- > 0) {
    if (hasContradiction(s)) break;
    const f = findForced(s);
    if (f) {
      steps.push({ kind: 'place', cell: f.cell, unit: f.unit, technique: 'forced' });
      placeQueen(s, f.cell);
      tier = Math.max(tier, 1);
      if (options.stopAfterFirstStep) break;
      continue;
    }
    const conf = findConfinement(s);
    if (conf) {
      steps.push({ kind: 'eliminate', cells: conf.cells, technique: 'confinement', unit: conf.unit });
      for (const x of conf.cells) s.cand[x] = false;
      tier = Math.max(tier, 2);
      if (options.stopAfterFirstStep) break;
      continue;
    }
    const forc = findForcing(s);
    if (forc) {
      steps.push({ kind: 'eliminate', cells: forc.cells, technique: 'forcing', unit: forc.unit });
      for (const x of forc.cells) s.cand[x] = false;
      tier = Math.max(tier, 2);
      if (options.stopAfterFirstStep) break;
      continue;
    }
    const hyp = findHypothesis(s);
    if (hyp) {
      steps.push({ kind: 'eliminate', cells: hyp.cells, technique: 'hypothesis' });
      for (const x of hyp.cells) s.cand[x] = false;
      tier = Math.max(tier, 3);
      if (options.stopAfterFirstStep) break;
      continue;
    }
    break;
  }
  const queens: number[] = [];
  for (let i = 0; i < n * n; i++) if (s.queens[i]) queens.push(i);
  return { solved: s.placed === n, tier: tier as LogicResult['tier'], steps, queens };
}

export function difficultyForTier(tier: number): Difficulty {
  return tier <= 1 ? 'easy' : tier === 2 ? 'medium' : 'hard';
}
