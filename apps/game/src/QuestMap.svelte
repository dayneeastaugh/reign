<script lang="ts">
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

  const PITCH = 88;
  const BOTTOM_PAD = 165;
  const TOP_PAD = 110;

  let W = $state(360);
  const AMPLITUDE = $derived(Math.min(120, W * 0.31));

  const height = $derived(BOTTOM_PAD + (levels.length - 1) * PITCH + TOP_PAD);

  const points = $derived(
    levels.map((_, i) => ({
      x: W / 2 + AMPLITUDE * Math.sin(i * 0.72 + 0.6),
      y: height - BOTTOM_PAD - i * PITCH,
    })),
  );

  const lastIndex = $derived(levels.length - 1);

  /**
   * Visual hierarchy: stations and every fifth world (plus the first and last)
   * become large named bodies; the rest are waypoints on the route. Keeps a
   * 50-level journey from reading as fifty identical circles.
   */
  function tierOf(i: number): 'station' | 'world' | 'waypoint' {
    if (levels[i].special) return 'station';
    if (i === 0 || i === lastIndex || (i + 1) % 5 === 0) return 'world';
    return 'waypoint';
  }

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
    const stars = Array.from({ length: Math.round(height / 9) }, () => ({
      x: rnd() * W,
      y: rnd() * height,
      size: rnd() < 0.14 ? 2.5 : 1.4,
      opacity: 0.15 + rnd() * 0.55,
      color: map.starColors[Math.floor(rnd() * map.starColors.length)],
    }));
    const twinkles = Array.from({ length: Math.round(height / 85) }, () => ({
      x: 14 + rnd() * (W - 28),
      y: 20 + rnd() * (height - 40),
      size: 8 + rnd() * 5,
      delay: rnd() * 3,
      duration: 2.4 + rnd() * 2.2,
      color: map.starColors[Math.floor(rnd() * map.starColors.length)],
    }));
    const clouds = Array.from({ length: Math.round(height / 210) }, (_, i) => {
      const size = 170 + rnd() * 110;
      return {
        x: rnd() * W - 50,
        y: i * 210 + rnd() * 70,
        w: size,
        h: size * 0.68,
        color: map.nebulas[i % map.nebulas.length],
      };
    });
    /** Faint spiral galaxies drifting in the deep field. */
    const galaxies = Array.from({ length: Math.max(2, Math.round(height / 1100)) }, (_, i) => ({
      x: rnd() * (W - 120),
      y: 140 + i * 1050 + rnd() * 260,
      size: 96 + rnd() * 54,
      tilt: -40 + rnd() * 80,
    }));
    /** Constellation clusters: a few nodes joined by hairlines. */
    const constellations = Array.from({ length: Math.round(height / 620) }, () => {
      const ox = 20 + rnd() * (W - 110);
      const oy = 40 + rnd() * (height - 80);
      const pts = Array.from({ length: 4 + Math.floor(rnd() * 2) }, () => ({
        x: ox + rnd() * 74,
        y: oy + rnd() * 62,
      }));
      return pts;
    });
    /** Small asteroid drifts, loosely following the route. */
    const asteroids = Array.from({ length: Math.round(height / 330) }, () => {
      const cx = rnd() * W;
      const cy = rnd() * height;
      return Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({
        x: cx + (rnd() - 0.5) * 54,
        y: cy + (rnd() - 0.5) * 34,
        r: 1.6 + rnd() * 2.6,
        rot: rnd() * 360,
      }));
    });
    return { stars, twinkles, clouds, galaxies, constellations, asteroids };
  });

  const pathBehind = $derived(
    points
      .slice(0, Math.min(currentIndex, lastIndex) + 1)
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  const pathAhead = $derived(
    points
      .slice(Math.min(currentIndex, lastIndex))
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  function worldSize(i: number): number {
    if (i === lastIndex) return 74;
    return [58, 66, 52, 62, 56, 68][i % 6];
  }

  function paletteFor(i: number, done: boolean, current: boolean): string[] {
    if (current) return map.currentPalette;
    if (!done) return map.lockedPalette;
    return map.bodyPalettes[i % map.bodyPalettes.length];
  }

  /**
   * An occasional streak across the field. It is deliberately rare, faint and
   * quick — something you half-catch rather than watch. Spawned inside the
   * visible band so it is never wasted off-screen, skipped while the tab is
   * hidden, and absent entirely for reduced motion or themes that omit the
   * colour.
   */
  interface Comet {
    id: number;
    x: number;
    y: number;
    angle: number;
    length: number;
    duration: number;
    travel: number;
  }

  let comet = $state<Comet | null>(null);

  $effect(() => {
    if (!map.cometColor) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let clear: ReturnType<typeof setTimeout>;

    const fire = () => {
      if (!scroller || document.visibilityState !== 'visible') return;
      const top = scroller.scrollTop;
      const band = scroller.clientHeight;
      const goingLeft = Math.random() < 0.5;
      const angle = (goingLeft ? 155 : 25) + (Math.random() * 16 - 8);
      const duration = 1100 + Math.random() * 700;
      comet = {
        id: Date.now(),
        x: goingLeft ? W * (0.65 + Math.random() * 0.3) : W * (0.05 + Math.random() * 0.3),
        y: top + band * (0.12 + Math.random() * 0.5),
        angle,
        length: 46 + Math.random() * 40,
        duration,
        travel: W * (0.45 + Math.random() * 0.35),
      };
      clear = setTimeout(() => (comet = null), duration + 60);
    };

    const schedule = () => {
      timer = setTimeout(
        () => {
          fire();
          schedule();
        },
        14000 + Math.random() * 26000,
      );
    };

    // Not immediately on arrival — it should feel incidental, not staged.
    timer = setTimeout(() => {
      fire();
      schedule();
    }, 5000 + Math.random() * 9000);

    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  });

  /** $state so the centring effect re-runs once the node is attached. */
  let scroller = $state<HTMLDivElement | null>(null);
  /** Keyed on width too: a resize relays the walk, so re-centre after it. */
  let centred = '';

  $effect(() => {
    const idx = currentIndex;
    const key = `${idx}:${W}`;
    if (!scroller || W < 2 || centred === key) return;
    const first = centred === '';
    requestAnimationFrame(() => {
      if (!scroller || scroller.clientHeight < 2) return;
      const target = points[Math.min(idx, lastIndex)];
      scroller.scrollTo({
        top: Math.max(0, target.y - scroller.clientHeight * 0.6),
        behavior: first ? 'auto' : 'smooth',
      });
      centred = key;
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

    {#each decor.galaxies as g, i (i)}
      <div class="galaxy" style="left:{g.x}px;top:{g.y}px;width:{g.size}px;height:{g.size * 0.5}px;transform:rotate({g.tilt}deg)">
        <span class="galaxy-arm" style="background:radial-gradient(closest-side, {map.galaxyColor ?? 'rgba(206,214,245,0.45)'}, transparent 72%)"></span>
        <span class="galaxy-core" style="background:radial-gradient(closest-side, {map.starColors[1]}, transparent 70%)"></span>
      </div>
    {/each}

    <svg class="deepfield" width={W} {height} aria-hidden="true">
      {#each decor.constellations as pts, i (i)}
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={map.constellationColor ?? 'rgba(205,214,239,0.3)'}
          stroke-width="0.8"
          stroke-dasharray="2 3"
        />
        {#each pts as p, j (j)}
          <circle cx={p.x} cy={p.y} r="1.5" fill={map.constellationColor ?? 'rgba(205,214,239,0.5)'} />
        {/each}
      {/each}
      {#each decor.asteroids as cluster, i (i)}
        {#each cluster as a, j (j)}
          <ellipse
            cx={a.x}
            cy={a.y}
            rx={a.r}
            ry={a.r * 0.72}
            fill={map.asteroidColor ?? '#6b6f85'}
            opacity="0.7"
            transform="rotate({a.rot} {a.x} {a.y})"
          />
        {/each}
      {/each}
    </svg>

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
        opacity="0.55"
      />
    </svg>

    {#each levels as level, i (i)}
      {@const p = points[i]}
      {@const done = doneSet.has(i)}
      {@const current = i === currentIndex && !done}
      {@const locked = i > currentIndex && !done}
      {@const tier = tierOf(i)}
      {@const stars = starsFor(i)}
      {@const pal = paletteFor(i, done, current)}
      {@const labelLeft = p.x > W / 2}
      {@const aria = `Level ${i + 1}: ${level.name}${done ? `, completed, ${stars} of 3 stars` : locked ? ', locked' : ''}`}

      <div class="node-abs" class:big={tier !== 'waypoint'} style="left:{p.x}px;top:{p.y}px">
        {#if current}<span class="pulse"></span>{/if}

        {#if tier === 'station'}
          <button class="station" class:lit={done} disabled={locked} onclick={() => onSelect(i)} aria-label={aria}>
            <span class="mast"></span>
            <span class="panel left"></span>
            <span class="panel right"></span>
            <span class="core">{done ? partGlyphs[level.partIndex ?? 0] : i + 1}</span>
          </button>
        {:else if tier === 'world'}
          {@const size = worldSize(i)}
          {#if !locked}
            <span
              class="atmos"
              style="width:{size + 16}px;height:{size + 16}px;background:radial-gradient(closest-side, transparent 58%, {pal[0]}3a 78%, transparent)"
            ></span>
          {/if}
          {#if i === lastIndex}<span class="final-ring" style="width:{size + 34}px"></span>{/if}
          {#if done && i % 7 === 2}
            <span class="ring" style="width:{size + 26}px;height:{size * 0.34}px;border-color:{pal[1]}bb"></span>
          {/if}
          <button
            class="world"
            class:locked
            style="width:{size}px;height:{size}px;background:radial-gradient(circle at 34% 26%, {pal[0]}, {pal[1]} 52%, {pal[2]})"
            disabled={locked}
            onclick={() => onSelect(i)}
            aria-label={aria}
          >
            {#if !locked}
              {#if i % 3 === 1}
                <span class="band" style="background:{pal[2]};top:30%;height:13%"></span>
                <span class="band" style="background:{pal[0]};top:56%;height:17%"></span>
              {/if}
              {#if i % 3 === 0}
                <span class="crater" style="background:{pal[2]};left:56%;top:20%;width:24%;height:24%"></span>
                <span class="crater" style="background:{pal[2]};left:28%;top:56%;width:16%;height:16%"></span>
                <span class="crater" style="background:{pal[2]};left:62%;top:62%;width:12%;height:12%"></span>
              {/if}
              {#if i % 4 === 2}
                <span class="cap" style="background:{pal[0]}"></span>
              {/if}
              {#if i % 5 === 3}
                <span class="spot" style="background:{pal[2]}"></span>
              {/if}
            {/if}
            <span class="terminator"></span>
            <span class="num big-num" class:dark={done || current}>{i + 1}</span>
          </button>
        {:else}
          <button
            class="waypoint"
            class:done
            class:locked
            disabled={locked}
            onclick={() => onSelect(i)}
            aria-label={aria}
          >
            <span class="num">{i + 1}</span>
          </button>
        {/if}

        <span class="stars" class:dim={locked} class:tiny={tier === 'waypoint'}>
          {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < stars}>★</span>{/each}
        </span>

        {#if tier !== 'waypoint'}
          <span class="label" class:left={labelLeft} class:muted={locked}>{level.name}</span>
        {/if}
      </div>
    {/each}

    {#if comet}
      {#key comet.id}
        <div
          class="comet-rail"
          style="left:{comet.x}px;top:{comet.y}px;transform:rotate({comet.angle}deg)"
          aria-hidden="true"
        >
          <span
            class="comet"
            style="width:{comet.length}px;--travel:{comet.travel}px;animation-duration:{comet.duration}ms;background:linear-gradient(90deg, transparent, {map.cometColor})"
          ></span>
        </div>
      {/key}
    {/if}

    {#if currentIndex <= lastIndex}
      {@const p = points[currentIndex]}
      <svg class="rocket" style="left:{p.x - 44}px;top:{p.y - 46}px" width="28" height="37" viewBox="0 0 24 32">
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
    /* Decor re-renders on resize; anchoring would yank the view off the frontier. */
    overflow-anchor: none;
  }

  .sky {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .cloud,
  .star-dot {
    position: absolute;
    border-radius: 50%;
  }

  .galaxy {
    position: absolute;
    pointer-events: none;
  }

  .galaxy-arm,
  .galaxy-core {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }

  .galaxy-core {
    inset: 34% 38%;
    opacity: 0.9;
  }

  .deepfield,
  .paths {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
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
      opacity: 0.95;
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
    bottom: 78px;
    width: 24px;
    height: 6px;
    border-radius: 50%;
    background: #7c5a33;
    transform: translateX(-50%);
  }

  .node-abs {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .world,
  .waypoint,
  .station {
    position: relative;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-family: var(--font-sans);
  }

  .world {
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }

  .world.locked,
  .waypoint.locked,
  .station:disabled {
    cursor: default;
  }

  .world.locked {
    box-shadow: none;
    outline: 1.5px solid #3d4870;
    outline-offset: -1.5px;
  }

  /* Sunlit from upper-left: a soft terminator gives every body volume. */
  .terminator {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow: inset -9px -9px 20px rgba(0, 0, 0, 0.42);
    pointer-events: none;
  }

  .band,
  .crater,
  .cap,
  .spot {
    position: absolute;
    pointer-events: none;
  }

  .band {
    left: -20%;
    width: 140%;
    opacity: 0.32;
    transform: rotate(-11deg);
  }

  .crater {
    border-radius: 50%;
    opacity: 0.45;
  }

  .cap {
    left: 26%;
    top: -6%;
    width: 48%;
    height: 26%;
    border-radius: 50%;
    opacity: 0.75;
  }

  .spot {
    left: 20%;
    top: 44%;
    width: 26%;
    height: 16%;
    border-radius: 50%;
    opacity: 0.5;
    transform: rotate(-14deg);
  }

  .atmos,
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
    border: 1.5px solid;
    transform: translate(-50%, -50%) rotate(-19deg);
  }

  .final-ring {
    height: 26px;
    border: 1.5px solid #e3c27c88;
    transform: translate(-50%, -50%) rotate(-15deg);
  }

  .pulse {
    width: 62px;
    height: 62px;
    border: 1.5px solid #e3c27c;
    animation: pw 2.4s ease-out infinite;
  }

  @keyframes pw {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.7;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.7);
      opacity: 0;
    }
  }

  .waypoint {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1.5px solid #46527c;
    background: radial-gradient(circle at 35% 30%, #2b3459, #1b2340 70%);
  }

  .waypoint.done {
    border-color: #e3c27c;
    background: radial-gradient(circle at 35% 30%, #f0d9a0, #d4af6a 65%, #9c7736);
  }

  .waypoint.locked {
    opacity: 0.55;
  }

  .num {
    position: relative;
    font-size: 11px;
    font-weight: 600;
    color: #9aa6c8;
  }

  .big-num {
    font-size: 14px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    color: #e8eaf4;
  }

  .waypoint.done .num,
  .num.dark {
    color: #2a2010;
    text-shadow: none;
  }

  .station {
    width: 74px;
    height: 34px;
  }

  .mast {
    position: absolute;
    left: 50%;
    top: 2px;
    width: 1.5px;
    height: 8px;
    background: #8a93b8;
    transform: translateX(-50%);
  }

  .panel {
    position: absolute;
    top: 11px;
    width: 20px;
    height: 13px;
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
    background: linear-gradient(#4a6fb4, #33518c);
    border-color: #7fa8dd;
  }

  .core {
    position: relative;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 600;
    background: radial-gradient(circle at 35% 28%, #4a5578, #333e63 70%);
    border: 1.5px solid #3d4870;
    color: #9aa6c8;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
  }

  .station.lit .core {
    background: radial-gradient(circle at 35% 28%, #f6e6bb, #d4af6a 58%, #8a6a2f);
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
    font-size: 10px;
    color: transparent;
    -webkit-text-stroke: 0.8px #8a93b8;
  }

  .stars.tiny .star {
    font-size: 8px;
  }

  .star.filled {
    color: #e3c27c;
    -webkit-text-stroke: 0;
  }

  .label {
    position: absolute;
    top: 50%;
    left: calc(50% + 44px);
    transform: translateY(-50%);
    font-family: var(--font-serif);
    font-size: 12.5px;
    color: #f2ead8;
    white-space: nowrap;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    pointer-events: none;
  }

  .label.left {
    left: auto;
    right: calc(50% + 44px);
  }

  .label.muted {
    color: #8a93b8;
  }

  .comet-rail {
    position: absolute;
    transform-origin: 0 50%;
    pointer-events: none;
    z-index: 1;
  }

  .comet {
    display: block;
    height: 1.5px;
    border-radius: 1px;
    opacity: 0;
    animation-name: comet-drift;
    animation-timing-function: cubic-bezier(0.4, 0, 0.7, 1);
    animation-fill-mode: forwards;
  }

  @keyframes comet-drift {
    0% {
      transform: translateX(0);
      opacity: 0;
    }
    18% {
      opacity: 0.85;
    }
    75% {
      opacity: 0.5;
    }
    100% {
      transform: translateX(var(--travel));
      opacity: 0;
    }
  }

  .rocket {
    position: absolute;
    transform: rotate(-24deg);
    z-index: 3;
    pointer-events: none;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
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
    .flame,
    .comet {
      animation: none;
    }
  }
</style>
