import {
  generatePuzzle,
  nextHint,
  scoreStars,
  EMPTY,
  X,
  QUEEN,
  type Difficulty,
  type GeneratedPuzzle,
  type Hint,
  type PlayfieldVariantDef,
  type TournamentDef,
  type UnitRef,
} from '@reign/engine';
import { sound } from './sound';
import { loadLocalQuests, syncContent } from './content';

export type View = 'quick' | 'orbitHome' | 'orbitPlay' | 'cabinet' | 'settings';
import { CONTENT_SCHEMA_VERSION } from '@reign/engine';
import {
  kvGet,
  kvSet,
  kvDel,
  addResult,
  exportBackup,
  importBackup,
  resetAll,
  DEFAULT_SETTINGS,
  type SavedGame,
  type Settings,
} from './db';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
const UNDO_LIMIT = 200;

const REGION_NAMES = [
  'rose',
  'sage',
  'ochre',
  'slate',
  'mauve',
  'terracotta',
  'seafoam',
  'olive',
  'lilac',
  'sand',
  'denim',
];

/**
 * Hint stages. 'verdict' answers only "are my ♛ in the right places?" without
 * revealing where; 'locate' points at the unit or the mistake; 'detail' shows
 * the exact cells. A further press applies the step.
 */
export interface ActiveHint {
  hint: Hint;
  stage: 'verdict' | 'locate' | 'detail';
  /** Whether this session opened with a verdict, so depth pips stay stable. */
  hadVerdict: boolean;
}

interface UndoEntry {
  marks: number[];
  auto: boolean[];
}

export class AppState {
  ready = $state(false);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  difficulty = $state<Difficulty>('easy');
  game = $state<GeneratedPuzzle | null>(null);
  marks = $state<number[]>([]);
  elapsed = $state(0);
  paused = $state(false);
  undoDepth = $state(0);
  hintsUsed = $state(0);
  activeHint = $state<ActiveHint | null>(null);
  view = $state<View>('quick');
  sessionMode = $state<'quick' | 'tournament'>('quick');
  levelIndex = $state(0);
  orbitProgress = $state<{ completed: number[]; stars: Record<string, number> }>({
    completed: [],
    stars: {},
  });
  /** Queen placements + removals this session — the star metric's move count. */
  queenActions = $state(0);
  /** Stars earned for the level just solved (tournament only). */
  lastStars = $state<number | null>(null);

  /** Which × marks were placed by auto-mark, so they can be withdrawn again. */
  autoCells = $state<boolean[]>([]);

  /** Quests held on the device, and which one is being played. */
  quests = $state<TournamentDef[]>([]);
  activeQuestId = $state<string | null>(null);
  /** Ids that arrived or changed on the last content sync. */
  questNews = $state<string[]>([]);

  private undoStack: UndoEntry[] = [];
  private resultRecorded = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  quest = $derived.by((): TournamentDef | null => {
    if (!this.quests.length) return null;
    return this.quests.find((q) => q.id === this.activeQuestId) ?? this.quests[0];
  });

  questLevels = $derived(this.quest?.levels ?? []);

  n = $derived(this.game?.puzzle.size ?? 0);

  queenCells = $derived(this.marks.flatMap((m, i) => (m === QUEEN ? [i] : [])));

  hasMarks = $derived(this.marks.some((m) => m !== EMPTY));

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
    const [settings, saved, quests] = await Promise.all([
      kvGet<Settings>('settings'),
      kvGet<SavedGame>('current'),
      loadLocalQuests(),
    ]);
    if (settings) this.settings = { ...DEFAULT_SETTINGS, ...settings };
    sound.setEnabled(this.settings.sound);
    this.quests = quests;
    this.activeQuestId = (await kvGet<string>('activeQuest')) ?? quests[0]?.id ?? null;
    const progress = await kvGet<{ completed: number[]; stars?: Record<string, number> }>(
      `tournament:${this.questId}`,
    );
    if (progress) {
      const stars = progress.stars ?? {};
      // Levels completed before stars existed keep the completion star.
      for (const i of progress.completed) stars[i] ??= 1;
      this.orbitProgress = { completed: progress.completed, stars };
    }
    const resumable =
      saved && saved.marks.filter((m) => m === QUEEN).length < saved.game.puzzle.size;
    if (
      resumable &&
      saved.mode === 'tournament' &&
      saved.tournamentId === this.questId &&
      saved.levelIndex !== undefined &&
      saved.levelIndex < this.questLevels.length
    ) {
      this.sessionMode = 'tournament';
      this.levelIndex = saved.levelIndex;
      this.game = saved.game;
      this.marks = saved.marks;
      this.autoCells = saved.autoCells ?? new Array(saved.marks.length).fill(false);
      this.elapsed = saved.elapsed;
      this.queenActions = saved.queenActions ?? 0;
      this.view = 'orbitPlay';
    } else if (resumable) {
      this.game = saved.game;
      this.marks = saved.marks;
      this.autoCells = saved.autoCells ?? new Array(saved.marks.length).fill(false);
      this.elapsed = saved.elapsed;
      this.difficulty = saved.game.difficulty;
    } else {
      this.newGame(this.difficulty);
    }
    this.ready = true;
    setInterval(() => this.tick(), 1000);
    void this.refreshContent();
  }

  get questId(): string {
    return this.quest?.id ?? 'none';
  }

  /**
   * Pull newly published quests in the background. Failure is silent and
   * harmless — the device keeps playing what it already holds.
   */
  async refreshContent(): Promise<void> {
    try {
      const result = await syncContent($state.snapshot(this.quests), CONTENT_SCHEMA_VERSION);
      const changed = [...result.added, ...result.updated];
      if (!changed.length) return;
      this.quests = await loadLocalQuests();
      this.questNews = result.added;
    } catch {
      /* offline, or the site is unreachable; try again next launch */
    }
  }

  async selectQuest(id: string): Promise<void> {
    if (id === this.activeQuestId) return;
    this.activeQuestId = id;
    await kvSet('activeQuest', id);
    const progress = await kvGet<{ completed: number[]; stars?: Record<string, number> }>(
      `tournament:${id}`,
    );
    const stars = progress?.stars ?? {};
    for (const i of progress?.completed ?? []) stars[i] ??= 1;
    this.orbitProgress = { completed: progress?.completed ?? [], stars };
    this.questNews = this.questNews.filter((q) => q !== id);
    this.view = 'orbitHome';
  }

  /** First level not yet completed — the frontier of the journey. */
  currentOrbitIndex = $derived.by(() => {
    const done = new Set(this.orbitProgress.completed);
    for (let i = 0; i < this.questLevels.length; i++) if (!done.has(i)) return i;
    return Math.max(0, this.questLevels.length - 1);
  });

  partsEarned = $derived(
    new Set(
      this.orbitProgress.completed
        .map((i) => this.questLevels[i]?.partIndex)
        .filter((p): p is number => p !== undefined),
    ),
  );

  currentLevel = $derived(
    this.sessionMode === 'tournament' ? (this.questLevels[this.levelIndex] ?? null) : null,
  );

  orbitComplete = $derived(
    this.questLevels.length > 0 && this.orbitProgress.completed.length === this.questLevels.length,
  );

  totalStars = $derived(
    Object.values(this.orbitProgress.stars).reduce((sum, s) => sum + s, 0),
  );

  variant = $derived.by((): PlayfieldVariantDef | null => {
    if (this.view === 'quick' || this.view === 'cabinet' || this.view === 'settings') return null;
    const theme = this.quest?.theme;
    if (!theme) return null;
    const id =
      this.view === 'orbitPlay' && this.currentLevel
        ? (this.currentLevel.variant ?? theme.defaultVariant)
        : theme.defaultVariant;
    return theme.variants.find((v) => v.id === id) ?? null;
  });

  startOrbitLevel(idx: number): void {
    const level = this.questLevels[idx];
    if (!level) return;
    const unlocked = idx <= this.currentOrbitIndex || this.orbitProgress.completed.includes(idx);
    if (!unlocked) return;
    this.sessionMode = 'tournament';
    this.levelIndex = idx;
    this.game = {
      puzzle: { size: level.size, regions: level.regions },
      solution: level.solution,
      difficulty: level.difficulty,
      seed: level.seed ?? 0,
      // 1-based so a reported code matches the level number the player sees.
      id: `${this.questId}-L${idx + 1}`,
    };
    this.marks = new Array(level.size * level.size).fill(EMPTY);
    this.autoCells = new Array(level.size * level.size).fill(false);
    this.elapsed = 0;
    this.paused = false;
    this.undoStack = [];
    this.undoDepth = 0;
    this.hintsUsed = 0;
    this.queenActions = 0;
    this.lastStars = null;
    this.activeHint = null;
    this.resultRecorded = false;
    this.view = 'orbitPlay';
    this.persistSoon();
  }

  starsFor(levelIdx: number): number {
    return this.orbitProgress.stars[levelIdx] ?? 0;
  }

  private completeOrbitLevel(): void {
    const rule = this.quest?.setup.stars;
    const stars = rule
      ? scoreStars(rule, this.queenActions, this.hintsUsed, this.game!.puzzle.size)
      : 1;
    this.lastStars = stars;
    const prev = this.orbitProgress.stars[this.levelIndex] ?? 0;
    if (stars > prev) this.orbitProgress.stars[this.levelIndex] = stars;
    if (!this.orbitProgress.completed.includes(this.levelIndex)) {
      this.orbitProgress.completed.push(this.levelIndex);
    }
    void kvSet(`tournament:${this.questId}`, $state.snapshot(this.orbitProgress));
  }

  nextOrbitLevel(): void {
    if (this.levelIndex + 1 < this.questLevels.length) this.startOrbitLevel(this.levelIndex + 1);
    else this.view = 'orbitHome';
  }

  goQuick(): void {
    if (this.sessionMode !== 'quick') {
      this.sessionMode = 'quick';
      this.newGame(this.difficulty);
    }
    this.view = 'quick';
  }

  goOrbitHome(): void {
    this.view = 'orbitHome';
  }

  goCabinet(): void {
    this.view = 'cabinet';
  }

  goSettings(): void {
    this.view = 'settings';
  }

  /** Downloads progress as a JSON file; on iOS this opens the share sheet. */
  async downloadBackup(): Promise<void> {
    const json = await exportBackup();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reign-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async restoreBackup(file: File): Promise<void> {
    await importBackup(await file.text());
    location.reload();
  }

  async resetEverything(): Promise<void> {
    await resetAll();
    location.reload();
  }

  newGame(d: Difficulty = this.difficulty): void {
    this.sessionMode = 'quick';
    this.difficulty = d;
    this.game = generatePuzzle({ difficulty: d, seed: randomSeed() });
    this.marks = new Array(this.game.puzzle.size ** 2).fill(EMPTY);
    this.autoCells = new Array(this.game.puzzle.size ** 2).fill(false);
    this.elapsed = 0;
    this.paused = false;
    this.undoStack = [];
    this.undoDepth = 0;
    this.hintsUsed = 0;
    this.activeHint = null;
    this.resultRecorded = false;
    this.persistSoon();
  }

  private pushUndo(): void {
    this.undoStack.push({
      marks: $state.snapshot(this.marks),
      auto: $state.snapshot(this.autoCells),
    });
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.undoDepth = this.undoStack.length;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.marks = prev.marks;
    this.autoCells = prev.auto;
    this.undoDepth = this.undoStack.length;
    sound.lift();
    this.activeHint = null;
    this.persistSoon();
  }

  tap(i: number): void {
    if (!this.game || this.solved || this.paused) return;
    if (i < 0 || i >= this.marks.length) return;
    this.pushUndo();
    const prev = this.marks[i];
    const next = (prev + 1) % 3;
    this.marks[i] = next;
    // A tap makes the cell the player's own, so auto-mark no longer owns it.
    this.autoCells[i] = false;
    if (next === QUEEN || prev === QUEEN) this.queenActions++;
    if (next === QUEEN && this.settings.autoX) this.autoX(i);
    if (prev === QUEEN) this.withdrawAutoX();
    if (next === QUEEN) sound.queen();
    else if (next === X) sound.mark();
    else sound.lift();
    this.activeHint = null;
    this.afterChange();
  }

  /** Wipes the board back to empty without changing puzzle, timer or moves. */
  clearBoard(): void {
    if (!this.game || this.solved || this.paused) return;
    if (!this.marks.some((m) => m !== EMPTY)) return;
    this.pushUndo();
    this.marks = new Array(this.n * this.n).fill(EMPTY);
    this.autoCells = new Array(this.n * this.n).fill(false);
    this.activeHint = null;
    sound.sweep();
    this.afterChange();
  }

  /** Start of a drag stroke: one undo entry for the whole stroke. */
  beginPaint(): void {
    if (!this.game || this.solved || this.paused) return;
    this.pushUndo();
    this.activeHint = null;
  }

  paintX(i: number): void {
    if (!this.game || this.solved || this.paused) return;
    if (i < 0 || i >= this.marks.length) return;
    if (this.marks[i] === EMPTY) {
      this.marks[i] = X;
      this.autoCells[i] = false;
      sound.mark();
      this.afterChange();
    }
  }

  /** True if a ♛ on `queenCell` rules out `cell`. */
  private covers(queenCell: number, cell: number): boolean {
    if (queenCell === cell) return true;
    const n = this.n;
    const { regions } = this.game!.puzzle;
    const qr = Math.floor(queenCell / n);
    const qc = queenCell % n;
    const r = Math.floor(cell / n);
    const c = cell % n;
    return (
      qr === r ||
      qc === c ||
      regions[cell] === regions[queenCell] ||
      (Math.abs(qr - r) === 1 && Math.abs(qc - c) === 1)
    );
  }

  /**
   * Withdraw auto-placed × marks that no remaining ♛ rules out. Called after a
   * ♛ is removed so auto-mark undoes itself as cleanly as it applied.
   */
  private withdrawAutoX(): void {
    if (!this.game) return;
    const queens = this.marks.flatMap((m, i) => (m === QUEEN ? [i] : []));
    for (let i = 0; i < this.marks.length; i++) {
      if (!this.autoCells[i] || this.marks[i] !== X) continue;
      if (!queens.some((q) => this.covers(q, i))) {
        this.marks[i] = EMPTY;
        this.autoCells[i] = false;
      }
    }
  }

  private cellsOfUnit(unit: UnitRef): number[] {
    const n = this.n;
    const out: number[] = [];
    if (unit.type === 'row') for (let c = 0; c < n; c++) out.push(unit.index * n + c);
    else if (unit.type === 'col') for (let r = 0; r < n; r++) out.push(r * n + unit.index);
    else {
      const { regions } = this.game!.puzzle;
      for (let i = 0; i < n * n; i++) if (regions[i] === unit.index) out.push(i);
    }
    return out;
  }

  private unitName(unit: UnitRef): string {
    if (unit.type === 'row') return `row ${unit.index + 1}`;
    if (unit.type === 'col') return `column ${unit.index + 1}`;
    const g = unit.index;
    return `the ${REGION_NAMES[g % REGION_NAMES.length]} region`;
  }

  /** Cells to spotlight for the current hint stage. A verdict reveals nothing. */
  hintCells = $derived.by(() => {
    const active = this.activeHint;
    if (!active || active.stage === 'verdict') return new Set<number>();
    const { hint, stage } = active;
    if (hint.kind === 'mistake') return new Set([hint.cell]);
    if (hint.kind !== 'step') return new Set<number>();
    const step = hint.step;
    if (stage === 'locate' && 'unit' in step && step.unit) return new Set(this.cellsOfUnit(step.unit));
    return new Set(step.kind === 'place' ? [step.cell] : step.cells);
  });

  hintIsMistake = $derived(
    this.activeHint?.hint.kind === 'mistake' && this.activeHint.stage !== 'verdict',
  );

  hintText = $derived.by(() => {
    const active = this.activeHint;
    if (!active) return '';
    const { hint, stage } = active;

    if (stage === 'verdict') {
      return hint.kind === 'mistake'
        ? hint.reason === 'wrong-queen'
          ? 'One of your ♛ isn’t in the right place. Tap Hint again to find it.'
          : 'A ♛ belongs on one of the cells you’ve crossed off. Tap Hint again to find it.'
        : 'Every ♛ you’ve placed is right so far. Tap Hint again for a nudge.';
    }

    if (hint.kind === 'complete') return 'The board is already solved.';
    if (hint.kind === 'mistake') {
      return hint.reason === 'wrong-queen'
        ? 'This ♛ can’t be right. Tap Hint again to remove it.'
        : 'A ♛ actually belongs under this ×. Tap Hint again to clear it.';
    }
    const step = hint.step;
    const where = 'unit' in step && step.unit ? this.unitName(step.unit) : 'the marked cells';
    const apply = ' Tap Hint again to apply.';
    if (step.kind === 'place') {
      return stage === 'locate'
        ? `Look at ${where} — only one cell can hold its ♛.`
        : `The ♛ of ${where} is forced onto this cell.` + apply;
    }
    switch (step.technique) {
      case 'confinement':
        return stage === 'locate'
          ? `Every option for ${where} sits on one line.`
          : `Because ${where} is pinned to one line, these cells can be crossed off.` + apply;
      case 'forcing':
        return stage === 'locate'
          ? `Wherever the ♛ of ${where} lands, some cells are always attacked.`
          : `Every placement in ${where} attacks these cells — cross them off.` + apply;
      default:
        return stage === 'locate'
          ? 'One cell here leads to a dead end if you try a ♛ on it.'
          : 'A ♛ on this cell leads to a dead end — cross it off.' + apply;
    }
  });

  /** How deep the player is in the current hint, for the depth pips. */
  hintProgress = $derived.by(() => {
    const a = this.activeHint;
    if (!a) return null;
    const hasDetail =
      a.hint.kind === 'step' && 'unit' in a.hint.step && a.hint.step.unit !== undefined;
    const total = (a.hadVerdict ? 1 : 0) + 1 + (hasDetail ? 1 : 0);
    const order: ActiveHint['stage'][] = ['verdict', 'locate', 'detail'];
    const step = order.indexOf(a.stage) + (a.hadVerdict ? 1 : 0);
    return { step: Math.max(1, step), total };
  });

  requestHint(): void {
    if (!this.game || this.solved || this.paused) return;
    sound.hint();
    const active = this.activeHint;
    if (!active) {
      const hint = nextHint(this.game, $state.snapshot(this.marks));
      // With nothing placed there is nothing to vouch for, so skip the verdict.
      const anyQueens = this.queenCells.length > 0;
      // Checking your own ♛ is free; only revealing counts against the score.
      if (!anyQueens) this.hintsUsed++;
      this.activeHint = { hint, stage: anyQueens ? 'verdict' : 'locate', hadVerdict: anyQueens };
      return;
    }
    const { hint, stage } = active;
    if (stage === 'verdict') {
      this.hintsUsed++;
      this.activeHint = { ...active, stage: 'locate' };
      return;
    }
    if (hint.kind === 'complete') {
      this.activeHint = null;
      return;
    }
    if (hint.kind === 'mistake') {
      this.pushUndo();
      const wasQueen = this.marks[hint.cell] === QUEEN;
      if (wasQueen) this.queenActions++;
      this.marks[hint.cell] = EMPTY;
      this.autoCells[hint.cell] = false;
      if (wasQueen) this.withdrawAutoX();
      this.activeHint = null;
      this.afterChange();
      return;
    }
    const step = hint.step;
    const hasUnitStage = 'unit' in step && step.unit !== undefined;
    if (stage === 'locate' && hasUnitStage) {
      this.activeHint = { ...active, stage: 'detail' };
      return;
    }
    this.pushUndo();
    if (step.kind === 'place') {
      this.marks[step.cell] = QUEEN;
      this.queenActions++;
      if (this.settings.autoX) this.autoX(step.cell);
    } else {
      for (const c of step.cells) if (this.marks[c] === EMPTY) this.marks[c] = X;
    }
    this.activeHint = null;
    this.afterChange();
  }

  private autoX(queenCell: number): void {
    for (let i = 0; i < this.marks.length; i++) {
      if (this.marks[i] !== EMPTY) continue;
      if (this.covers(queenCell, i)) {
        this.marks[i] = X;
        this.autoCells[i] = true;
      }
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
        hintsUsed: this.hintsUsed,
        finishedAt: Date.now(),
      });
      if (this.sessionMode === 'tournament') this.completeOrbitLevel();
      if (this.sessionMode === 'tournament' && this.currentLevel?.special) sound.part();
      else sound.solved();
      void kvDel('current');
    }
  }

  togglePause(): void {
    if (this.solved) return;
    this.paused = !this.paused;
  }

  async setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    this.settings[key] = value;
    if (key === 'sound') {
      sound.setEnabled(value as boolean);
      // Let the player hear what they just switched on.
      if (value) sound.queen();
    }
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
        autoCells: $state.snapshot(this.autoCells),
        elapsed: this.elapsed,
        savedAt: Date.now(),
        mode: this.sessionMode,
        queenActions: this.queenActions,
        ...(this.sessionMode === 'tournament'
          ? { tournamentId: this.questId, levelIndex: this.levelIndex }
          : {}),
      };
      void kvSet('current', save);
    }, 300);
  }
}

export const app = new AppState();
