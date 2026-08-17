<script lang="ts">
  import { onMount } from 'svelte';
  import Board from './Board.svelte';
  import QuestMap from './QuestMap.svelte';
  import { app } from './state.svelte';
  import { contentUrl } from './content';
  import { formatTime } from './achievements';
  import { pwa } from './pwa.svelte';

  let fileInput: HTMLInputElement;
  let confirmReset = $state(false);
  let codeCopied = $state(false);

  /** The board code reproduces a layout exactly, so it doubles as a bug report. */
  async function copyBoardCode() {
    if (!app.game) return;
    try {
      await navigator.clipboard.writeText(app.game.id);
      codeCopied = true;
      setTimeout(() => (codeCopied = false), 1600);
    } catch {
      codeCopied = false;
    }
  }

  onMount(() => {
    void app.init();
    void pwa.init();
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
      `--board-line-soft:${v.boardLine}5c;--queen-color:${v.queenColor};` +
      `--x-color:${v.xColor};--x-halo:${v.boardLine};--x-outline:${v.boardLine};${regions}`
    );
  });

  const barTitle = $derived.by(() => {
    switch (app.view) {
      case 'quick':
        return 'Quick play';
      case 'orbitHome':
        return quest?.name ?? 'Quest';
      case 'orbitPlay':
        return `Level ${app.levelIndex + 1}`;
      case 'cabinet':
        return 'Cabinet';
      default:
        return 'Settings';
    }
  });

  const quest = $derived(app.quest);
  const doneSet = $derived(new Set(app.orbitProgress.completed));
  const orbitDone = $derived(app.orbitProgress.completed.length);

  async function onPickFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await app.restoreBackup(file);
  }
</script>

<div class="app" style={variantStyle}>
  <header class="appbar">
    <span class="mark" aria-hidden="true">♛</span>
    <h1 class="bar-title">{barTitle}</h1>
    <button
      class="icon-btn"
      class:on={app.view === 'settings'}
      onclick={() => app.goSettings()}
      aria-label="Settings"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.2a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1z" />
      </svg>
    </button>
  </header>

  <main class:flush={app.view === 'orbitHome'}>
    {#if !app.ready}
      <p class="hint-line">Setting the press…</p>
    {:else if app.view === 'settings'}
      <section class="sheet">
        <h2 class="section-title">Preferences</h2>
        {#each [{ key: 'autoX', label: 'Auto-mark', note: 'Cross off cells a new ♛ rules out' }, { key: 'showConflicts', label: 'Highlight clashes', note: 'Colour ♛ that attack each other' }, { key: 'patterns', label: 'Region patterns', note: 'Give each colour a texture as well' }, { key: 'sound', label: 'Sound', note: 'Soft paper and stamp sounds' }] as const as row (row.key)}
          <div class="pref">
            <div class="pref-text">
              <p class="pref-label">{row.label}</p>
              <p class="pref-note">{row.note}</p>
            </div>
            <button
              class="switch"
              class:on={app.settings[row.key]}
              role="switch"
              aria-checked={app.settings[row.key]}
              aria-label={row.label}
              onclick={() => app.setSetting(row.key, !app.settings[row.key])}
            >
              <span class="knob"></span>
            </button>
          </div>
        {/each}

        <h2 class="section-title">Your progress</h2>
        <div class="stack">
          <button class="tag wide" onclick={() => app.downloadBackup()}>Export backup</button>
          <button class="tag wide" onclick={() => fileInput.click()}>Import backup</button>
          <input
            bind:this={fileInput}
            type="file"
            accept="application/json"
            onchange={onPickFile}
            hidden
          />
          {#if confirmReset}
            <button class="tag wide danger" onclick={() => app.resetEverything()}>
              Tap again to erase everything
            </button>
          {:else}
            <button class="tag wide danger-quiet" onclick={() => (confirmReset = true)}>
              Reset all progress
            </button>
          {/if}
        </div>
        <p class="colophon">Reign · v0.1 · pressed and bound at home</p>
      </section>
    {:else if app.view === 'cabinet'}
      {#if quest}
      <p class="rule centered">One keepsake per completed quest</p>

      <div class="shelf-row">
        {#each app.questSummaries as summary (summary.id)}
          {@const q = app.quests.find((x) => x.id === summary.id)}
          {@const complete = summary.completed.length >= summary.levelCount}
          {#if q}
            <figure class="keepsake" class:locked={!complete}>
              <div class="keepsake-frame">
                {#if q.collectible.art}
                  <img src={contentUrl(q.collectible.art)} alt={q.collectible.name} />
                {:else}
                  <!-- Artwork not made yet: an engraved plate keeps the shelf honest. -->
                  <div class="keepsake-plate">
                    <span class="plate-rule"></span>
                    <span class="plate-name">{q.collectible.name}</span>
                    <span class="plate-rule"></span>
                  </div>
                {/if}
                {#if !complete}
                  <div class="keepsake-veil"><span class="veil-mark">?</span></div>
                {/if}
              </div>
              <figcaption>
                {#if complete}
                  {q.name} ★
                {:else}
                  {q.name} · {summary.completed.length} / {summary.levelCount}
                {/if}
              </figcaption>
            </figure>
          {/if}
        {/each}
      </div>
      <div class="shelf-board"></div>

      <div class="plaques">
        <span class="plaque">★ {app.stats.stars} stars</span>
        <span class="plaque">{app.stats.questLevels} levels cleared</span>
      </div>

      <section class="record">
        <h2 class="section-title">The record</h2>
        <div class="figures">
          <div class="figure">
            <span class="figure-n">{app.stats.solved}</span>
            <span class="figure-l">puzzles solved</span>
          </div>
          <div class="figure">
            <span class="figure-n">{app.stats.currentStreak}</span>
            <span class="figure-l">day streak</span>
          </div>
          <div class="figure">
            <span class="figure-n">{app.stats.hintFree}</span>
            <span class="figure-l">without a hint</span>
          </div>
          <div class="figure">
            <span class="figure-n">{app.stats.daysPlayed}</span>
            <span class="figure-l">days played</span>
          </div>
        </div>

        {#if app.stats.solved > 0}
          <div class="bests">
            {#each ['easy', 'medium', 'hard'] as const as d (d)}
              {#if app.stats.best[d] !== undefined}
                <span class="best">
                  <em>{d}</em> best {formatTime(app.stats.best[d] ?? 0)} · {app.stats.byDifficulty[d]} solved
                </span>
              {/if}
            {/each}
          </div>
        {/if}

        <h2 class="section-title">
          Marks earned <span class="count">{app.earnedCount} / {app.achievements.length}</span>
        </h2>
        <ul class="marks">
          {#each app.achievements as a (a.id)}
            <li class="mark-row" class:earned={a.earned}>
              <span class="mark-glyph">{a.mark}</span>
              <span class="mark-text">
                <span class="mark-name">{a.name}</span>
                <span class="mark-note">
                  {a.note}{!a.earned && (a.have ?? 0) > 0 ? ` · ${a.have} of ${a.need}` : ''}
                </span>
              </span>
              {#if a.earned}<span class="mark-tick">✓</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
      {/if}
    {:else if app.view === 'orbitHome'}
      {#if quest}
      <div class="quest-hud">
        {#if app.quests.length > 1}
          <div class="quest-picker">
            {#each app.quests as q (q.id)}
              <button
                class="tag slim"
                class:active={q.id === quest.id}
                onclick={() => app.selectQuest(q.id)}
              >
                {q.name}{app.questNews.includes(q.id) ? ' •' : ''}
              </button>
            {/each}
          </div>
        {/if}
        <p class="goal">{quest.goal} · {orbitDone} / {quest.setup.levelCount}</p>
        <div class="parts">
          {#each quest.collectible.partGlyphs as glyph, p (p)}
            <span class="part" class:earned={app.partsEarned.has(p)}>{glyph}</span>
          {/each}
        </div>
      </div>

      {#if quest.theme.map}
        <QuestMap
          levels={quest.levels}
          map={quest.theme.map}
          partGlyphs={quest.collectible.partGlyphs}
          {doneSet}
          currentIndex={app.currentOrbitIndex}
          starsFor={(i) => app.starsFor(i)}
          onSelect={(i) => app.startOrbitLevel(i)}
        />
      {/if}

      {#if orbitDone < quest.setup.levelCount}
        <div class="dock">
          <button class="tag primary" onclick={() => app.startOrbitLevel(app.currentOrbitIndex)}>
            {orbitDone === 0 ? 'Launch' : 'Continue'} · Level {app.currentOrbitIndex + 1}
          </button>
        </div>
      {:else}
        <div class="dock"><span class="tag primary">{quest.collectible.name} is complete ✶</span></div>
      {/if}
      {/if}
    {:else}
      {#if app.view === 'orbitPlay' && app.currentLevel}
        <header class="level-head">
          <button class="tag slim" onclick={() => app.goOrbitHome()}>‹ Map</button>
          <div class="level-title">
            <h2>{app.currentLevel.name}</h2>
            <p class="rule slim-rule">
              {app.currentLevel.difficulty}{app.currentLevel.special ? ' · part on completion' : ''}
            </p>
          </div>
        </header>
      {:else}
        <div class="controls">
          {#each ['easy', 'medium', 'hard'] as const as d (d)}
            <button class="tag" class:active={app.difficulty === d} onclick={() => app.newGame(d)}>
              {d}
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
          {#if app.liveStars !== null && !app.solved}
            <span
              class="stars live"
              aria-label={`${app.liveStars} of 3 stars still available`}
              title="Stars still within reach"
            >
              {#each [0, 1, 2] as s (s)}
                <span class="star" class:filled={s < app.liveStars}>★</span>
              {/each}
            </span>
          {/if}
          <button
            class="tag slim"
            onclick={() => app.undo()}
            disabled={app.undoDepth === 0 || app.paused}
          >
            Undo
          </button>
          <button
            class="tag slim hint"
            class:open={!!app.activeHint}
            onclick={() => app.requestHint()}
            disabled={app.paused || app.solved}
          >
            Hint
          </button>
          <button
            class="tag slim"
            onclick={() => app.clearBoard()}
            disabled={app.paused || app.solved || !app.hasMarks}
          >
            Clear
          </button>
        </div>

        <div class="board-zone">
          <Board
            puzzle={app.game.puzzle}
            marks={app.marks}
            conflicts={visibleConflicts}
            hintCells={app.hintCells}
            hintDanger={app.hintIsMistake}
            queenGlyph={app.variant?.queenGlyph ?? '♛'}
          patterns={app.settings.patterns}
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
                Part secured {quest?.collectible.partGlyphs[app.currentLevel.partIndex ?? 0] ?? '✦'} · {timeLabel}
              {:else}
                Solved · {timeLabel}
              {/if}
            </span>
            {#if app.view === 'orbitPlay'}
              <div class="controls">
                {#if app.levelIndex + 1 < app.questLevels.length}
                  <button class="tag primary" onclick={() => app.nextOrbitLevel()}>Next level</button>
                {/if}
                <button class="tag" onclick={() => app.goOrbitHome()}>Map</button>
              </div>
            {:else}
              <button class="tag primary" onclick={() => app.newGame()}>Play again</button>
            {/if}
          </div>
        {:else if app.activeHint}
          <div class="hint-message">
            <p class="hint-text">{app.hintText}</p>
            {#if app.hintProgress}
              <span
                class="pips"
                aria-label={`Hint depth ${app.hintProgress.step} of ${app.hintProgress.total}`}
              >
                {#each { length: app.hintProgress.total } as _, i (i)}
                  <span class="pip" class:filled={i < app.hintProgress.step}></span>
                {/each}
              </span>
            {/if}
          </div>
        {:else}
          <p class="hint-line">
            Place one ♛ per row, column, and colour region. ♛ cannot touch, even diagonally.
          </p>
        {/if}

        <button
          class="board-code"
          onclick={copyBoardCode}
          aria-label={`Board code ${app.game.id}. Tap to copy.`}
        >
          {codeCopied ? 'copied' : app.game.id}
        </button>
      {/if}
    {/if}
  </main>

  {#if pwa.updateReady}
    <div class="notice" role="status">
      <span>A new edition of Reign is ready.</span>
      <div class="notice-actions">
        <button class="tag slim" onclick={() => pwa.dismissUpdate()}>Later</button>
        <button class="tag slim primary" onclick={() => pwa.applyUpdateNow()}>Reload</button>
      </div>
    </div>
  {/if}

  <nav class="bottomnav">
    <button class="navitem" class:on={app.view === 'quick'} onclick={() => app.goQuick()}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
      <span>Play</span>
    </button>
    <button
      class="navitem"
      class:on={app.view === 'orbitHome' || app.view === 'orbitPlay'}
      onclick={() => app.goOrbitHome()}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" /><path d="M9 4v13M15 6.5v13" />
      </svg>
      <span>Quest</span>
    </button>
    <button class="navitem" class:on={app.view === 'cabinet'} onclick={() => app.goCabinet()}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7">
        <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M10 13h4" />
      </svg>
      <span>Cabinet</span>
    </button>
  </nav>
</div>

{#if pwa.showInstallHint}
  <div class="sheet-scrim">
    <div class="install-card">
      <span class="install-mark">♛</span>
      <h2>Install Reign</h2>
      <p class="rule centered">
        Add Reign to your home screen and it plays offline, keeps your progress, and opens
        without the browser bars.
      </p>
      <ol class="steps">
        <li><span class="step-n">1</span> Tap the Share icon in Safari</li>
        <li><span class="step-n">2</span> Choose “Add to Home Screen”</li>
      </ol>
      <button class="tag" onclick={() => pwa.dismissInstallHint()}>Maybe later</button>
    </div>
  </div>
{/if}

<style>
  /* App shell: fixed viewport height so inner regions scroll, not the page. */
  .app {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: background 300ms ease;
  }

  .appbar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: max(10px, env(safe-area-inset-top)) 16px 10px;
    background: color-mix(in srgb, var(--paper) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--ink-faint);
  }

  .mark {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: var(--paper-raised);
    border: 1px solid var(--ink-faint);
    display: grid;
    place-items: center;
    font-size: 15px;
    color: var(--ink);
  }

  .bar-title {
    flex: 1;
    margin: 0;
    font-family: var(--font-serif);
    font-size: 19px;
    font-weight: 700;
    color: var(--ink);
  }

  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-soft);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .icon-btn.on {
    background: var(--ink);
    color: var(--paper);
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 16px 16px 24px;
    width: 100%;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }

  main.flush {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .quest-hud {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 16px 12px;
  }

  .goal {
    margin: 0;
    font-size: 13.5px;
    color: var(--ink-soft);
  }

  .quest-picker {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .dock {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 10px 16px 12px;
  }

  h2 {
    font-family: var(--font-serif);
    font-weight: 700;
    font-size: 19px;
    margin: 0;
    color: var(--ink);
  }

  .rule {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--ink-soft);
    max-width: 340px;
  }

  .rule.italic {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 15px;
  }

  .rule.centered {
    text-align: center;
  }

  .slim-rule {
    margin: 2px 0 0;
    font-size: 12px;
    text-transform: capitalize;
  }

  .level-head {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(92vw, 480px);
    text-align: left;
  }

  .controls,
  .statusbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
  }

  .statusbar {
    gap: 10px;
  }

  .tag.slim {
    padding: 6px 13px;
    font-size: 11.5px;
  }

  .tag.hint {
    color: var(--gold-deep, #a8813f);
    border-color: var(--gold);
  }

  .tag.primary {
    background: var(--gold);
    border: 1.5px solid var(--gold);
    color: #3a2c10;
  }

  .tag.wide {
    width: 100%;
    text-align: center;
  }

  .tag.danger-quiet {
    color: var(--danger);
    border-color: var(--danger);
  }

  .tag.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--paper);
  }

  .tag:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .time {
    font-family: var(--font-serif);
    font-variant-numeric: tabular-nums;
    font-size: 22px;
    min-width: 56px;
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
    display: grid;
    place-items: center;
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

  .node {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1.5px solid var(--ink-soft);
    background: transparent;
    color: var(--ink-soft);
    font-family: var(--font-sans);
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

  /* Live rating in the status bar: fades as a star slips out of reach. */
  .stars.live .star {
    font-size: 15px;
    transition: color 500ms ease, -webkit-text-stroke-color 500ms ease;
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
    font-size: 13.5px;
    color: var(--ink-soft);
    margin: 0;
    max-width: 330px;
    text-align: center;
    line-height: 1.5;
  }

  .hint-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    max-width: 340px;
    border: 1.5px dashed var(--gold);
    border-radius: 10px;
    padding: 9px 14px 8px;
    background: var(--paper-raised);
  }

  .hint-text {
    margin: 0;
    color: var(--ink);
    font-size: 14px;
    line-height: 1.45;
    text-align: center;
  }

  /* Depth pips: how far into this hint the player has chosen to go. */
  .pips {
    display: flex;
    gap: 5px;
  }

  .pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    border: 1px solid var(--gold);
    opacity: 0.5;
    transition: opacity 200ms ease, background 200ms ease;
  }

  .pip.filled {
    background: var(--gold);
    opacity: 1;
  }

  .tag.hint.open {
    background: color-mix(in srgb, var(--gold) 22%, transparent);
  }

  /* Quiet enough to ignore, precise enough to reproduce a board from. */
  .board-code {
    margin-top: auto;
    padding: 6px 8px;
    border: 0;
    background: transparent;
    font-family: var(--font-mono, ui-monospace, 'SF Mono', Menlo, monospace);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    opacity: 0.45;
    cursor: pointer;
  }

  .board-code:active {
    opacity: 0.8;
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

  .sheet {
    width: min(92vw, 460px);
  }

  .section-title {
    font-family: var(--font-serif);
    font-size: 24px;
    margin: 10px 0 14px;
  }

  .pref {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--ink-faint);
  }

  .pref-text {
    flex: 1;
  }

  .pref-label {
    margin: 0;
    font-size: 16px;
    color: var(--ink);
  }

  .pref-note {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .switch {
    width: 52px;
    height: 30px;
    border-radius: 999px;
    border: 1.5px solid var(--ink-faint);
    background: var(--paper-raised);
    padding: 2px;
    display: flex;
    justify-content: flex-start;
    cursor: pointer;
    transition: background 160ms ease;
  }

  .switch.on {
    background: var(--ink);
    border-color: var(--ink);
    justify-content: flex-end;
  }

  .knob {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--paper);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 160ms ease;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .colophon {
    margin: 26px 0 0;
    text-align: center;
    font-size: 12px;
    color: var(--ink-soft);
    opacity: 0.75;
    letter-spacing: 0.04em;
  }

  .shelf-row {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    justify-content: center;
    flex-wrap: wrap;
    width: min(92vw, 460px);
  }

  .keepsake {
    margin: 0;
    text-align: center;
  }

  .keepsake-frame {
    position: relative;
    width: min(42vw, 200px);
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    border: 3px solid #6b5136;
    box-shadow: 0 6px 18px rgba(63, 58, 51, 0.25);
  }

  .keepsake-frame img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: filter 400ms ease;
  }

  .keepsake-plate {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 40% 30%, #3a332a, #221d17 70%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
  }

  .plate-name {
    font-family: var(--font-serif);
    font-size: 15px;
    color: #d9c79b;
    text-align: center;
    line-height: 1.3;
  }

  .plate-rule {
    width: 42px;
    height: 1px;
    background: #8a7448;
  }

  .keepsake.locked .keepsake-frame img {
    filter: grayscale(0.9) brightness(0.55) contrast(0.9);
  }

  .keepsake-veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .veil-mark {
    font-family: var(--font-serif);
    font-size: 56px;
    color: rgba(242, 234, 216, 0.85);
  }

  figcaption {
    margin-top: 10px;
    font-family: var(--font-serif);
    font-size: 15px;
    color: var(--ink);
  }

  .keepsake.locked figcaption {
    color: var(--ink-soft);
  }

  .shelf-board {
    width: min(84vw, 340px);
    height: 10px;
    border-radius: 4px;
    background: #c9a878;
    border: 1px solid #8a6a3f;
    margin-top: -6px;
  }

  .plaques {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .record {
    width: min(92vw, 460px);
    margin-top: 26px;
  }

  .count {
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-soft);
    letter-spacing: 0.03em;
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }

  .figure {
    background: var(--paper-raised);
    border: 1px solid var(--ink-faint);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .figure-n {
    font-family: var(--font-serif);
    font-size: 26px;
    line-height: 1;
    color: var(--ink);
  }

  .figure-l {
    font-size: 12.5px;
    color: var(--ink-soft);
  }

  .bests {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 20px;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .best em {
    font-style: normal;
    text-transform: capitalize;
    color: var(--ink);
  }

  .marks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .mark-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 2px;
    border-bottom: 1px solid var(--ink-faint);
    opacity: 0.45;
  }

  .mark-row.earned {
    opacity: 1;
  }

  .mark-glyph {
    width: 32px;
    height: 32px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1.5px dashed var(--ink-faint);
    font-size: 14px;
    color: var(--ink-soft);
  }

  .mark-row.earned .mark-glyph {
    border: 1.5px solid var(--gold);
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    color: var(--gold);
  }

  .mark-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .mark-name {
    font-size: 14.5px;
    color: var(--ink);
  }

  .mark-note {
    font-size: 12.5px;
    color: var(--ink-soft);
  }

  .mark-tick {
    color: var(--gold);
    font-size: 14px;
  }

  .plaque {
    font-size: 12px;
    color: #5a4326;
    background: #e8d9ba;
    border: 1px solid #c9b18a;
    border-radius: 6px;
    padding: 4px 12px;
  }

  .notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: var(--paper-raised);
    border-top: 1px solid var(--ink-faint);
    font-size: 13.5px;
    color: var(--ink);
  }

  .notice-actions {
    display: flex;
    gap: 8px;
  }

  .sheet-scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(63, 58, 51, 0.45);
    backdrop-filter: blur(3px);
  }

  .install-card {
    width: 100%;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 26px 22px 22px;
    border-radius: 18px;
    background: var(--paper);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
  }

  .install-mark {
    width: 54px;
    height: 54px;
    border-radius: 13px;
    display: grid;
    place-items: center;
    font-size: 26px;
    color: var(--ink);
    background: var(--paper-raised);
    border: 1px solid var(--ink-faint);
  }

  .steps {
    list-style: none;
    margin: 4px 0 6px;
    padding: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--paper-raised);
    font-size: 13.5px;
    color: var(--ink);
  }

  .step-n {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--ink);
    color: var(--paper);
    font-size: 11px;
    font-weight: 600;
  }

  .bottomnav {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    gap: 4px;
    padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--ink-faint);
  }

  .navitem {
    flex: 1;
    min-height: 52px;
    border: 0;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--ink-soft);
    font-family: var(--font-sans);
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    cursor: pointer;
    border-radius: 10px;
    transition: color 140ms ease;
  }

  .navitem.on {
    color: var(--ink);
    background: var(--paper-raised);
    box-shadow: inset 0 0 0 1px var(--ink-faint);
  }
</style>
