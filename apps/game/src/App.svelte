<script lang="ts">
  import { onMount } from 'svelte';
  import Board from './Board.svelte';
  import { app, orbit } from './state.svelte';

  let showSettings = $state(false);

  onMount(() => {
    void app.init();
  });

  $effect(() => {
    document.body.style.backgroundColor = app.variant ? app.variant.boardLine : '';
  });

  const timeLabel = $derived(
    `${Math.floor(app.elapsed / 60)}:${String(app.elapsed % 60).padStart(2, '0')}`,
  );

  const visibleConflicts = $derived(app.settings.showConflicts ? app.conflicts : new Set<number>());

  const variantStyle = $derived.by(() => {
    const v = app.variant;
    if (!v) return '';
    const regions = v.regionPalette.map((c, i) => `--region-${i + 1}:${c}`).join(';');
    return (
      `background:${v.background};--paper:${v.boardLine};--ink:${v.chromeColor};` +
      `--ink-soft:${v.chromeSoft};--ink-faint:${v.chromeSoft}55;` +
      `--paper-raised:rgba(255,255,255,0.06);--board-line:${v.boardLine};` +
      `--board-line-soft:${v.chromeSoft}44;--queen-color:${v.queenColor};` +
      `--x-color:${v.xColor};${regions}`
    );
  });

  const doneSet = $derived(new Set(app.orbitProgress.completed));
  const orbitDone = $derived(app.orbitProgress.completed.length);
</script>

<main style={variantStyle}>
  {#if app.view !== 'orbitPlay'}
    <nav class="tabs">
      <button class="tag" class:active={app.view === 'quick'} onclick={() => app.goQuick()}>Quick</button>
      <button class="tag" class:active={app.view !== 'quick'} onclick={() => app.goOrbitHome()}>
        {orbit.name}
      </button>
    </nav>
  {/if}

  {#if !app.ready}
    <p class="hint-line">Setting the press…</p>
  {:else if app.view === 'orbitHome'}
    <header>
      <h1>{orbit.name}</h1>
      <p class="rule">{orbit.goal} · {orbitDone} / {orbit.setup.levelCount}</p>
    </header>

    <div class="parts">
      {#each orbit.collectible.partGlyphs as glyph, p (p)}
        <span class="part" class:earned={app.partsEarned.has(p)}>{glyph}</span>
      {/each}
    </div>

    {#if orbitDone < orbit.setup.levelCount}
      <button class="tag primary" onclick={() => app.startOrbitLevel(app.currentOrbitIndex)}>
        {orbitDone === 0 ? 'Launch' : 'Continue'} · Level {app.currentOrbitIndex + 1}
      </button>
    {:else}
      <p class="rule">Journey complete — the orrery is built. ✶</p>
    {/if}

    <div class="rail">
      {#each orbit.levels as level, i (i)}
        {@const done = doneSet.has(i)}
        {@const current = i === app.currentOrbitIndex && !done}
        {@const locked = i > app.currentOrbitIndex && !done}
        {@const stars = app.starsFor(i)}
        <div class="node-wrap">
          <button
            class="node"
            class:done
            class:current
            class:station={level.special}
            disabled={locked}
            onclick={() => app.startOrbitLevel(i)}
            aria-label={`Level ${i + 1}: ${level.name}${done ? `, completed, ${stars} of 3 stars` : locked ? ', locked' : ''}`}
          >
            {level.special && done ? orbit.collectible.partGlyphs[level.partIndex ?? 0] : i + 1}
          </button>
          {#if orbit.setup.stars}
            <span class="stars" class:dim={locked} aria-hidden="true">
              {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < stars}>★</span>{/each}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    {#if app.view === 'orbitPlay' && app.currentLevel}
      <header class="level-head">
        <button class="tag slim" onclick={() => app.goOrbitHome()}>‹ Map</button>
        <div class="level-title">
          <h2>Level {app.levelIndex + 1} · {app.currentLevel.name}</h2>
          <p class="rule slim-rule">{app.currentLevel.difficulty}{app.currentLevel.special ? ' · part on completion' : ''}</p>
        </div>
      </header>
    {:else}
      <header>
        <h1>Reign</h1>
        <p class="rule">One ♛ in every row, column, and colour. No two ♛ may touch.</p>
      </header>

      <div class="controls">
        {#each ['easy', 'medium', 'hard'] as const as d (d)}
          <button class="tag" class:active={app.difficulty === d} onclick={() => app.newGame(d)}>
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        {/each}
        <button class="tag" onclick={() => app.newGame()}>New</button>
      </div>
    {/if}

    {#if app.game}
      <div class="statusbar">
        <button class="tag slim" onclick={() => app.togglePause()} disabled={app.solved}>
          {app.paused ? '▶' : '❙❙'}
        </button>
        <span class="time" class:dim={app.paused}>{timeLabel}</span>
        <button class="tag slim" onclick={() => app.undo()} disabled={app.undoDepth === 0 || app.paused}>
          Undo
        </button>
        <button class="tag slim" onclick={() => app.requestHint()} disabled={app.paused || app.solved}>
          Hint
        </button>
        <button class="tag slim" class:active={showSettings} onclick={() => (showSettings = !showSettings)}>
          ⚙
        </button>
      </div>

      {#if showSettings}
        <div class="settings">
          <button
            class="tag slim"
            class:active={app.settings.autoX}
            onclick={() => app.setSetting('autoX', !app.settings.autoX)}
          >
            Auto-× {app.settings.autoX ? 'on' : 'off'}
          </button>
          <button
            class="tag slim"
            class:active={app.settings.showConflicts}
            onclick={() => app.setSetting('showConflicts', !app.settings.showConflicts)}
          >
            Show clashes {app.settings.showConflicts ? 'on' : 'off'}
          </button>
        </div>
      {/if}

      <div class="board-zone">
        <Board
          puzzle={app.game.puzzle}
          marks={app.marks}
          conflicts={visibleConflicts}
          hintCells={app.hintCells}
          hintDanger={app.hintIsMistake}
          queenGlyph={app.variant?.queenGlyph ?? '♛'}
          onTap={(i) => app.tap(i)}
          onBeginPaint={() => app.beginPaint()}
          onPaint={(i) => app.paintX(i)}
        />
        {#if app.paused}
          <div class="pause-cover">
            <span class="pause-word">Paused</span>
            <button class="tag" onclick={() => app.togglePause()}>Resume</button>
          </div>
        {/if}
      </div>

      {#if app.solved}
        <div class="solved">
          {#if app.view === 'orbitPlay' && app.lastStars !== null}
            <span class="stars big" aria-label={`${app.lastStars} of 3 stars`}>
              {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < (app.lastStars ?? 0)}>★</span>{/each}
            </span>
          {/if}
          <span class="solved-stamp">
            {#if app.view === 'orbitPlay' && app.currentLevel?.special}
              Part secured {orbit.collectible.partGlyphs[app.currentLevel.partIndex ?? 0]} · {timeLabel}
            {:else}
              Solved · {timeLabel}
            {/if}
          </span>
          {#if app.view === 'orbitPlay'}
            <div class="controls">
              {#if app.levelIndex + 1 < orbit.levels.length}
                <button class="tag primary" onclick={() => app.nextOrbitLevel()}>Next level</button>
              {/if}
              <button class="tag" onclick={() => app.goOrbitHome()}>Map</button>
            </div>
          {:else}
            <button class="tag" onclick={() => app.newGame()}>Play again</button>
          {/if}
        </div>
      {:else if app.activeHint}
        <p class="hint-line hint-message">{app.hintText}</p>
      {:else}
        <p class="hint-line">Tap once for ×, again for ♛. Drag to mark × across cells.</p>
      {/if}
    {/if}
  {/if}
</main>

<style>
  main {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: max(20px, env(safe-area-inset-top)) 16px 32px;
    transition: background 300ms ease;
  }

  .tabs {
    display: flex;
    gap: 8px;
  }

  header {
    text-align: center;
  }

  h1 {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 32px;
    letter-spacing: 0.02em;
    margin: 0;
    color: var(--ink);
  }

  h2 {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 20px;
    margin: 0;
    color: var(--ink);
  }

  .rule {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--ink-soft);
    max-width: 340px;
  }

  .slim-rule {
    margin: 2px 0 0;
    font-size: 12px;
  }

  .level-head {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(92vw, 480px);
    text-align: left;
  }

  .controls,
  .settings,
  .statusbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
  }

  .tag.slim {
    padding: 5px 12px;
    font-size: 13px;
  }

  .tag.primary {
    background: var(--gold);
    border: 1.5px solid var(--gold);
    color: #3a2c10;
  }

  .tag:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .time {
    font-variant-numeric: tabular-nums;
    font-size: 15px;
    min-width: 44px;
    text-align: center;
    color: var(--ink);
  }

  .time.dim {
    color: var(--ink-faint);
  }

  .parts {
    display: flex;
    gap: 10px;
  }

  .part {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    border: 1.5px dashed var(--ink-soft);
    color: var(--ink-soft);
  }

  .part.earned {
    background: var(--gold);
    border: 1.5px solid var(--gold);
    color: #3a2c10;
  }

  .rail {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 8px;
    justify-content: center;
    width: min(92vw, 420px);
  }

  .node-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .stars {
    display: flex;
    gap: 1px;
    line-height: 1;
  }

  .stars.dim {
    opacity: 0.45;
  }

  .star {
    font-size: 9px;
    color: transparent;
    -webkit-text-stroke: 0.8px var(--ink-soft);
  }

  .star.filled {
    color: var(--gold);
    -webkit-text-stroke: 0;
  }

  .stars.big .star {
    font-size: 26px;
    animation: stamp 300ms cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  .node {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1.5px solid var(--ink-soft);
    background: transparent;
    color: var(--ink-soft);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .node.done {
    background: var(--gold);
    border-color: var(--gold);
    color: #3a2c10;
  }

  .node.current {
    border: 2.5px solid var(--gold);
    color: var(--ink);
  }

  .node.station {
    border-style: dashed;
  }

  .node.done.station {
    border-style: solid;
  }

  .node:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .board-zone {
    position: relative;
  }

  .pause-cover {
    position: absolute;
    inset: 0;
    background: var(--paper);
    border: 3px solid var(--board-line);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }

  .pause-word {
    font-family: var(--font-serif);
    font-size: 24px;
    color: var(--ink-soft);
  }

  .hint-line {
    font-size: 13px;
    color: var(--ink-soft);
    margin: 0;
    max-width: 360px;
    text-align: center;
  }

  .hint-message {
    color: var(--ink);
    font-size: 14px;
    border: 1.5px dashed var(--gold);
    border-radius: 10px;
    padding: 8px 14px;
    background: var(--paper-raised);
  }

  .solved {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .solved-stamp {
    font-family: var(--font-serif);
    font-size: 22px;
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
