<script lang="ts">
  import { onMount } from 'svelte';
  import type { LevelDef, MapThemeDef } from '@reign/engine';

  let {
    levels,
    map,
    partGlyphs,
    doneSet,
    currentIndex,
    starsFor,
    onSelect,
  }: {
    levels: LevelDef[];
    map: MapThemeDef;
    partGlyphs: string[];
    doneSet: Set<number>;
    currentIndex: number;
    starsFor: (i: number) => number;
    onSelect: (i: number) => void;
  } = $props();

  const PITCH = 62;
  const BOTTOM_PAD = 150;
  const TOP_PAD = 90;

  /** Measured so the sky fills the device width; the walk scales with it. */
  let W = $state(360);
  const AMPLITUDE = $derived(Math.min(112, W * 0.29));

  const height = $derived(BOTTOM_PAD + (levels.length - 1) * PITCH + TOP_PAD);

  /** Serpentine walk up the sky; index 0 sits at the bottom, by the home body. */
  const points = $derived(
    levels.map((_, i) => ({
      x: W / 2 + AMPLITUDE * Math.sin(i * 0.82 + 0.6),
      y: height - BOTTOM_PAD - i * PITCH,
    })),
  );

  /** Fixed-seed noise so decoration never reshuffles between renders. */
  function makeRng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const decor = $derived.by(() => {
    const rnd = makeRng(20260815);
    const stars = Array.from({ length: Math.round(height / 11) }, () => ({
      x: rnd() * W,
      y: rnd() * height,
      size: rnd() < 0.15 ? 2.5 : 1.5,
      opacity: 0.15 + rnd() * 0.55,
      color: map.starColors[Math.floor(rnd() * map.starColors.length)],
    }));
    const twinkles = Array.from({ length: Math.round(height / 90) }, () => ({
      x: 12 + rnd() * (W - 24),
      y: 20 + rnd() * (height - 40),
      size: 8 + rnd() * 4,
      delay: rnd() * 3,
      duration: 2.5 + rnd() * 2,
      color: map.starColors[Math.floor(rnd() * map.starColors.length)],
    }));
    const clouds = Array.from({ length: Math.round(height / 230) }, (_, i) => {
      const size = 150 + rnd() * 90;
      return {
        x: rnd() * W - 40,
        y: i * 230 + rnd() * 60,
        w: size,
        h: size * 0.7,
        color: map.nebulas[i % map.nebulas.length],
      };
    });
    return { stars, twinkles, clouds };
  });

  const pathBehind = $derived(
    points
      .slice(0, Math.min(currentIndex, levels.length - 1) + 1)
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  const pathAhead = $derived(
    points
      .slice(Math.min(currentIndex, levels.length - 1))
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  function bodySize(i: number): number {
    return [30, 34, 28, 36, 32, 26][i % 6];
  }

  function paletteFor(i: number, done: boolean, current: boolean): string[] {
    if (current) return map.currentPalette;
    if (!done) return map.lockedPalette;
    return map.bodyPalettes[i % map.bodyPalettes.length];
  }

  function bodyStyle(pal: string[], size: number): string {
    return (
      `width:${size}px;height:${size}px;` +
      `background:radial-gradient(circle at 35% 28%, ${pal[0]}, ${pal[1]} 55%, ${pal[2]})`
    );
  }

  let scroller: HTMLDivElement;
  let centred = -1;

  /** Centre on the frontier once laid out, and again whenever it advances. */
  $effect(() => {
    const idx = currentIndex;
    if (!scroller || W < 2 || centred === idx) return;
    requestAnimationFrame(() => {
      if (!scroller || scroller.clientHeight < 2) return;
      const target = points[Math.min(idx, points.length - 1)];
      scroller.scrollTo({
        top: Math.max(0, target.y - scroller.clientHeight * 0.62),
        behavior: centred === -1 ? 'auto' : 'smooth',
      });
      centred = idx;
    });
  });
</script>

<div class="scroller" bind:this={scroller} bind:clientWidth={W}>
  <div class="sky" style="height:{height}px;background:linear-gradient({map.sky.join(', ')})">
    {#each decor.clouds as c, i (i)}
      <div
        class="cloud"
        style="left:{c.x}px;top:{c.y}px;width:{c.w}px;height:{c.h}px;background:radial-gradient(closest-side, {c.color}, transparent)"
      ></div>
    {/each}

    {#each decor.stars as s, i (i)}
      <div
        class="star-dot"
        style="left:{s.x}px;top:{s.y}px;width:{s.size}px;height:{s.size}px;opacity:{s.opacity};background:{s.color}"
      ></div>
    {/each}

    {#each decor.twinkles as t, i (i)}
      <span
        class="twinkle"
        style="left:{t.x}px;top:{t.y}px;font-size:{t.size}px;color:{t.color};animation-delay:{t.delay}s;animation-duration:{t.duration}s"
        >✦</span
      >
    {/each}

    <div
      class="home-body"
      style="width:{W * 1.25}px;height:{W * 1.25}px;bottom:{-W * 1.02}px;background:radial-gradient(circle at 32% 18%, {map.homePalette[0]}, {map.homePalette[1]} 45%, {map.homePalette[2]} 78%, {map.homePalette[2]})"
    ></div>
    <div class="launchpad"></div>

    <svg class="paths" width={W} {height} aria-hidden="true">
      <polyline
        points={pathAhead}
        fill="none"
        stroke={map.pathAhead}
        stroke-width="1.5"
        stroke-dasharray="1 7"
        stroke-linecap="round"
        opacity="0.7"
      />
      <polyline
        points={pathBehind}
        fill="none"
        stroke={map.pathBehind}
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.6"
      />
    </svg>

    {#each levels as level, i (i)}
      {@const p = points[i]}
      {@const done = doneSet.has(i)}
      {@const current = i === currentIndex && !done}
      {@const locked = i > currentIndex && !done}
      {@const isFinal = i === levels.length - 1}
      {@const stars = starsFor(i)}
      {@const size = isFinal ? 42 : bodySize(i)}
      {@const pal = paletteFor(i, done, current)}

      {#if level.special}
        <div class="node-abs" style="left:{p.x}px;top:{p.y}px">
          <button
            class="station"
            class:lit={done}
            disabled={locked}
            onclick={() => onSelect(i)}
            aria-label={`Level ${i + 1}: ${level.name}${done ? `, completed, ${stars} of 3 stars` : locked ? ', locked' : ''}`}
          >
            <span class="panel left"></span>
            <span class="core">{done ? partGlyphs[level.partIndex ?? 0] : i + 1}</span>
            <span class="panel right"></span>
          </button>
          <span class="stars" class:dim={locked}>
            {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < stars}>★</span>{/each}
          </span>
        </div>
      {:else}
        <div class="node-abs" style="left:{p.x}px;top:{p.y}px">
          {#if current}<span class="pulse"></span>{/if}
          {#if isFinal}<span class="final-ring"></span>{/if}
          {#if done && i % 7 === 2}<span class="ring" style="border-color:{pal[1]}aa"></span>{/if}
          <button
            class="body"
            class:locked
            style={bodyStyle(pal, size)}
            disabled={locked}
            onclick={() => onSelect(i)}
            aria-label={`Level ${i + 1}: ${level.name}${done ? `, completed, ${stars} of 3 stars` : locked ? ', locked' : ''}`}
          >
            {#if done && i % 3 === 1}
              <span class="band" style="background:{pal[2]};top:32%"></span>
              <span class="band" style="background:{pal[0]};top:58%;height:16%"></span>
            {/if}
            {#if done && i % 3 === 0}
              <span class="crater" style="background:{pal[2]};left:58%;top:22%;width:26%;height:26%"></span>
              <span class="crater" style="background:{pal[2]};left:30%;top:58%;width:18%;height:18%"></span>
            {/if}
            <span class="num" class:dark={done || current} style={isFinal ? 'font-size:17px' : ''}>
              {isFinal && !done ? map.finalGlyph : i + 1}
            </span>
          </button>
          <span class="stars" class:dim={locked}>
            {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < stars}>★</span>{/each}
          </span>
        </div>
      {/if}
    {/each}

    {#if currentIndex < levels.length}
      {@const p = points[currentIndex]}
      <svg class="rocket" style="left:{p.x - 38}px;top:{p.y - 40}px" width="24" height="32" viewBox="0 0 24 32">
        <path d="M12 1 C16 6 17 12 16 20 L8 20 C7 12 8 6 12 1 Z" fill="#f2ead8" stroke="#3f3a33" stroke-width="1" />
        <path d="M12 1 C14 3.5 15 6 15.3 8 L8.7 8 C9 6 10 3.5 12 1 Z" fill="#c94f3d" />
        <circle cx="12" cy="13" r="2.8" fill="#7fa8bd" stroke="#3f3a33" stroke-width="0.8" />
        <path d="M8 20 L4 27 L8.5 24 Z" fill="#c94f3d" />
        <path d="M16 20 L20 27 L15.5 24 Z" fill="#c94f3d" />
        <path class="flame" d="M10 21 L12 30 L14 21 Z" fill="#e3a84f" />
      </svg>
    {/if}
  </div>
</div>

<style>
  .scroller {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior-y: contain;
  }

  .sky {
    position: relative;
    width: 100%;
    /* Clip the home body so it reads as a horizon, not scrollable dead space. */
    overflow: hidden;
  }

  .cloud,
  .star-dot {
    position: absolute;
    border-radius: 50%;
  }

  .twinkle {
    position: absolute;
    line-height: 1;
    animation-name: tw;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }

  @keyframes tw {
    0%,
    100% {
      opacity: 0.15;
    }
    50% {
      opacity: 0.9;
    }
  }

  .home-body {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
  }

  .launchpad {
    position: absolute;
    left: 50%;
    bottom: 66px;
    width: 22px;
    height: 5px;
    border-radius: 50%;
    background: #7c5a33;
    transform: translateX(-50%);
  }

  .paths {
    position: absolute;
    left: 0;
    top: 0;
  }

  .node-abs {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .body {
    position: relative;
    border: 0;
    border-radius: 50%;
    overflow: hidden;
    padding: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-family: var(--font-sans);
  }

  .body.locked {
    border: 1.5px solid #3d4870;
    cursor: default;
  }

  .band,
  .crater {
    position: absolute;
    pointer-events: none;
  }

  .band {
    left: -20%;
    width: 140%;
    height: 12%;
    opacity: 0.35;
    transform: rotate(-12deg);
  }

  .crater {
    border-radius: 50%;
    opacity: 0.5;
  }

  .num {
    position: relative;
    font-size: 12px;
    font-weight: 600;
    color: #9aa6c8;
  }

  .num.dark {
    color: #2a2010;
  }

  .ring,
  .final-ring,
  .pulse {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    border-radius: 50%;
  }

  .ring {
    width: 56px;
    height: 17px;
    border: 1.5px solid;
    transform: translate(-50%, -50%) rotate(-20deg);
  }

  .final-ring {
    width: 66px;
    height: 22px;
    border: 1.5px solid #e3c27c66;
    transform: translate(-50%, -50%) rotate(-16deg);
  }

  .pulse {
    width: 46px;
    height: 46px;
    border: 1.5px solid #e3c27c;
    animation: pw 2.2s ease-out infinite;
  }

  @keyframes pw {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.7;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.9);
      opacity: 0;
    }
  }

  .station {
    position: relative;
    width: 58px;
    height: 26px;
    border: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .station:disabled {
    cursor: default;
  }

  .panel {
    position: absolute;
    top: 8px;
    width: 15px;
    height: 11px;
    border-radius: 2px;
    background: #22315a;
    border: 1px solid #3d4870;
  }

  .panel.left {
    left: 0;
  }

  .panel.right {
    right: 0;
  }

  .station.lit .panel {
    background: #3a5a9c;
    border-color: #7fa8dd;
  }

  .core {
    position: relative;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    background: radial-gradient(circle at 35% 28%, #4a5578, #333e63 70%);
    border: 1px solid #3d4870;
    color: #9aa6c8;
  }

  .station.lit .core {
    background: radial-gradient(circle at 35% 28%, #f0d9a0, #d4af6a 60%, #8a6a2f);
    border-color: #8a6a2f;
    color: #3a2c10;
  }

  .stars {
    display: flex;
    gap: 1px;
    line-height: 1;
  }

  .stars.dim {
    opacity: 0.4;
  }

  .star {
    font-size: 9px;
    color: transparent;
    -webkit-text-stroke: 0.8px #8a93b8;
  }

  .star.filled {
    color: #e3c27c;
    -webkit-text-stroke: 0;
  }

  .rocket {
    position: absolute;
    transform: rotate(-24deg);
    z-index: 3;
    pointer-events: none;
  }

  .flame {
    animation: fl 0.5s linear infinite;
  }

  @keyframes fl {
    0%,
    100% {
      opacity: 0.9;
    }
    50% {
      opacity: 0.4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .twinkle,
    .pulse,
    .flame {
      animation: none;
    }
  }
</style>
