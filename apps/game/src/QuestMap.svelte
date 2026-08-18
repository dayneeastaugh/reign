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

  const BOTTOM_PAD = 150;
  const TOP_PAD = 120;
  /** Ordinary stops sit closer together; a milestone earns room to breathe. */
  const STEP_WAYPOINT = 64;
  const STEP_MILESTONE = 104;
  /** Keeps a node and its plaque clear of the edges. */
  const SIDE_MARGIN = 56;

  let W = $state(360);
  const AMPLITUDE = $derived(Math.max(44, Math.min(124, W * 0.33)));

  const lastIndex = $derived(levels.length - 1);
  /** A building, not a sky: different shapes throughout, not a recolour. */
  const interior = $derived(map.style === 'interior');

  function tierOf(i: number): 'station' | 'world' | 'waypoint' {
    if (levels[i].special) return 'station';
    if (i === 0 || i === lastIndex || (i + 1) % 5 === 0) return 'world';
    return 'waypoint';
  }

  /** Distance from the previous stop, so the route has rhythm rather than a beat. */
  const steps = $derived(
    levels.map((_, i) =>
      i === 0 ? 0 : tierOf(i) === 'waypoint' && tierOf(i - 1) === 'waypoint'
        ? STEP_WAYPOINT
        : STEP_MILESTONE,
    ),
  );

  const totalRise = $derived(steps.reduce((a, b) => a + b, 0));
  const height = $derived(BOTTOM_PAD + totalRise + TOP_PAD);

  /**
   * A triangle sweep sets the side, so the route always crosses the full width
   * instead of drifting to one edge as summed sines did; a small sine on top
   * keeps it from marching. Clamped so a node and its plaque stay in frame.
   */
  const points = $derived.by(() => {
    let y = height - BOTTOM_PAD;
    return levels.map((_, i) => {
      y -= steps[i];
      const t = (i / 3.5) % 2;
      const sweep = t < 1 ? t * 2 - 1 : 3 - t * 2;
      const wander = 0.86 * sweep + 0.14 * Math.sin(i * 1.7 + 0.6);
      const half = Math.max(0, W / 2 - SIDE_MARGIN);
      return { x: W / 2 + Math.max(-half, Math.min(half, AMPLITUDE * wander)), y };
    });
  });

  /**
   * Catmull-Rom through the stops, emitted as cubic segments. A polyline kinked
   * at every node; a curve reads as a route.
   */
  function smoothPath(pts: Array<{ x: number; y: number }>): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  /** Where the ground changes — the route passing from one room into the next. */
  const dividers = $derived.by(() =>
    levels
      .map((level, i) => ({ i, variant: level.variant ?? '' }))
      .filter(({ i, variant }) => i > 0 && variant && variant !== (levels[i - 1].variant ?? ''))
      .filter(({ i }) => !levels[i].special && !levels[i - 1].special)
      .map(({ i }) => (points[i].y + points[i - 1].y) / 2),
  );

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

  const pathBehind = $derived(smoothPath(points.slice(0, Math.min(currentIndex, lastIndex) + 1)));
  const pathAhead = $derived(smoothPath(points.slice(Math.min(currentIndex, lastIndex))));

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
  <div
    class="sky"
    style="height:{height}px;background:linear-gradient({map.sky.join(', ')});
      --node-ink:{map.starColors[0]};--rim:{map.pathAhead};--earned:{map.pathBehind};
      --locked-a:{map.lockedPalette[0]};--locked-b:{map.lockedPalette[1]};
      --label:{map.starColors[2] ?? map.starColors[0]}"
  >
    {#each decor.clouds as c, i (i)}
      <div
        class="cloud"
        style="left:{c.x}px;top:{c.y}px;width:{c.w}px;height:{c.h}px;background:radial-gradient(closest-side, {c.color}, transparent)"
      ></div>
    {/each}

    {#if interior}
      {#each decor.galaxies as g, i (i)}
        <!-- A wall clock, ticking somewhere above the benches -->
        <svg
          class="clockface"
          style="left:{g.x}px;top:{g.y}px"
          width={g.size * 0.6}
          height={g.size * 0.6}
          viewBox="0 0 40 40"
          aria-hidden="true"
        >
          <circle cx="20" cy="20" r="17" fill="none" stroke={map.galaxyColor} stroke-width="1.4" />
          <circle cx="20" cy="20" r="14" fill="none" stroke={map.galaxyColor} stroke-width="0.5" />
          {#each [0, 3, 6, 9] as tick (tick)}
            <line
              x1={20 + 12 * Math.sin((tick / 12) * 2 * Math.PI)}
              y1={20 - 12 * Math.cos((tick / 12) * 2 * Math.PI)}
              x2={20 + 15 * Math.sin((tick / 12) * 2 * Math.PI)}
              y2={20 - 15 * Math.cos((tick / 12) * 2 * Math.PI)}
              stroke={map.galaxyColor}
              stroke-width="1.2"
            />
          {/each}
          <line x1="20" y1="20" x2="20" y2="11" stroke={map.galaxyColor} stroke-width="1.3" />
          <line x1="20" y1="20" x2="26" y2="23" stroke={map.galaxyColor} stroke-width="1.1" />
        </svg>
      {/each}
    {:else}
    {#each decor.galaxies as g, i (i)}
      <div class="galaxy" style="left:{g.x}px;top:{g.y}px;width:{g.size}px;height:{g.size * 0.5}px;transform:rotate({g.tilt}deg)">
        <span class="galaxy-arm" style="background:radial-gradient(closest-side, {map.galaxyColor ?? 'rgba(206,214,245,0.45)'}, transparent 72%)"></span>
        <span class="galaxy-core" style="background:radial-gradient(closest-side, {map.starColors[1]}, transparent 70%)"></span>
      </div>
    {/each}
    {/if}

    <svg class="deepfield" width={W} {height} aria-hidden="true">
      {#each decor.constellations as pts, i (i)}
        {#if interior}
          <!-- Pneumatic tube runs: right angles and couplings, not star lines -->
          <path
            d={pts
              .map((p, j) =>
                j === 0 ? `M ${p.x} ${p.y}` : `L ${pts[j - 1].x} ${p.y} L ${p.x} ${p.y}`,
              )
              .join(' ')}
            fill="none"
            stroke={map.constellationColor ?? 'rgba(226,204,160,0.32)'}
            stroke-width="2"
            stroke-linecap="square"
            stroke-linejoin="miter"
          />
          {#each pts as p, j (j)}
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              fill="none"
              stroke={map.constellationColor ?? 'rgba(226,204,160,0.32)'}
              stroke-width="1.4"
            />
          {/each}
        {:else}
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
        {/if}
      {/each}
      {#each decor.asteroids as cluster, i (i)}
        {#each cluster as a, j (j)}
          {#if interior}
            <!-- A letter adrift between floors -->
            <g transform="rotate({a.rot} {a.x} {a.y})" opacity="0.65">
              <rect
                x={a.x - a.r * 1.7}
                y={a.y - a.r * 1.1}
                width={a.r * 3.4}
                height={a.r * 2.2}
                fill={map.asteroidColor ?? '#6b5a44'}
                rx="0.6"
              />
              <path
                d="M {a.x - a.r * 1.7} {a.y - a.r * 1.1} L {a.x} {a.y + a.r * 0.25} L {a.x + a.r * 1.7} {a.y - a.r * 1.1}"
                fill="none"
                stroke={map.sky[0]}
                stroke-width="0.7"
              />
            </g>
          {:else}
            <ellipse
              cx={a.x}
              cy={a.y}
              rx={a.r}
              ry={a.r * 0.72}
              fill={map.asteroidColor ?? '#6b6f85'}
              opacity="0.7"
              transform="rotate({a.rot} {a.x} {a.y})"
            />
          {/if}
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

    {#if interior}
      <div class="doorway">
        <span class="door-panel" style="background:linear-gradient({map.homePalette[1]}, {map.homePalette[2]})"></span>
        <span class="door-plate" style="background:linear-gradient({map.homePalette[0]}, {map.homePalette[1]})">
          <span class="door-slot" style="background:{map.sky[0]}"></span>
        </span>
        <span class="door-mat" style="background:{map.lockedPalette[0]}"></span>
      </div>
    {:else}
      <div
        class="home-body"
        style="width:{W * 1.25}px;height:{W * 1.25}px;bottom:{-W * 1.02}px;background:radial-gradient(circle at 32% 18%, {map.homePalette[0]}, {map.homePalette[1]} 45%, {map.homePalette[2]} 78%, {map.homePalette[2]})"
      ></div>
      <div class="launchpad"></div>
    {/if}

    <svg class="paths" width={W} {height} aria-hidden="true">
      {#each dividers as y, i (i)}
        <g opacity="0.5">
          <line x1="26" y1={y} x2={W / 2 - 12} y2={y} stroke={map.pathAhead} stroke-width="0.75" />
          <line x1={W / 2 + 12} y1={y} x2={W - 26} y2={y} stroke={map.pathAhead} stroke-width="0.75" />
          <path
            d="M {W / 2} {y - 4} L {W / 2 + 4} {y} L {W / 2} {y + 4} L {W / 2 - 4} {y} Z"
            fill={map.pathAhead}
          />
        </g>
      {/each}
      <path
        d={pathAhead}
        fill="none"
        stroke={map.pathAhead}
        stroke-width="1.5"
        stroke-dasharray="1 7"
        stroke-linecap="round"
        opacity="0.7"
      />
      <path
        d={pathBehind}
        fill="none"
        stroke={map.pathBehind}
        stroke-width="2.5"
        stroke-linecap="round"
        opacity="0.6"
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

        {#if tier === 'station' && interior}
          <!-- A franking counter: two benches and the press between them -->
          <button class="counter" class:lit={done} disabled={locked} onclick={() => onSelect(i)} aria-label={aria}>
            <span class="bench left"></span>
            <span class="bench right"></span>
            <span class="lever"></span>
            <span class="press">{done ? partGlyphs[level.partIndex ?? 0] : i + 1}</span>
          </button>
        {:else if tier === 'station'}
          <button class="station" class:lit={done} disabled={locked} onclick={() => onSelect(i)} aria-label={aria}>
            <span class="mast"></span>
            <span class="panel left"></span>
            <span class="panel right"></span>
            <span class="core">{done ? partGlyphs[level.partIndex ?? 0] : i + 1}</span>
          </button>
        {:else if tier === 'world' && interior}
          {@const size = worldSize(i)}
          <!-- A parcel waiting on the shelf, twine and all -->
          <button
            class="parcel"
            class:locked
            style="width:{size}px;height:{size * 0.78}px;
              background:linear-gradient({pal[0]}, {pal[1]});border-color:{pal[2]}"
            disabled={locked}
            onclick={() => onSelect(i)}
            aria-label={aria}
          >
            <span class="twine v" style="background:{pal[2]}"></span>
            <span class="twine h" style="background:{pal[2]}"></span>
            {#if i === lastIndex}
              <span class="wax" style="background:{map.pathBehind}">{map.finalGlyph}</span>
            {:else}
              <span class="ticket" style="background:{pal[0]};color:{pal[2]}">{i + 1}</span>
            {/if}
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
        {:else if interior}
          <!-- An ordinary stop is a stamp, perforated edge and all -->
          <button
            class="stamp"
            class:done
            class:locked
            disabled={locked}
            onclick={() => onSelect(i)}
            aria-label={aria}
          >
            <span class="num">{i + 1}</span>
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

        {#if stars > 0}
          <span class="stars" class:tiny={tier === 'waypoint'}>
            {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < stars}>★</span>{/each}
          </span>
        {/if}

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
      {#if map.vehicleGlyph}
        <span class="vehicle" style="left:{p.x - 40}px;top:{p.y - 42}px;color:{map.pathBehind}"
          >{map.vehicleGlyph}</span
        >
      {:else}
      <svg class="rocket" style="left:{p.x - 44}px;top:{p.y - 46}px" width="28" height="37" viewBox="0 0 24 32">
        <path d="M12 1 C16 6 17 12 16 20 L8 20 C7 12 8 6 12 1 Z" fill="#f2ead8" stroke="#3f3a33" stroke-width="1" />
        <path d="M12 1 C14 3.5 15 6 15.3 8 L8.7 8 C9 6 10 3.5 12 1 Z" fill="#c94f3d" />
        <circle cx="12" cy="13" r="2.8" fill="#7fa8bd" stroke="#3f3a33" stroke-width="0.8" />
        <path d="M8 20 L4 27 L8.5 24 Z" fill="#c94f3d" />
        <path d="M16 20 L20 27 L15.5 24 Z" fill="#c94f3d" />
        <path class="flame" d="M10 21 L12 30 L14 21 Z" fill="#e3a84f" />
      </svg>
      {/if}
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
    outline: 1.5px solid var(--rim);
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
    border: 1.5px solid var(--earned);
    transform: translate(-50%, -50%) rotate(-15deg);
  }

  .pulse {
    width: 62px;
    height: 62px;
    border: 1.5px solid var(--earned);
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
    border: 1.5px solid var(--rim);
    background: radial-gradient(circle at 35% 30%, var(--locked-a), var(--locked-b) 70%);
  }

  .waypoint.done {
    border-color: var(--earned);
    background: radial-gradient(circle at 35% 30%, var(--earned), var(--earned) 65%, var(--locked-a));
  }

  .waypoint.locked {
    opacity: 0.55;
  }

  .num {
    position: relative;
    font-size: 11px;
    font-weight: 600;
    color: var(--node-ink);
  }

  .big-num {
    font-size: 14px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    color: var(--node-ink);
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
    background: var(--rim);
    transform: translateX(-50%);
  }

  .panel {
    position: absolute;
    top: 11px;
    width: 20px;
    height: 13px;
    border-radius: 2px;
    background: var(--locked-b);
    border: 1px solid var(--rim);
  }

  .panel.left {
    left: 0;
  }

  .panel.right {
    right: 0;
  }

  .station.lit .panel {
    background: linear-gradient(var(--earned), var(--locked-a));
    border-color: var(--earned);
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
    background: radial-gradient(circle at 35% 28%, var(--locked-a), var(--locked-b) 70%);
    border: 1.5px solid var(--rim);
    color: var(--node-ink);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
  }

  .station.lit .core {
    background: radial-gradient(circle at 35% 28%, var(--earned), var(--earned) 58%, var(--locked-a));
    border-color: var(--earned);
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
    -webkit-text-stroke: 0.8px var(--rim);
  }

  .stars.tiny .star {
    font-size: 8px;
  }

  .star.filled {
    color: var(--earned);
    -webkit-text-stroke: 0;
  }

  /* A small engraved plaque reads better against a busy field than loose text. */
  .label {
    position: absolute;
    top: 50%;
    left: calc(50% + 40px);
    transform: translateY(-50%);
    font-family: var(--font-serif);
    font-size: 12.5px;
    color: var(--label);
    white-space: nowrap;
    pointer-events: none;
    padding: 3px 9px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.42);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--earned) 45%, transparent);
  }

  .label.left {
    left: auto;
    right: calc(50% + 40px);
  }

  .label.muted {
    color: var(--rim);
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

  .vehicle {
    position: absolute;
    z-index: 3;
    font-size: 23px;
    line-height: 1;
    pointer-events: none;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
    animation: bob 3.2s ease-in-out infinite;
  }

  @keyframes bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-3px);
    }
  }

  .clockface {
    position: absolute;
    pointer-events: none;
    opacity: 0.55;
  }

  /* The front door the letter arrives through: panel, brass slot, mat. */
  .doorway {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 104px;
  }

  .door-panel {
    position: absolute;
    left: 8%;
    right: 8%;
    top: 0;
    bottom: 22px;
    border-radius: 6px 6px 0 0;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.22);
    opacity: 0.9;
  }

  .door-plate {
    position: absolute;
    left: 50%;
    top: 26px;
    width: 108px;
    height: 30px;
    border-radius: 4px;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
  }

  .door-slot {
    width: 78px;
    height: 10px;
    border-radius: 2px;
    box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.55);
  }

  .door-mat {
    position: absolute;
    left: 4%;
    right: 4%;
    bottom: 0;
    height: 22px;
    border-radius: 3px;
    opacity: 0.85;
  }

  /* Stamp: an ordinary stop */
  .stamp {
    width: 28px;
    height: 24px;
    border-radius: 3px;
    border: 1.5px dashed var(--rim);
    background: linear-gradient(var(--locked-a), var(--locked-b));
  }

  .stamp.done {
    border: 1.5px dashed var(--earned);
    background: linear-gradient(var(--earned), var(--locked-a));
  }

  .stamp.locked {
    opacity: 0.5;
  }

  .stamp.done .num {
    color: #2b2010;
  }

  /* Parcel: a milestone */
  .parcel {
    position: relative;
    border: 1.5px solid;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .parcel.locked {
    filter: grayscale(0.5) brightness(0.62);
    box-shadow: none;
  }

  .twine {
    position: absolute;
    opacity: 0.55;
  }

  .twine.v {
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-50%);
  }

  .twine.h {
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    transform: translateY(-50%);
  }

  .ticket {
    position: relative;
    padding: 1px 7px;
    border-radius: 2px;
    font-size: 13px;
    font-weight: 600;
  }

  .wax {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 14px;
    color: #2b2010;
    box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.3);
  }

  /* Franking counter: a sorting hall */
  .counter {
    width: 78px;
    height: 34px;
  }

  .bench {
    position: absolute;
    bottom: 4px;
    width: 26px;
    height: 12px;
    border-radius: 2px;
    background: var(--locked-b);
    border: 1px solid var(--rim);
  }

  .bench.left {
    left: 0;
  }

  .bench.right {
    right: 0;
  }

  .counter.lit .bench {
    background: linear-gradient(var(--earned), var(--locked-a));
    border-color: var(--earned);
  }

  .lever {
    position: absolute;
    left: 50%;
    top: 0;
    width: 2px;
    height: 11px;
    background: var(--rim);
    transform: translateX(-50%) rotate(14deg);
    transform-origin: bottom center;
  }

  .press {
    position: relative;
    width: 30px;
    height: 22px;
    border-radius: 3px;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 600;
    background: linear-gradient(var(--locked-a), var(--locked-b));
    border: 1.5px solid var(--rim);
    color: var(--node-ink);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
  }

  .counter.lit .press {
    background: linear-gradient(var(--earned), var(--earned));
    border-color: var(--earned);
    color: #2b2010;
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
    .vehicle,
    .comet {
      animation: none;
    }
  }
</style>
