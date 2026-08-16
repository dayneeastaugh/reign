<script lang="ts">
  import { QUEEN, X, type Puzzle } from '@reign/engine';

  let {
    puzzle,
    marks,
    conflicts,
    hintCells = new Set<number>(),
    hintDanger = false,
    queenGlyph = '♛',
    onTap,
    onBeginPaint,
    onPaint,
  }: {
    puzzle: Puzzle;
    marks: number[];
    conflicts: Set<number>;
    hintCells?: Set<number>;
    hintDanger?: boolean;
    queenGlyph?: string;
    onTap: (i: number) => void;
    onBeginPaint: () => void;
    onPaint: (i: number) => void;
  } = $props();

  const n = $derived(puzzle.size);

  const FRAME = 6;
  let viewportW = $state(typeof window === 'undefined' ? 480 : window.innerWidth);

  $effect(() => {
    const onResize = () => (viewportW = window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  /** Integer cell size in CSS px — fractional 1fr tracks smear a duplicated
      sliver at the frame edge on some devicePixelRatios. */
  const cellPx = $derived(
    Math.max(24, Math.floor((Math.min(viewportW * 0.92, 480) - FRAME) / n)),
  );

  /**
   * Tap vs drag. A tap must not paint: strokes only begin once the pointer has
   * travelled past DRAG_SLOP from where it went down, so finger jitter across a
   * cell border can no longer mark neighbouring cells. The gesture is tracked by
   * pointerId and released on the window, so lifting off the board still ends it,
   * and the click-suppression flag is cleared at the start of every gesture so it
   * can never leak into the next tap.
   */
  const DRAG_SLOP = 10;

  let activePointer: number | null = null;
  let pointerDownCell = -1;
  let downX = 0;
  let downY = 0;
  let stroking = false;
  let suppressClick = false;

  function cellAt(x: number, y: number): number {
    const el = document.elementFromPoint(x, y)?.closest('.cell');
    if (!el || !(el as HTMLElement).dataset.i) return -1;
    const idx = Number((el as HTMLElement).dataset.i);
    return Number.isInteger(idx) && idx >= 0 && idx < n * n ? idx : -1;
  }

  function endGesture() {
    activePointer = null;
    pointerDownCell = -1;
    stroking = false;
  }

  $effect(() => {
    const up = (e: PointerEvent) => {
      if (activePointer === null || e.pointerId === activePointer) endGesture();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  function handlePointerDown(e: PointerEvent, i: number) {
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    pointerDownCell = i;
    downX = e.clientX;
    downY = e.clientY;
    stroking = false;
    suppressClick = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (pointerDownCell < 0 || e.pointerId !== activePointer) return;
    if (!stroking) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < DRAG_SLOP) return;
      stroking = true;
      suppressClick = true;
      onBeginPaint();
      onPaint(pointerDownCell);
    }
    const over = cellAt(e.clientX, e.clientY);
    if (over >= 0) onPaint(over);
  }

  function handleClick(i: number) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    onTap(i);
  }

  function cellStyle(i: number): string {
    const { regions } = puzzle;
    const g = regions[i];
    const r = Math.floor(i / n);
    const c = i % n;
    const parts = [`background: var(--region-${(g % 11) + 1})`];
    if (r > 0) {
      const thick = regions[i] !== regions[(r - 1) * n + c];
      parts.push(`border-top: ${thick ? '2.5px solid var(--board-line)' : '1px solid var(--board-line-soft)'}`);
    }
    if (c > 0) {
      const thick = regions[i] !== regions[r * n + c - 1];
      parts.push(`border-left: ${thick ? '2.5px solid var(--board-line)' : '1px solid var(--board-line-soft)'}`);
    }
    return parts.join(';');
  }

  function cellLabel(i: number): string {
    const r = Math.floor(i / n) + 1;
    const c = (i % n) + 1;
    const state = marks[i] === QUEEN ? 'queen' : marks[i] === X ? 'marked' : 'empty';
    return `Row ${r}, column ${c}, ${state}`;
  }
</script>

<div
  class="board"
  style="grid-template-columns: repeat({n}, {cellPx}px); grid-auto-rows: {cellPx}px; width: {n * cellPx + FRAME}px;"
  role="grid"
  aria-label="Puzzle board"
  onpointermove={handlePointerMove}
>
  {#each marks as m, i (i)}
    <button
      class="cell"
      class:hinted={hintCells.has(i)}
      class:hinted-danger={hintCells.has(i) && hintDanger}
      data-i={i}
      style={cellStyle(i)}
      onpointerdown={(e) => handlePointerDown(e, i)}
      onclick={() => handleClick(i)}
      aria-label={cellLabel(i)}
    >
      {#if m === QUEEN}
        <span class="queen" class:conflict={conflicts.has(i)}>{queenGlyph}</span>
      {:else if m === X}
        <span class="x">×</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .board {
    display: grid;
    border: 3px solid var(--board-line);
    border-radius: 10px;
    overflow: hidden;
    touch-action: none;
  }

  .cell {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font: inherit;
  }

  .queen {
    font-size: clamp(16px, 4.6vw, 26px);
    color: var(--queen-color);
    line-height: 1;
    animation: stamp 160ms cubic-bezier(0.2, 1.4, 0.4, 1);
    pointer-events: none;
  }

  .queen.conflict {
    color: var(--danger);
  }

  .cell.hinted {
    box-shadow: inset 0 0 0 3px var(--gold);
    animation: glow 1.4s ease-in-out infinite;
  }

  .cell.hinted-danger {
    box-shadow: inset 0 0 0 3px var(--danger);
  }

  @keyframes glow {
    0%,
    100% {
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.08);
    }
  }

  .x {
    font-size: clamp(12px, 3.2vw, 17px);
    color: var(--x-color);
    line-height: 1;
    pointer-events: none;
  }

  @keyframes stamp {
    0% {
      transform: scale(1.7) rotate(-8deg);
      opacity: 0.3;
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }
</style>
