<script lang="ts">
  import type { LevelDef, MapThemeDef, PlayfieldVariantDef } from '@reign/engine';
  import { contentUrl } from './content';

  let {
    levels,
    map,
    variants = [],
    partGlyphs,
    doneSet,
    currentIndex,
    starsFor,
    onSelect,
  }: {
    levels: LevelDef[];
    map: MapThemeDef;
    /** Interior maps draw each storey in the colours of the room it plays in. */
    variants?: PlayfieldVariantDef[];
    partGlyphs: string[];
    doneSet: Set<number>;
    currentIndex: number;
    starsFor: (i: number) => number;
    onSelect: (i: number) => void;
  } = $props();

  const BOTTOM_PAD = 150;
  const TOP_PAD = 120;
  /** Indoors the route ends in the loft, which needs room above the last stop. */
  const topPad = $derived(map.style === 'interior' ? 180 : TOP_PAD);
  /** Ordinary stops sit closer together; a milestone earns room to breathe. */
  const STEP_WAYPOINT = 64;
  const STEP_MILESTONE = 104;
  /** Keeps a node and its plaque clear of the edges. */
  const SIDE_MARGIN = 56;
  /** Indoors a narrow rail down the left carries the room index. */
  const RAIL_W = 58;

  let W = $state(360);
  const AMPLITUDE = $derived(Math.max(44, Math.min(124, W * 0.33)));

  const lastIndex = $derived(levels.length - 1);
  /** A building, not a sky: different shapes throughout, not a recolour. */
  const interior = $derived(map.style === 'interior');
  /** A painted map: the artwork is the scene, only game state is drawn over it. */
  const mural = $derived(map.mural ?? null);
  const mscale = $derived(mural ? W / mural.width : 1);
  const railW = $derived(interior ? RAIL_W : 0);
  /** The cutaway itself: the building occupies everything right of the rail. */
  const wallW = $derived(Math.max(1, W - railW));

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
  const height = $derived(mural ? Math.round(mural.height * mscale) : BOTTOM_PAD + totalRise + topPad);

  /**
   * A triangle sweep sets the side, so the route always crosses the full width
   * instead of drifting to one edge as summed sines did; a small sine on top
   * keeps it from marching. Clamped so a node and its plaque stay in frame.
   */
  const points = $derived.by(() => {
    if (mural) return mural.anchors.map((a) => ({ x: a.x * mscale, y: a.y * mscale }));
    let y = height - BOTTOM_PAD;
    return levels.map((_, i) => {
      y -= steps[i];
      if (interior) {
        // Pneumatic tube: it runs in a lane and jogs across, never meanders.
        // The right lane stops short of the wall, which carries the room badges.
        const lane = Math.floor(i / 4) % 2 === 0 ? 0.3 : 0.62;
        return { x: railW + wallW * lane, y };
      }
      const t = (i / 3.5) % 2;
      const sweep = t < 1 ? t * 2 - 1 : 3 - t * 2;
      const wander = 0.86 * sweep + 0.14 * Math.sin(i * 1.7 + 0.6);
      const half = Math.max(0, W / 2 - SIDE_MARGIN);
      return { x: W / 2 + Math.max(-half, Math.min(half, AMPLITUDE * wander)), y };
    });
  });

  /** Straight runs joined by right-angle elbows — how a real tube is plumbed. */
  function tubePath(pts: Array<{ x: number; y: number }>): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (Math.abs(a.x - b.x) < 1) {
        d += ` L ${b.x} ${b.y}`;
      } else {
        const midY = (a.y + b.y) / 2;
        const dir = b.x > a.x ? 1 : -1;
        const r = 11;
        d +=
          ` L ${a.x} ${midY - r} Q ${a.x} ${midY}, ${a.x + dir * r} ${midY}` +
          ` L ${b.x - dir * r} ${midY} Q ${b.x} ${midY}, ${b.x} ${midY + r}` +
          ` L ${b.x} ${b.y}`;
      }
    }
    return d;
  }

  /** Couplings sit at every bend, where two runs are joined. */
  const elbows = $derived.by(() => {
    if (!interior) return [] as Array<{ x: number; y: number }>;
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (Math.abs(a.x - b.x) >= 1) {
        const midY = (a.y + b.y) / 2;
        out.push({ x: a.x, y: midY }, { x: b.x, y: midY });
      }
    }
    return out;
  });

  /**
   * The cutaway: one band of wall per room, stacked, each in the colours of the
   * board you will actually play on that floor. Bands tile the whole height, so
   * there is no void anywhere — which is what stopped this reading as a sky.
   * Sorting halls fold into the room around them rather than splitting it.
   */
  const bands = $derived.by(() => {
    if (!interior || !points.length) {
      return [] as Array<{
        id: string;
        name: string;
        wall: string;
        accent: string;
        wallLeft: string;
        wallRight: string;
        wallTile: string;
        glyph: string;
        start: number;
        top: number;
        height: number;
      }>;
    }
    const rooms = map.rooms ?? {};
    const perLevel: string[] = [];
    let last = '';
    for (const level of levels) {
      const v = level.variant ?? '';
      if (level.special) perLevel.push(last || v);
      else {
        last = v;
        perLevel.push(v);
      }
    }
    // A quest opening on a hall would have no room yet; borrow the first one.
    const firstNamed = perLevel.find((r) => r && rooms[r]) ?? perLevel[0] ?? '';
    for (let i = 0; i < perLevel.length && !perLevel[i]; i++) perLevel[i] = firstNamed;

    const groups: Array<{ id: string; from: number; to: number }> = [];
    for (let i = 0; i < perLevel.length; i++) {
      const g = groups[groups.length - 1];
      if (g && g.id === perLevel[i]) g.to = i;
      else groups.push({ id: perLevel[i], from: i, to: i });
    }

    const seam = (k: number) => (points[groups[k].to].y + points[groups[k + 1].from].y) / 2;
    return groups.map((g, k) => {
      const top = k === groups.length - 1 ? 0 : seam(k);
      const bottom = k === 0 ? height : seam(k - 1);
      const variant = variants.find((v) => v.id === g.id);
      return {
        id: g.id,
        name: rooms[g.id] ?? '',
        wall: variant?.background ?? `linear-gradient(${map.sky[1]}, ${map.sky[0]})`,
        // The room's own accent, washed over the wall. The variant backgrounds
        // differ in hue but sit so dark that side by side they read identical;
        // the light in the room is what tells one storey from the next.
        accent: variant?.queenColor ?? map.starColors[0],
        wallLeft: variant?.wallLeft ?? '',
        wallRight: variant?.wallRight ?? '',
        wallTile: variant?.wallTile ?? '',
        glyph: variant?.queenGlyph ?? '',
        start: g.from + 1,
        top,
        height: Math.max(0, bottom - top),
      };
    });
  });

  /** Wall furniture, placed away from the tube lanes so nothing collides. */
  const painted = $derived(interior && variants.some((v) => v.wallLeft));
  const sceneInterior = $derived(interior && !mural);

  const fittings = $derived.by(() => {
    if (!interior) return { racks: [], shelves: [], lamps: [], clocks: [], letters: [] };
    const rnd = makeRng(834112);
    const rows = Math.max(6, Math.round(height / 105));
    const racks: Array<{ x: number; y: number; cols: number; rows: number }> = [];
    const shelves: Array<{ x: number; y: number; w: number; items: number }> = [];
    const lamps: Array<{ x: number; y: number }> = [];
    const clocks: Array<{ x: number; y: number; size: number }> = [];
    const letters: Array<{ x: number; y: number; r: number; rot: number }> = [];
    for (let i = 0; i < rows; i++) {
      const y = topPad + 30 + (i * (height - topPad - 230)) / rows + rnd() * 26;
      const leftSide = rnd() < 0.5;
      const x = leftSide ? railW + 8 + rnd() * 22 : W - 76 - rnd() * 22;
      const kind = i % 4;
      if (kind === 0) racks.push({ x, y, cols: 3 + Math.floor(rnd() * 2), rows: 3 });
      else if (kind === 1) shelves.push({ x, y, w: 54 + rnd() * 16, items: 2 + Math.floor(rnd() * 2) });
      else if (kind === 2) lamps.push({ x: x + 18, y: y - 30 });
      else clocks.push({ x, y, size: 30 + rnd() * 8 });
      if (rnd() < 0.65) {
        letters.push({ x: leftSide ? W - 62 - rnd() * 36 : railW + 22 + rnd() * 36, y: y + 40, r: 4 + rnd() * 2, rot: -20 + rnd() * 40 });
      }
    }
    // Where the room is painted, only the letters stay — they move, and a
    // still image cannot.
    return painted ? { racks: [], shelves: [], lamps: [], clocks: [], letters } : { racks, shelves, lamps, clocks, letters };
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

  const pathBehind = $derived(
    (interior ? tubePath : smoothPath)(points.slice(0, Math.min(currentIndex, lastIndex) + 1)),
  );
  const pathAhead = $derived(
    (interior ? tubePath : smoothPath)(points.slice(Math.min(currentIndex, lastIndex))),
  );

  function worldSize(i: number): number {
    if (i === lastIndex) return 74;
    return [58, 66, 52, 62, 56, 68][i % 6];
  }

  function paletteFor(i: number, done: boolean, current: boolean): string[] {
    if (current) return map.currentPalette;
    if (!done) {
      // Indoors the locked palette is the building's own timber, so a parcel
      // painted in it vanishes into the wall. Undelivered post is kraft paper:
      // its own colour, drained rather than blacked out (see .parcel.locked).
      return interior ? map.bodyPalettes[i % map.bodyPalettes.length] : map.lockedPalette;
    }
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
  {#if sceneInterior}
    <div class="rail" style="width:{railW}px;height:{height}px;border-color:{map.pathAhead}">
      {#each bands as b (b.id)}
        <div class="rail-band" style="top:{b.top}px;height:{b.height}px">
          <div class="rail-plate">
            <span class="rail-name" style="color:{map.starColors[0]}">{b.name}</span>
            <span class="rail-row">
              <span class="rail-num" style="color:{map.pathBehind}">{b.start}</span>
              {#if b.glyph}<span class="rail-glyph" style="color:{map.starColors[1]}">{b.glyph}</span>{/if}
            </span>
            <span class="rail-tick" style="background:{map.pathAhead}"></span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div
    class="sky"
    style="height:{height}px;background:linear-gradient({map.sky.join(', ')});
      --node-ink:{map.starColors[0]};--rim:{map.pathAhead};--earned:{map.pathBehind};
      --locked-a:{map.lockedPalette[0]};--locked-b:{map.lockedPalette[1]};
      --label:{map.starColors[2] ?? map.starColors[0]}"
  >
    {#if !interior}
    {#each decor.clouds as c, i (i)}
      <div
        class="cloud"
        style="left:{c.x}px;top:{c.y}px;width:{c.w}px;height:{c.h}px;background:radial-gradient(closest-side, {c.color}, transparent)"
      ></div>
    {/each}

    {#if sceneInterior}
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

    {/if}

    {#if !interior}
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
    {/if}

    {#if mural}
      <!-- The map is the painting; everything below draws state over it. -->
      <div
        class="mural"
        style="height:{height}px;background-image:url({contentUrl(mural.image)})"
        aria-hidden="true"
      ></div>
      {#each mural.covers ?? [] as c (c.text)}
        <span class="mural-cover" style="left:{c.x * mscale}px;top:{c.y * mscale}px">{c.text}</span>
      {/each}
    {/if}

    {#if sceneInterior}
      <!-- The cutaway: a band of wall per storey, floor plates between them. -->
      {#each bands as b, k (b.id)}
        <div class="storey" style="left:{railW}px;top:{b.top}px;height:{b.height}px;background:{b.wall}">
          {#if b.wallTile}
            <span class="wall-tile" style="background-image:url({contentUrl(b.wallTile)})"></span>
          {/if}
          <span class="storey-ceiling" style="background:linear-gradient({map.sky[0]}, transparent)"></span>
          {#if b.wallLeft}
            <span class="wall-art left" style="background-image:url({contentUrl(b.wallLeft)})"></span>
          {/if}
          {#if b.wallRight}
            <span class="wall-art right" style="background-image:url({contentUrl(b.wallRight)})"></span>
          {/if}
          <span
            class="storey-wash"
            style="background:radial-gradient(115% 62% at 74% 86%, {b.accent}22, {b.accent}0b 55%, transparent)"
          ></span>
          {#if b.glyph}
            {@const lift = k === 0 ? 196 : 34}
            <span
              class="storey-badge"
              style="bottom:{lift}px;border-color:{map.pathBehind};color:{map.starColors[0]};background:{map.sky[0]}"
              >{b.glyph}</span
            >
            <span class="storey-name" style="bottom:{lift + 6}px;color:{map.starColors[1]}">{b.name}</span>
          {/if}
          {#if k > 0}
            <span
              class="storey-floor"
              style="background:linear-gradient({b.accent}66 0 3px, {map.lockedPalette[0]} 3px, {map.lockedPalette[2]});
                box-shadow:0 -7px 12px -4px {map.sky[0]}"
            ></span>
            <span class="storey-joist" style="background:{map.pathBehind}"></span>
          {/if}
        </div>
      {/each}

      {#each fittings.lamps as l, i (i)}
        <div class="lamp" style="left:{l.x}px;top:{l.y}px">
          <span class="lamp-cord" style="background:{map.pathAhead}"></span>
          <span class="lamp-shade" style="background:{map.pathBehind}"></span>
          <span class="lamp-glow" style="background:radial-gradient(closest-side, {map.nebulas[0]}, transparent)"></span>
        </div>
      {/each}

      {#each fittings.racks as r, i (i)}
        <div class="rack" style="left:{r.x}px;top:{r.y}px;border-color:{map.pathAhead}">
          {#each Array(r.cols * r.rows) as _, c (c)}
            <span class="hole" style="border-color:{map.pathAhead};background:{map.sky[0]}"></span>
          {/each}
        </div>
      {/each}

      {#each fittings.shelves as sh, i (i)}
        <div class="shelf" style="left:{sh.x}px;top:{sh.y}px;width:{sh.w}px">
          <span class="shelf-plank" style="background:{map.lockedPalette[0]};box-shadow:0 2px 4px {map.sky[0]}"></span>
          {#each Array(sh.items) as _, k (k)}
            <span class="shelf-parcel" style="left:{6 + k * 20}px;background:{map.bodyPalettes[(i + k) % map.bodyPalettes.length][1]}"></span>
          {/each}
        </div>
      {/each}

      {#each fittings.clocks as c, i (i)}
        <svg class="clockface" style="left:{c.x}px;top:{c.y}px" width={c.size} height={c.size} viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill={map.sky[1]} stroke={map.galaxyColor} stroke-width="1.6" />
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
          <line x1="20" y1="20" x2="20" y2="11" stroke={map.galaxyColor} stroke-width="1.4" />
          <line x1="20" y1="20" x2="26" y2="23" stroke={map.galaxyColor} stroke-width="1.2" />
        </svg>
      {/each}

      {#each fittings.letters as a, i (i)}
        <span class="drift-letter" style="left:{a.x}px;top:{a.y}px;transform:rotate({a.rot}deg);background:{map.starColors[0]}">
          <span class="flap" style="border-top-color:{map.lockedPalette[0]}"></span>
        </span>
      {/each}

      <!-- The loft: where the tube ends and the postmaster works. -->
      <div class="loft" style="left:{railW}px">
        <span class="loft-wall" style="background:linear-gradient({map.sky[0]}, transparent)"></span>
        {#if map.loftArt}
          <span class="loft-art" style="background-image:url({contentUrl(map.loftArt)})"></span>
        {:else}
          <div class="loft-holes">
            {#each Array(18) as _, i (i)}
              <span class="hole" style="border-color:{map.pathAhead};background:{map.sky[0]}"></span>
            {/each}
          </div>
          <span class="desk-leg left" style="background:{map.lockedPalette[2]}"></span>
          <span class="desk-leg right" style="background:{map.lockedPalette[2]}"></span>
          <span class="desk" style="background:linear-gradient({map.lockedPalette[0]}, {map.lockedPalette[2]})"></span>
          <span class="desk-edge" style="background:{map.pathBehind}"></span>
          <span class="ledger" style="background:{map.bodyPalettes[2][0]};border-color:{map.bodyPalettes[2][2]}"></span>
          <span class="desk-lamp" style="background:{map.pathBehind}"></span>
        {/if}
        <span
          class="desk-glow"
          style="background:radial-gradient(closest-side, {map.nebulas[0]}, transparent)"
        ></span>
      </div>

      <div class="doorway" style="left:{railW}px">
        {#if map.doorArt}
          <span class="door-art" style="background-image:url({contentUrl(map.doorArt)})"></span>
        {:else}
          <span class="door-panel" style="background:linear-gradient({map.homePalette[1]}, {map.homePalette[2]})"></span>
          <span class="door-plate" style="background:linear-gradient({map.homePalette[0]}, {map.homePalette[1]})">
            <span class="door-slot" style="background:{map.sky[0]}"></span>
          </span>
        {/if}
        <span class="door-mat" style="background:{map.lockedPalette[0]}"></span>
      </div>
    {:else if !interior}
      <div
        class="home-body"
        style="width:{W * 1.25}px;height:{W * 1.25}px;bottom:{-W * 1.02}px;background:radial-gradient(circle at 32% 18%, {map.homePalette[0]}, {map.homePalette[1]} 45%, {map.homePalette[2]} 78%, {map.homePalette[2]})"
      ></div>
      <div class="launchpad"></div>
    {/if}

    <svg class="paths" width={W} {height} aria-hidden="true">
      {#each interior ? [] : dividers as y, i (i)}
        <g opacity="0.5">
          <line x1="26" y1={y} x2={W / 2 - 12} y2={y} stroke={map.pathAhead} stroke-width="0.75" />
          <line x1={W / 2 + 12} y1={y} x2={W - 26} y2={y} stroke={map.pathAhead} stroke-width="0.75" />
          <path
            d="M {W / 2} {y - 4} L {W / 2 + 4} {y} L {W / 2} {y + 4} L {W / 2 - 4} {y} Z"
            fill={map.pathAhead}
          />
        </g>
      {/each}
      {#if mural}
        <!-- The painting draws its own tube. -->
      {:else if interior}
        <path d={pathAhead} fill="none" stroke={map.sky[0]} stroke-width="13" stroke-linejoin="round" opacity="0.85" />
        <path d={pathAhead} fill="none" stroke={map.pathAhead} stroke-width="9" stroke-linejoin="round" opacity="0.55" />
        <path d={pathAhead} fill="none" stroke={map.starColors[0]} stroke-width="2" stroke-linejoin="round" opacity="0.16" />
        <path d={pathBehind} fill="none" stroke={map.sky[0]} stroke-width="13" stroke-linejoin="round" />
        <path d={pathBehind} fill="none" stroke={map.pathBehind} stroke-width="9" stroke-linejoin="round" opacity="0.9" />
        <path d={pathBehind} fill="none" stroke={map.starColors[2] ?? map.starColors[0]} stroke-width="2.4" stroke-linejoin="round" opacity="0.42" />
        <!-- The last run: the tube carries on past the top stop into the loft. -->
        {#if points.length}
          <line
            x1={points[lastIndex].x}
            y1={points[lastIndex].y}
            x2={points[lastIndex].x}
            y2={topPad - 22}
            stroke={map.sky[0]}
            stroke-width="13"
          />
          <line
            x1={points[lastIndex].x}
            y1={points[lastIndex].y}
            x2={points[lastIndex].x}
            y2={topPad - 22}
            stroke={map.pathAhead}
            stroke-width="9"
            opacity="0.55"
          />
        {/if}
        {#each elbows as e, i (i)}
          <rect
            x={e.x - 8}
            y={e.y - 5}
            width="16"
            height="10"
            rx="2"
            fill={map.lockedPalette[0]}
            stroke={map.pathAhead}
            stroke-width="1"
          />
        {/each}
      {:else}
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
      {/if}
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

      <div class="node-abs" class:big={tier !== 'waypoint'} class:on-art={!!mural} style="left:{p.x}px;top:{p.y}px">
        {#if current}<span class="pulse"></span>{/if}

        {#if mural}
          {@const kind = mural.anchors[i]?.kind ?? 'disc'}
          {@const d = Math.round(45 * mscale)}
          {#if kind === 'seal'}
            <!-- The painted wax is the stop; only its state is drawn. -->
            <button class="seal-hit" class:locked style="width:{d + 10}px;height:{d + 10}px" disabled={locked} onclick={() => onSelect(i)} aria-label={aria}>
              {#if locked}<span class="seal-dim"></span>{/if}
              {#if done}<span class="seal-ring" style="border-color:{map.pathBehind}"></span>{/if}
            </button>
          {:else if kind === 'hall'}
            <button class="press-tile" class:lit={done} class:locked style="width:{d + 2}px;height:{d + 2}px" disabled={locked} onclick={() => onSelect(i)} aria-label={aria}>
              <span class="tile-lever"><span class="tile-knob"></span></span>
              {done ? partGlyphs[level.partIndex ?? 0] : i + 1}
            </button>
          {:else if kind === 'parcel'}
            <button
              class="parcel mural-parcel"
              class:locked
              style="width:{d}px;height:{Math.round(d * 0.78)}px;background:linear-gradient({pal[0]}, {pal[1]});border-color:{pal[2]}"
              disabled={locked}
              onclick={() => onSelect(i)}
              aria-label={aria}
            >
              <span class="twine v" style="background:{pal[2]}"></span>
              <span class="twine h" style="background:{pal[2]}"></span>
              <span class="ticket" style="background:{pal[0]};color:{pal[2]}">{i + 1}</span>
            </button>
          {:else}
            <button class="stamp mural-disc" class:done class:locked class:starred={stars >= 3} style="width:{d}px;height:{d}px" disabled={locked} onclick={() => onSelect(i)} aria-label={aria}>
              <span class="num">{i + 1}</span>
            </button>
          {/if}
        {:else if tier === 'station' && interior}
          <!-- A franking counter: two benches and the press between them -->
          <button class="counter" class:lit={done} disabled={locked} onclick={() => onSelect(i)} aria-label={aria}>
            <span class="bench left"></span>
            <span class="bench right"></span>
            <span class="lever"><span class="knob"></span></span>
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
            class:starred={stars >= 3}
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

        {#if interior && !(mural && locked)}
          <span class="rail-stars" class:tiny={tier === 'waypoint'} class:dim={locked}
            style="background:{map.sky[0]};border-color:{map.lockedPalette[0]}">
            {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < stars}>★</span>{/each}
          </span>
        {:else if stars > 0}
          <span class="stars" class:tiny={tier === 'waypoint'}>
            {#each [0, 1, 2] as s (s)}<span class="star" class:filled={s < stars}>★</span>{/each}
          </span>
        {/if}

        {#if mural ? current : tier !== 'waypoint'}
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
    position: relative;
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

  /*
   * On a painting the button must sit exactly over the painted stop, so the
   * rail and label hang from it absolutely instead of stretching the column.
   */
  .node-abs.on-art {
    gap: 0;
  }

  .node-abs.on-art .rail-stars {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 3px;
  }

  .node-abs.on-art .label {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 24px;
    white-space: nowrap;
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

  .rail-stars {
    display: flex;
    gap: 2px;
    margin-top: 5px;
    padding: 1.5px 4px;
    border: 1px solid;
    border-radius: 3px;
    font-size: 8px;
    line-height: 1;
    opacity: 0.95;
  }

  .rail-stars.tiny {
    font-size: 6.5px;
    padding: 1px 3px;
    gap: 1.5px;
  }

  .rail-stars.dim {
    opacity: 0.55;
  }

  .rail-stars .star {
    color: rgba(255, 255, 255, 0.16);
  }

  .rail-stars .star.filled {
    color: #f0c04a;
    text-shadow: 0 0 4px rgba(240, 192, 74, 0.55);
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
    opacity: 0.5;
  }

  /* Wall fittings — the building the tube runs through. */
  .lamp {
    position: absolute;
    pointer-events: none;
  }

  .lamp-cord {
    position: absolute;
    left: 50%;
    top: -26px;
    width: 1px;
    height: 26px;
    opacity: 0.5;
  }

  .lamp-shade {
    position: absolute;
    left: 50%;
    top: 0;
    width: 22px;
    height: 9px;
    transform: translateX(-50%);
    border-radius: 11px 11px 2px 2px;
    opacity: 0.75;
  }

  .lamp-glow {
    position: absolute;
    left: 50%;
    top: 4px;
    width: 132px;
    height: 108px;
    transform: translateX(-50%);
    border-radius: 50%;
  }

  .rack {
    position: absolute;
    display: grid;
    grid-template-columns: repeat(auto-fill, 15px);
    width: 62px;
    gap: 2px;
    padding: 3px;
    border: 1px solid;
    border-radius: 2px;
    opacity: 0.72;
    pointer-events: none;
  }

  .hole {
    width: 15px;
    height: 11px;
    border: 1px solid;
    border-radius: 1px;
  }

  .shelf {
    position: absolute;
    height: 18px;
    opacity: 0.8;
    pointer-events: none;
  }

  .shelf-plank {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    border-radius: 1px;
  }

  .shelf-parcel {
    position: absolute;
    bottom: 3px;
    width: 14px;
    height: 11px;
    border-radius: 1px;
    opacity: 0.85;
  }

  .drift-letter {
    position: absolute;
    width: 13px;
    height: 9px;
    border-radius: 1px;
    opacity: 0.34;
    pointer-events: none;
  }

  .flap {
    position: absolute;
    inset: 0;
    border-top: 4px solid;
    opacity: 0.5;
  }

  /* The painting itself, scaled to the viewport; state renders over it. */
  .mural {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }

  /* Patches over painted room-start numbers the art got wrong. */
  .mural-cover {
    position: absolute;
    transform: translate(-50%, -50%);
    padding: 1px 6px;
    border-radius: 3px;
    background: #171310;
    font-family: var(--font-serif);
    font-size: 14px;
    color: #d8cfae;
    pointer-events: none;
  }

  /* Stops sized to sit exactly over the painted discs. */
  .mural-disc .num {
    font-size: 13px;
  }

  .mural-disc.locked {
    border-color: #7d7264;
    background: radial-gradient(circle at 36% 30%, #b3a893, #918673 62%, #746b5a);
    box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.3), 0 2px 5px rgba(0, 0, 0, 0.4);
    opacity: 1;
  }

  .mural-disc.locked .num {
    color: #3d372c;
  }

  .mural-parcel {
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  }

  /* A sorting hall: the painted junction tile, pressed into service. */
  .press-tile {
    position: relative;
    display: grid;
    place-items: center;
    border-radius: 5px;
    border: 2px solid var(--rim);
    font-family: var(--font-serif);
    font-size: 14px;
    font-weight: 700;
    color: #33260f;
    background:
      linear-gradient(150deg, #efe3c4, #d3bf94 55%, #b59d6e);
    box-shadow:
      inset 0 1px 0 rgba(255, 250, 235, 0.5),
      0 3px 9px rgba(0, 0, 0, 0.5);
  }

  .press-tile.lit {
    border-color: var(--earned);
    box-shadow:
      inset 0 1px 0 rgba(255, 250, 235, 0.5),
      0 0 11px -1px var(--earned),
      0 3px 9px rgba(0, 0, 0, 0.5);
  }

  .press-tile.locked {
    border-color: #7d7264;
    background: linear-gradient(150deg, #b3a893, #948a76 55%, #7a715f);
    color: #3d372c;
  }

  .press-tile.locked .tile-lever,
  .press-tile.locked .tile-knob {
    background: #7d7264;
  }

  .tile-lever {
    position: absolute;
    left: 50%;
    top: -12px;
    width: 2.5px;
    height: 14px;
    border-radius: 2px;
    background: var(--rim);
    transform: translateX(-50%) rotate(10deg);
    transform-origin: bottom center;
  }

  .tile-knob {
    position: absolute;
    left: 50%;
    top: -4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    transform: translateX(-50%);
    background: radial-gradient(circle at 34% 30%, #fff2d4, var(--rim));
  }

  .press-tile.lit .tile-lever {
    background: var(--earned);
  }

  /* The wax seal: the painting's own face, dimmed or ringed by state. */
  .seal-hit {
    position: relative;
    border-radius: 50%;
    background: transparent;
    border: none;
  }

  .seal-dim {
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    background: rgba(10, 7, 4, 0.52);
  }

  .seal-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid;
    box-shadow: 0 0 12px -2px currentColor;
  }

  /* A storey: a full band of wall, its floor plate, and its room badge. */
  .storey {
    position: absolute;
    right: 0;
    pointer-events: none;
  }

  /*
   * Bare wall from the reference art, papered edge to edge under everything.
   * The tile is a 2x2 mirror of a clean patch, so CSS repeat is seamless. It
   * carries the middle of the storey — the side strips carry the furniture.
   */
  .wall-tile {
    position: absolute;
    inset: 0;
    background-repeat: repeat;
    background-size: 46px 46px;
    opacity: 0.85;
  }

  .storey-ceiling {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 26px;
    opacity: 0.65;
  }

  .storey-wash {
    position: absolute;
    inset: 0;
  }

  /*
   * The room's own walls, anchored to the floor and hugging each side so the
   * tube keeps a clear channel down the middle. Feathered at the top, where
   * the crop ends and the flat wall above has to take over.
   */
  .wall-art {
    position: absolute;
    top: 0;
    bottom: 0;
    /*
     * Repeated up the storey rather than sat at the bottom: a band runs several
     * hundred pixels and a single crop would leave most of it bare wall. The
     * strips are dominated by vertical pipework, which reads as a riser when it
     * repeats. Anchored at the bottom so the furniture always meets the floor.
     */
    background-repeat: repeat-y;
    background-position: bottom center;
    background-size: 100% auto;
    opacity: 0.95;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(transparent, #000 12%);
    mask-image: linear-gradient(transparent, #000 12%);
  }

  .wall-art.left {
    left: 0;
    width: 76px;
  }

  .wall-art.right {
    right: 0;
    width: 56px;
  }

  /* The floor plate reads as the underside of the storey above. */
  .storey-floor {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 16px;
  }

  .storey-joist {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 16px;
    height: 2px;
    opacity: 0.85;
  }

  .storey-badge {
    position: absolute;
    right: 12px;
    bottom: 34px;
    width: 27px;
    height: 31px;
    display: grid;
    place-items: center;
    font-size: 14px;
    border: 1.5px solid;
    border-radius: 3px 3px 13px 13px;
    opacity: 0.85;
  }

  /* Announces the room as you come up through its floor. */
  .storey-name {
    position: absolute;
    right: 74px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    bottom: 40px;
    font-family: var(--font-serif);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0.6;
  }

  /* The index rail: which room you are in, and where it started. */
  .rail {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 1;
    border-right: 1px solid;
    border-color: inherit;
    opacity: 0.9;
    pointer-events: none;
  }

  .rail-band {
    position: absolute;
    left: 0;
    right: 0;
  }

  /* Sticky, so the room you are standing in names itself the whole way up. */
  .rail-plate {
    position: sticky;
    top: 12px;
    padding: 0 8px 0 10px;
  }

  .rail-name {
    display: block;
    font-family: var(--font-serif);
    font-size: 9.5px;
    line-height: 1.25;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    opacity: 0.92;
  }

  .rail-row {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-top: 3px;
  }

  .rail-num {
    font-family: var(--font-serif);
    font-size: 15px;
    opacity: 0.95;
  }

  .rail-glyph {
    font-size: 11px;
    opacity: 0.75;
  }

  .rail-tick {
    display: block;
    width: 14px;
    height: 1px;
    margin-top: 5px;
    opacity: 0.6;
  }

  /* Loft terminus — the counterpart to the letter slot at the foot. */
  .loft {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 150px;
    pointer-events: none;
  }

  .loft-wall {
    position: absolute;
    inset: 0;
    opacity: 0.85;
  }

  .loft-holes {
    position: absolute;
    left: 50%;
    top: 14px;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: repeat(6, 15px);
    gap: 2px;
    opacity: 0.5;
  }

  .desk {
    position: absolute;
    left: 18%;
    right: 18%;
    bottom: 22px;
    height: 12px;
    border-radius: 2px;
  }

  .desk-edge {
    position: absolute;
    left: 18%;
    right: 18%;
    bottom: 34px;
    height: 2px;
    opacity: 0.55;
  }

  .desk-leg {
    position: absolute;
    bottom: 0;
    width: 4px;
    height: 24px;
    opacity: 0.9;
  }

  .desk-leg.left {
    left: 22%;
  }

  .desk-leg.right {
    right: 22%;
  }

  .ledger {
    position: absolute;
    left: 26%;
    bottom: 36px;
    width: 34px;
    height: 8px;
    border: 1px solid;
    border-radius: 1px;
    transform: rotate(-3deg);
    opacity: 0.8;
  }

  .desk-lamp {
    position: absolute;
    right: 26%;
    bottom: 36px;
    width: 20px;
    height: 8px;
    border-radius: 10px 10px 2px 2px;
    opacity: 0.85;
  }

  .desk-glow {
    position: absolute;
    right: 18%;
    bottom: 8px;
    width: 116px;
    height: 84px;
    border-radius: 50%;
  }

  .loft-art {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 92px;
    background-size: cover;
    background-position: top center;
    -webkit-mask-image: linear-gradient(#000 62%, transparent);
    mask-image: linear-gradient(#000 62%, transparent);
  }

  .door-art {
    position: absolute;
    /* Offset so the first stop lands beside the door rather than on its arch. */
    left: 58%;
    bottom: 26px;
    width: 168px;
    height: 190px;
    transform: translateX(-50%);
    background-size: cover;
    background-position: bottom center;
    -webkit-mask-image: linear-gradient(transparent, #000 16%);
    mask-image: linear-gradient(transparent, #000 16%);
  }

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
  /*
   * An ordinary stop is a numbered disc set into the tube: ivory face, brass
   * rim, dark serif numeral. Four states, each a step up in light — locked
   * charcoal, current lit, done brass-rimmed, three stars fully polished.
   */
  .stamp {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid var(--rim);
    background: radial-gradient(circle at 36% 30%, #f3e7ce, #d9c8a4 62%, #b9a47c);
    box-shadow:
      inset 0 -2px 3px rgba(60, 42, 18, 0.3),
      0 2px 5px rgba(0, 0, 0, 0.45);
  }

  .stamp .num {
    color: #33260f;
    font-family: var(--font-serif);
    font-weight: 700;
  }

  .stamp.done {
    border-color: var(--earned);
    box-shadow:
      inset 0 -2px 3px rgba(60, 42, 18, 0.28),
      0 0 9px -1px var(--earned),
      0 2px 5px rgba(0, 0, 0, 0.45);
  }

  .stamp.starred {
    background: radial-gradient(circle at 36% 30%, #fff6e2, #eddcb4 60%, #cbb384);
  }

  /* Locked is charcoal, not a faded copy: the brass has not been lit yet. */
  .stamp.locked {
    border-color: var(--locked-a);
    background: radial-gradient(circle at 36% 30%, #6c6459, #4c463d 62%, #37322b);
    box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.4);
  }

  .stamp.locked .num {
    color: #b3aa9c;
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
    filter: saturate(0.3) brightness(0.66);
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
    top: -9px;
    width: 2.5px;
    height: 20px;
    border-radius: 2px;
    background: var(--rim);
    transform: translateX(-50%) rotate(12deg);
    transform-origin: bottom center;
  }

  .knob {
    position: absolute;
    left: 50%;
    top: -4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translateX(-50%);
    background: radial-gradient(circle at 34% 30%, #fff2d4, var(--rim));
  }

  .counter.lit .lever,
  .counter.lit .knob {
    background: var(--earned);
  }

  .counter.lit .knob {
    background: radial-gradient(circle at 34% 30%, #fff6e0, var(--earned));
  }

  .press {
    position: relative;
    width: 34px;
    height: 24px;
    border-radius: 3px;
    display: grid;
    place-items: center;
    font-family: var(--font-serif);
    font-size: 13px;
    font-weight: 700;
    background: linear-gradient(160deg, #6b6157, #4a433a 55%, #363029);
    border: 1.5px solid var(--rim);
    color: var(--node-ink);
    box-shadow:
      inset 0 1px 0 rgba(255, 246, 224, 0.18),
      0 3px 8px rgba(0, 0, 0, 0.45);
  }

  .counter.lit .press {
    background: linear-gradient(160deg, #f4dda6, #c9a24a 58%, #9a7833);
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
