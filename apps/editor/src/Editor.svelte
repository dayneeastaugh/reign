<script lang="ts">
  import {
    countSolutions,
    solveLogically,
    difficultyForTier,
    regionsContiguous,
    firstSolution,
    validateSolution,
    type Difficulty,
    type LevelDef,
    type Puzzle,
  } from '@reign/engine';

  /**
   * Authoring tool for hand-built levels. It runs the same engine the game and
   * CI run, so what it reports here is exactly what the content pipeline will
   * accept — no second implementation to drift out of step.
   */
  const PALETTE = [
    '#d8a79a', '#a9b494', '#d9b97e', '#9db0c4', '#b39ab0', '#cd8f6e',
    '#93b8a5', '#b3b072', '#a08cbf', '#e2cfa8', '#6f8fae',
  ];

  let size = $state(8);
  let regions = $state<number[]>(new Array(64).fill(0));
  let brush = $state(0);
  let levelName = $state('Untitled world');
  let special = $state(false);
  let painting = false;

  function resize(n: number) {
    size = n;
    regions = new Array(n * n).fill(0);
    brush = 0;
  }

  /** Blank slate: n horizontal bands, a legal starting point to carve from. */
  function bands() {
    regions = Array.from({ length: size * size }, (_, i) => Math.floor(i / size));
  }

  function paint(i: number) {
    if (regions[i] === brush) return;
    const next = regions.slice();
    next[i] = brush;
    regions = next;
  }

  const puzzle = $derived<Puzzle>({ size, regions });

  const report = $derived.by(() => {
    const used = new Set(regions);
    const counts = new Array(size).fill(0);
    for (const g of regions) if (g < size) counts[g]++;
    const smallest = Math.min(...counts);

    if (used.size !== size) {
      return {
        state: 'incomplete' as const,
        message: `Use all ${size} colours — ${used.size} in play.`,
        solutions: null,
        difficulty: null,
        smallest,
      };
    }
    if (!regionsContiguous(puzzle)) {
      return {
        state: 'invalid' as const,
        message: 'Every colour must form one connected shape.',
        solutions: null,
        difficulty: null,
        smallest,
      };
    }
    const solutions = countSolutions(puzzle, 2);
    if (solutions === 0) {
      return { state: 'invalid' as const, message: 'No solution exists.', solutions, difficulty: null, smallest };
    }
    if (solutions > 1) {
      return {
        state: 'invalid' as const,
        message: 'More than one solution — keep carving until it is unique.',
        solutions,
        difficulty: null,
        smallest,
      };
    }
    const res = solveLogically(puzzle);
    if (!res.solved) {
      return {
        state: 'invalid' as const,
        message: 'Unique, but only findable by guessing — not solvable by logic alone.',
        solutions,
        difficulty: null,
        smallest,
      };
    }
    const difficulty = difficultyForTier(Math.max(1, res.tier));
    return {
      state: 'valid' as const,
      message: `Unique and logic-solvable. Grades as ${difficulty}.`,
      solutions,
      difficulty: difficulty as Difficulty,
      smallest,
    };
  });

  const solution = $derived(report.state === 'valid' ? firstSolution(puzzle) : null);
  let showSolution = $state(false);

  const levelJson = $derived.by(() => {
    if (report.state !== 'valid' || !solution) return '';
    const level: LevelDef = {
      index: 0,
      name: levelName,
      size,
      regions: [...regions],
      solution,
      difficulty: report.difficulty!,
      ...(special ? { special: true, partIndex: 0 } : {}),
    };
    return JSON.stringify(level, null, 2);
  });

  async function copyJson() {
    await navigator.clipboard.writeText(levelJson);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([levelJson], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${levelName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const level = JSON.parse(text) as LevelDef;
      size = level.size;
      regions = [...level.regions];
      levelName = level.name;
      special = !!level.special;
      brush = 0;
    });
  }

  const solutionCells = $derived(
    new Set((showSolution && solution ? solution : []).map((c, r) => r * size + c)),
  );
</script>

<main>
  <header>
    <h1>Reign · level editor</h1>
    <p class="sub">Paint colour regions. The engine checks the puzzle as you go.</p>
  </header>

  <section class="controls">
    <label>
      Size
      <select value={size} onchange={(e) => resize(Number((e.target as HTMLSelectElement).value))}>
        {#each [7, 8, 9, 10, 11] as n (n)}<option value={n}>{n} × {n}</option>{/each}
      </select>
    </label>
    <button class="tag" onclick={bands}>Reset to bands</button>
    <label class="name">
      Name
      <input bind:value={levelName} />
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={special} /> Special (station)
    </label>
  </section>

  <section class="palette">
    {#each Array(size) as _, g (g)}
      <button
        class="swatch"
        class:active={brush === g}
        style="background: {PALETTE[g % PALETTE.length]}"
        onclick={() => (brush = g)}
        aria-label={`Colour ${g + 1}`}
      >
        {g + 1}
      </button>
    {/each}
  </section>

  <div class="workspace">
    <div
      class="grid"
      style="grid-template-columns: repeat({size}, 34px)"
      role="grid"
      tabindex="-1"
      onpointerdown={() => (painting = true)}
      onpointerup={() => (painting = false)}
      onpointerleave={() => (painting = false)}
    >
      {#each regions as g, i (i)}
        <button
          class="cell"
          style="background: {PALETTE[g % PALETTE.length]}"
          onpointerdown={() => paint(i)}
          onpointerenter={() => painting && paint(i)}
          aria-label={`Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}, colour ${g + 1}`}
        >
          {#if solutionCells.has(i)}<span class="queen">♛</span>{/if}
        </button>
      {/each}
    </div>

    <aside class="report {report.state}">
      <p class="verdict">{report.message}</p>
      <dl>
        <div><dt>Solutions</dt><dd>{report.solutions ?? '—'}</dd></div>
        <div><dt>Grades as</dt><dd>{report.difficulty ?? '—'}</dd></div>
        <div><dt>Smallest region</dt><dd>{report.smallest} cells</dd></div>
      </dl>
      {#if report.state === 'valid' && report.smallest < 3 && report.difficulty !== 'easy'}
        <p class="warn">
          A {report.smallest}-cell region gives its queen away. Medium and hard levels want three
          or more.
        </p>
      {/if}
      {#if solution && !validateSolution(puzzle, solution)}
        <p class="warn">Solver disagreement — please report this board.</p>
      {/if}
      <div class="actions">
        <button class="tag" onclick={() => (showSolution = !showSolution)} disabled={!solution}>
          {showSolution ? 'Hide' : 'Show'} solution
        </button>
        <button class="tag primary" onclick={copyJson} disabled={!levelJson}>Copy JSON</button>
        <button class="tag" onclick={download} disabled={!levelJson}>Download</button>
        <label class="tag file">
          Import<input type="file" accept="application/json" onchange={importJson} hidden />
        </label>
      </div>
    </aside>
  </div>

  {#if levelJson}
    <details>
      <summary>Level JSON</summary>
      <pre>{levelJson}</pre>
    </details>
  {/if}
</main>

<style>
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 28px 20px 60px;
  }

  h1 {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 28px;
    margin: 0;
  }

  .sub {
    margin: 4px 0 22px;
    color: var(--ink-soft);
    font-size: 14px;
  }

  .controls {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 14px;
    font-size: 14px;
  }

  .controls select,
  .controls input[type='text'],
  .name input {
    padding: 6px 8px;
    border: 1px solid var(--ink-faint);
    border-radius: 6px;
    background: var(--paper-raised);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .palette {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .swatch {
    width: 38px;
    height: 32px;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: #2f2a22;
  }

  .swatch.active {
    border-color: var(--ink);
  }

  .workspace {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .grid {
    display: grid;
    border: 3px solid var(--ink);
    border-radius: 8px;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .cell {
    width: 34px;
    height: 34px;
    border: 0.5px solid rgba(63, 58, 51, 0.25);
    padding: 0;
    cursor: crosshair;
    display: grid;
    place-items: center;
  }

  .queen {
    font-size: 17px;
    color: var(--ink);
  }

  .report {
    flex: 1;
    min-width: 260px;
    border: 1.5px dashed var(--ink-faint);
    border-radius: 12px;
    padding: 16px;
    background: var(--paper-raised);
  }

  .report.valid {
    border-color: var(--ok);
  }

  .report.invalid {
    border-color: var(--danger);
  }

  .verdict {
    margin: 0 0 12px;
    font-size: 15px;
  }

  .report.valid .verdict {
    color: var(--ok);
  }

  .report.invalid .verdict {
    color: var(--danger);
  }

  dl {
    margin: 0 0 14px;
    font-size: 13.5px;
  }

  dl div {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid var(--ink-faint);
  }

  dt,
  dd {
    margin: 0;
  }

  dt {
    color: var(--ink-soft);
  }

  .warn {
    font-size: 13px;
    color: var(--danger);
    margin: 0 0 12px;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .file {
    display: inline-flex;
    align-items: center;
  }

  details {
    margin-top: 24px;
  }

  pre {
    background: var(--paper-raised);
    border: 1px solid var(--ink-faint);
    border-radius: 8px;
    padding: 12px;
    overflow: auto;
    font-size: 12px;
    max-height: 300px;
  }
</style>
