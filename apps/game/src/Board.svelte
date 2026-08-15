<script lang="ts">
  import { QUEEN, X, type Puzzle } from '@reign/engine';

  let {
    puzzle,
    marks,
    conflicts,
    onTap,
    onBeginPaint,
    onPaint,
  }: {
    puzzle: Puzzle;
    marks: number[];
    conflicts: Set<number>;
    onTap: (i: number) => void;
    onBeginPaint: () => void;
    onPaint: (i: number) => void;
  } = $props();

  const n = $derived(puzzle.size);

  let pointerDownCell = -1;
  let stroking = false;
  let suppressClick = false;

  function cellAt(x: number, y: number): number {
    const el = document.elementFromPoint(x, y)?.closest('.cell');
    if (!el) return -1;
    const idx = (el as HTMLElement).dataset.i;
    return idx === undefined ? -1 : Number(idx);
  }

  function handlePointerDown(e: PointerEvent, i: number) {
    pointerDownCell = i;
    stroking = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (pointerDownCell < 0) return;
    const over = cellAt(e.clientX, e.clientY);
    if (over < 0 || over === pointerDownCell) return;
    if (!stroking) {
      stroking = true;
      suppressClick = true;
      onBeginPaint();
      onPaint(pointerDownCell);
    }
    onPaint(over);
  }

  function handlePointerUp() {
    pointerDownCell = -1;
    stroking = false;
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
      parts.push(`border-top: ${thick ? '2.5px solid var(--ink)' : '1px solid var(--ink-faint)'}`);
    }
    if (c > 0) {
      const thick = regions[i] !== regions[r * n + c - 1];
      parts.push(`border-left: ${thick ? '2.5px solid var(--ink)' : '1px solid var(--ink-faint)'}`);
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
  style="grid-template-columns: repeat({n}, 1fr);"
  role="grid"
  aria-label="Puzzle board"
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  {#each marks as m, i (i)}
    <button
      class="cell"
      data-i={i}
      style={cellStyle(i)}
      onpointerdown={(e) => handlePointerDown(e, i)}
      onclick={() => handleClick(i)}
      aria-label={cellLabel(i)}
    >
      {#if m === QUEEN}
        <span class="queen" class:conflict={conflicts.has(i)}>♛</span>
      {:else if m === X}
        <span class="x">×</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .board {
    display: grid;
    width: min(92vw, 480px);
    border: 3px solid var(--ink);
    border-radius: 10px;
    overflow: hidden;
    touch-action: none;
  }

  .cell {
    aspect-ratio: 1;
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
    color: var(--ink);
    line-height: 1;
    animation: stamp 160ms cubic-bezier(0.2, 1.4, 0.4, 1);
    pointer-events: none;
  }

  .queen.conflict {
    color: var(--danger);
  }

  .x {
    font-size: clamp(12px, 3.2vw, 17px);
    color: var(--ink-soft);
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
