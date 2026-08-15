import { generatePuzzle, EMPTY, X, QUEEN, type Difficulty, type GeneratedPuzzle } from '@reign/engine';
import {
  kvGet,
  kvSet,
  kvDel,
  addResult,
  DEFAULT_SETTINGS,
  type SavedGame,
  type Settings,
} from './db';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const UNDO_LIMIT = 200;

export class AppState {
  ready = $state(false);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  difficulty = $state<Difficulty>('easy');
  game = $state<GeneratedPuzzle | null>(null);
  marks = $state<number[]>([]);
  elapsed = $state(0);
  paused = $state(false);
  undoDepth = $state(0);

  private undoStack: number[][] = [];
  private resultRecorded = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  n = $derived(this.game?.puzzle.size ?? 0);

  queenCells = $derived(this.marks.flatMap((m, i) => (m === QUEEN ? [i] : [])));

  conflicts = $derived.by(() => {
    const bad = new Set<number>();
    if (!this.game) return bad;
    const { regions } = this.game.puzzle;
    const n = this.n;
    const q = this.queenCells;
    for (let a = 0; a < q.length; a++) {
      for (let b = a + 1; b < q.length; b++) {
        const i = q[a];
        const j = q[b];
        const ri = Math.floor(i / n), ci = i % n;
        const rj = Math.floor(j / n), cj = j % n;
        const clash =
          ri === rj ||
          ci === cj ||
          regions[i] === regions[j] ||
          (Math.abs(ri - rj) === 1 && Math.abs(ci - cj) === 1);
        if (clash) {
          bad.add(i);
          bad.add(j);
        }
      }
    }
    return bad;
  });

  solved = $derived(
    this.game !== null &&
      this.queenCells.length === this.n &&
      this.conflicts.size === 0 &&
      this.game.solution.every((c, r) => this.marks[r * this.n + c] === QUEEN),
  );

  async init(): Promise<void> {
    const [settings, saved] = await Promise.all([
      kvGet<Settings>('settings'),
      kvGet<SavedGame>('current'),
    ]);
    if (settings) this.settings = { ...DEFAULT_SETTINGS, ...settings };
    const resumable =
      saved && saved.marks.filter((m) => m === QUEEN).length < saved.game.puzzle.size;
    if (resumable) {
      this.game = saved.game;
      this.marks = saved.marks;
      this.elapsed = saved.elapsed;
      this.difficulty = saved.game.difficulty;
    } else {
      this.newGame(this.difficulty);
    }
    this.ready = true;
    setInterval(() => this.tick(), 1000);
  }

  newGame(d: Difficulty = this.difficulty): void {
    this.difficulty = d;
    this.game = generatePuzzle({ difficulty: d, seed: randomSeed() });
    this.marks = new Array(this.game.puzzle.size ** 2).fill(EMPTY);
    this.elapsed = 0;
    this.paused = false;
    this.undoStack = [];
    this.undoDepth = 0;
    this.resultRecorded = false;
    this.persistSoon();
  }

  private pushUndo(): void {
    this.undoStack.push($state.snapshot(this.marks));
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.undoDepth = this.undoStack.length;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.marks = prev;
    this.undoDepth = this.undoStack.length;
    this.persistSoon();
  }

  tap(i: number): void {
    if (!this.game || this.solved || this.paused) return;
    this.pushUndo();
    const next = (this.marks[i] + 1) % 3;
    this.marks[i] = next;
    if (next === QUEEN && this.settings.autoX) this.autoX(i);
    this.afterChange();
  }

  /** Start of a drag stroke: one undo entry for the whole stroke. */
  beginPaint(): void {
    if (!this.game || this.solved || this.paused) return;
    this.pushUndo();
  }

  paintX(i: number): void {
    if (!this.game || this.solved || this.paused) return;
    if (this.marks[i] === EMPTY) {
      this.marks[i] = X;
      this.afterChange();
    }
  }

  private autoX(queenCell: number): void {
    const n = this.n;
    const { regions } = this.game!.puzzle;
    const r = Math.floor(queenCell / n);
    const c = queenCell % n;
    for (let i = 0; i < n * n; i++) {
      if (this.marks[i] !== EMPTY) continue;
      const ri = Math.floor(i / n);
      const ci = i % n;
      const covered =
        ri === r ||
        ci === c ||
        regions[i] === regions[queenCell] ||
        (Math.abs(ri - r) === 1 && Math.abs(ci - c) === 1);
      if (covered) this.marks[i] = X;
    }
  }

  private afterChange(): void {
    this.persistSoon();
    if (this.solved && !this.resultRecorded && this.game) {
      this.resultRecorded = true;
      void addResult({
        puzzleId: this.game.id,
        difficulty: this.game.difficulty,
        seconds: this.elapsed,
        finishedAt: Date.now(),
      });
      void kvDel('current');
    }
  }

  togglePause(): void {
    if (this.solved) return;
    this.paused = !this.paused;
  }

  async setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    this.settings[key] = value;
    await kvSet('settings', $state.snapshot(this.settings));
  }

  private tick(): void {
    if (!this.ready || this.paused || this.solved) return;
    if (document.visibilityState !== 'visible') return;
    this.elapsed++;
    if (this.elapsed % 5 === 0) this.persistSoon();
  }

  private persistSoon(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (!this.game || this.solved) return;
      const save: SavedGame = {
        game: $state.snapshot(this.game) as GeneratedPuzzle,
        marks: $state.snapshot(this.marks),
        elapsed: this.elapsed,
        savedAt: Date.now(),
      };
      void kvSet('current', save);
    }, 300);
  }
}

export const app = new AppState();
