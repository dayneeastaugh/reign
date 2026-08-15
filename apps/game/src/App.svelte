<script lang="ts">
  import { generatePuzzle, EMPTY, QUEEN, type Difficulty, type GeneratedPuzzle } from '@reign/engine';
  import Board from './Board.svelte';

  const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

  const initial = generatePuzzle({ difficulty: 'easy', seed: randomSeed() });
  let difficulty = $state<Difficulty>('easy');
  let game = $state<GeneratedPuzzle>(initial);
  let marks = $state<number[]>(new Array(initial.puzzle.size * initial.puzzle.size).fill(EMPTY));

  function newGame(d: Difficulty = difficulty) {
    difficulty = d;
    game = generatePuzzle({ difficulty: d, seed: randomSeed() });
    marks = new Array(game.puzzle.size * game.puzzle.size).fill(EMPTY);
  }

  const n = $derived(game.puzzle.size);

  const queenCells = $derived(marks.flatMap((m, i) => (m === QUEEN ? [i] : [])));

  const conflicts = $derived.by(() => {
    const bad = new Set<number>();
    const { regions } = game.puzzle;
    for (let a = 0; a < queenCells.length; a++) {
      for (let b = a + 1; b < queenCells.length; b++) {
        const i = queenCells[a];
        const j = queenCells[b];
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

  const solved = $derived(
    queenCells.length === n &&
      conflicts.size === 0 &&
      game.solution.every((c, r) => marks[r * n + c] === QUEEN),
  );

  function tap(i: number) {
    if (solved) return;
    marks[i] = (marks[i] + 1) % 3;
  }
</script>

<main>
  <header>
    <h1>Reign</h1>
    <p class="rule">One ♛ in every row, column, and colour. No two ♛ may touch.</p>
  </header>

  <div class="controls">
    {#each ['easy', 'medium', 'hard'] as const as d}
      <button class="tag" class:active={difficulty === d} onclick={() => newGame(d)}>
        {d[0].toUpperCase() + d.slice(1)}
      </button>
    {/each}
    <button class="tag" onclick={() => newGame()}>New</button>
  </div>

  <Board puzzle={game.puzzle} {marks} {conflicts} onTap={tap} />

  {#if solved}
    <div class="solved">
      <span class="solved-stamp">Solved</span>
      <button class="tag" onclick={() => newGame()}>Play again</button>
    </div>
  {:else}
    <p class="hint-line">Tap once for ×, again for ♛, again to clear.</p>
  {/if}
</main>

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: max(20px, env(safe-area-inset-top)) 16px 32px;
  }

  header {
    text-align: center;
  }

  h1 {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 34px;
    letter-spacing: 0.02em;
    margin: 0;
  }

  .rule {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--ink-soft);
    max-width: 340px;
  }

  .controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .hint-line {
    font-size: 13px;
    color: var(--ink-soft);
    margin: 0;
  }

  .solved {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .solved-stamp {
    font-family: var(--font-serif);
    font-size: 26px;
    color: var(--gold);
    border: 2px solid var(--gold);
    border-radius: 8px;
    padding: 4px 18px;
    transform: rotate(-3deg);
    animation: stamp 240ms cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  @keyframes stamp {
    0% {
      transform: rotate(-3deg) scale(1.6);
      opacity: 0;
    }
    100% {
      transform: rotate(-3deg) scale(1);
      opacity: 1;
    }
  }
</style>
