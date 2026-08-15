<script lang="ts">
  import { onMount } from 'svelte';
  import type { Difficulty } from '@reign/engine';
  import Board from './Board.svelte';
  import { app } from './state.svelte';

  let showSettings = $state(false);

  onMount(() => {
    void app.init();
  });

  const timeLabel = $derived(
    `${Math.floor(app.elapsed / 60)}:${String(app.elapsed % 60).padStart(2, '0')}`,
  );

  const visibleConflicts = $derived(app.settings.showConflicts ? app.conflicts : new Set<number>());
</script>

<main>
  <header>
    <h1>Reign</h1>
    <p class="rule">One ♛ in every row, column, and colour. No two ♛ may touch.</p>
  </header>

  {#if app.ready && app.game}
    <div class="controls">
      {#each ['easy', 'medium', 'hard'] as const as d (d)}
        <button class="tag" class:active={app.difficulty === d} onclick={() => app.newGame(d)}>
          {d[0].toUpperCase() + d.slice(1)}
        </button>
      {/each}
      <button class="tag" onclick={() => app.newGame()}>New</button>
    </div>

    <div class="statusbar">
      <button class="tag slim" onclick={() => app.togglePause()} disabled={app.solved}>
        {app.paused ? '▶ Resume' : '❙❙'}
      </button>
      <span class="time" class:dim={app.paused}>{timeLabel}</span>
      <button class="tag slim" onclick={() => app.undo()} disabled={app.undoDepth === 0 || app.paused}>
        Undo
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
        <span class="solved-stamp">Solved · {timeLabel}</span>
        <button class="tag" onclick={() => app.newGame()}>Play again</button>
      </div>
    {:else}
      <p class="hint-line">Tap once for ×, again for ♛. Drag to mark × across cells.</p>
    {/if}
  {:else}
    <p class="hint-line">Setting the press…</p>
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

  .board-zone {
    position: relative;
  }

  .pause-cover {
    position: absolute;
    inset: 0;
    background: var(--paper);
    border: 3px solid var(--ink);
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
  }

  .solved {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .solved-stamp {
    font-family: var(--font-serif);
    font-size: 24px;
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
