import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generatePuzzle,
  CONTENT_SCHEMA_VERSION,
  validateTournament,
  checkPalette,
  type Difficulty,
  type LevelDef,
  type PlayfieldVariantDef,
  type TournamentDef,
} from '../packages/engine/src/index';
import { buildPalette } from './palette-builder';

/**
 * The Clockwork Post — a letter carried up through a sorting house by pneumatic
 * tube. Shorter and gentler than The Grand Orbit on purpose: somewhere to go on
 * a tired evening, where the stations are still the only hard boards.
 */
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'tournaments', 'clockwork-post.json');

const LEVEL_COUNT = 30;
const SPECIALS = [5, 12, 19, 26];
const FINAL = LEVEL_COUNT - 1;

const HUES = [30, 45, 15, 200, 95, 350, 260, 170, 60, 320, 130, 220, 80];

/**
 * The seed picks which palette the search settles on. Intake needs a different
 * one: at its first choice two regions sat a shade under the required
 * separation on nine-region boards, and the content validator refused it.
 */
function makePalette(
  shift: number,
  satFrom: number,
  satTo: number,
  lightFrom: number,
  lightTo: number,
  seed = 0,
): string[] {
  return buildPalette(
    11,
    {
      hues: HUES.map((h) => (h + shift + 360) % 360),
      satRange: [satFrom, satTo],
      lightRange: [lightFrom, lightTo],
    },
    seed,
  );
}

const chrome = { chromeColor: '#f4ead6', chromeSoft: '#a8977d' };

/** Painted rooms, cropped from the concept art and shipped over the content channel. */
const art = (id: string) => `assets/clockwork-post/rooms/${id}.jpg`;
/** Storey walls for the map, cropped either side of the painted route. */
const walls = (id: string) => ({
  wallLeft: `assets/clockwork-post/walls/${id}-left.jpg`,
  wallRight: `assets/clockwork-post/walls/${id}-right.jpg`,
  wallTile: `assets/clockwork-post/walls/${id}-wall.jpg`,
});

const VARIANTS: PlayfieldVariantDef[] = [
  {
    id: 'intake',
    roomArt: art('intake'),
    ...walls('intake'),
    background: 'linear-gradient(#2c2118, #3a2c1e)',
    boardLine: '#1a1209',
    regionPalette: makePalette(0, 18, 40, 46, 78, 3),
    queenGlyph: '✉',
    queenColor: '#f6e4bb',
    xColor: '#fff6e8',
    ...chrome,
  },
  {
    id: 'sorting',
    roomArt: art('sorting'),
    ...walls('sorting'),
    background: 'linear-gradient(#241d16, #322820)',
    boardLine: '#150f08',
    regionPalette: makePalette(-14, 16, 38, 46, 78),
    queenGlyph: '◈',
    queenColor: '#e8d5a8',
    xColor: '#fdf5ea',
    ...chrome,
  },
  {
    id: 'franking',
    roomArt: art('franking'),
    ...walls('franking'),
    background: 'linear-gradient(#2a1614, #38201c)',
    boardLine: '#180c0a',
    regionPalette: makePalette(-26, 20, 42, 46, 78),
    queenGlyph: '✱',
    queenColor: '#f2c9b0',
    xColor: '#fff2ea',
    ...chrome,
  },
  {
    id: 'restante',
    roomArt: art('restante'),
    ...walls('restante'),
    background: 'linear-gradient(#1e2018, #2a2c22)',
    boardLine: '#101208',
    regionPalette: makePalette(18, 16, 36, 46, 78),
    queenGlyph: '✒',
    queenColor: '#e2e0c4',
    xColor: '#fbfaf0',
    ...chrome,
  },
  {
    id: 'hall',
    roomArt: art('hall'),
    background: '#20180f',
    boardLine: '#110b05',
    regionPalette: makePalette(6, 12, 34, 46, 78),
    queenGlyph: '✜',
    queenColor: '#f0d9a0',
    xColor: '#fff8ec',
    ...chrome,
  },
];

const BAND_NAMES: string[][] = [
  ['The Slot', 'Doormat', 'Wicker Basket', 'First Sort', 'Franking Bench', '', 'Ink Well', 'Pigeonhole', 'Twine Drawer', 'Blotter'],
  ['Ledger Row', 'Sealing Wax', 'Nightshift', '', 'Counter Six', 'Registered Post', 'Airmail', 'Parcel Chute', 'Bell Pull', 'The Weighbridge'],
  ['Poste Restante', 'The Loft', 'Undeliverable', '', 'Cobweb Row', 'Return to Sender', 'Last Collection', 'The Postmaster', 'Final Round', 'The Golden Scale'],
];

function nameFor(idx: number): string {
  const hall = SPECIALS.indexOf(idx);
  if (hall >= 0) {
    const roman = ['I', 'II', 'III', 'IV'][hall];
    return `Sorting Hall ${roman} · Bench ${idx + 1}`;
  }
  return BAND_NAMES[Math.floor(idx / 10)][idx % 10];
}

/** Gentler than the space quest: easy is the default, hard only at the halls. */
function difficultyFor(idx: number): Difficulty {
  if (SPECIALS.includes(idx) || idx === FINAL) return 'hard';
  if (SPECIALS.includes(idx + 1) || idx === FINAL - 1) return 'medium';
  if (idx < 4) return 'easy';
  return idx % 2 === 0 ? 'easy' : 'medium';
}

function variantFor(idx: number): string {
  if (SPECIALS.includes(idx)) return 'hall';
  if (idx < 8) return 'intake';
  if (idx < 16) return 'sorting';
  if (idx < 23) return 'franking';
  return 'restante';
}

const levels: LevelDef[] = [];
for (let idx = 0; idx < LEVEL_COUNT; idx++) {
  const difficulty = difficultyFor(idx);
  const seed = 4400 + idx * 17;
  const g = generatePuzzle({ difficulty, seed });
  const special = SPECIALS.includes(idx);
  levels.push({
    index: idx,
    name: nameFor(idx),
    size: g.puzzle.size,
    regions: g.puzzle.regions,
    solution: g.solution,
    difficulty,
    ...(special ? { special: true, partIndex: SPECIALS.indexOf(idx) } : {}),
    variant: variantFor(idx),
    seed,
  });
  process.stdout.write(`\rlevel ${idx + 1}/${LEVEL_COUNT} (${difficulty}, ${g.puzzle.size}x${g.puzzle.size})   `);
}
console.log();

const quest: TournamentDef = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'clockwork-post',
  name: 'The Clockwork Post',
  version: 9,
  goal: 'Rebuild the letter scale',
  setup: {
    levelCount: LEVEL_COUNT,
    specialLevels: SPECIALS,
    partCount: SPECIALS.length,
    stars: { metric: 'moves', three: 1, two: 6 },
  },
  collectible: {
    name: 'The Letter Scale',
    partGlyphs: ['▽', '⚖', '◍', '▤'],
    partPaths: [
      // Pan slung on chains
      'M12 3v3M12 6 7 10M12 6l5 4M5 11h14a7 7 0 0 1-14 0Z',
      // Balance beam with hooked ends
      'M3 14h2m14-4h2M5 14 19 10M11 11.4l1.6-.5.5 1.6-1.6.5zM12 12v3',
      // Poise weight
      'M10.5 6h3v2h-3zM9 8h6l1 10H8z',
      // Footed base
      'M8 8h8v3H8zM5 11h14v3H5zM4 14h16v3H4zM6 17h12v2H6z',
    ],
    art: 'assets/clockwork-post/letter-scale.jpg',
  },
  theme: {
    id: 'post',
    name: 'Sorting house',
    defaultVariant: 'intake',
    variants: VARIANTS,
    map: {
      // Climbing from the letter slot in the lamplight up into the dim loft.
      sky: ['#191309', '#221a10', '#2e2416', '#3d2e1c', '#513c26'],
      nebulas: ['rgba(232,190,116,0.16)', 'rgba(196,150,96,0.13)', 'rgba(150,120,80,0.12)'],
      starColors: ['#e8dcc0', '#cfc0a0', '#f2e8d0'],
      pathBehind: '#c9a24a',
      pathAhead: '#8d7a5e',
      bodyPalettes: [
        ['#f6ead0', '#d9c49a', '#8a7350'],
        ['#f0cbb0', '#cf9d7c', '#8a5a3e'],
        ['#dfd3ae', '#b5a67c', '#6f6242'],
        ['#e8c0b8', '#c48c82', '#7d4c46'],
        ['#c9d3c0', '#9aa88e', '#5d6a54'],
        ['#e6d6b4', '#c0aa80', '#7a6a48'],
      ],
      lockedPalette: ['#3a2f22', '#2a2118', '#1d160f'],
      currentPalette: ['#fdf4e2', '#e8d3ab', '#b09059'],
      homePalette: ['#f6e2b8', '#cfa563', '#8a6532'],
      finalGlyph: '✉',
      galaxyColor: 'rgba(236, 210, 158, 0.42)',
      constellationColor: 'rgba(226, 204, 160, 0.32)',
      asteroidColor: '#6b5a44',
      // A canister whisking through a pneumatic tube.
      cometColor: 'rgba(255, 234, 190, 0.7)',
      vehicleGlyph: '✉',
      style: 'interior',
      doorArt: 'assets/clockwork-post/walls/front-door.jpg',
      loftArt: 'assets/clockwork-post/walls/loft.jpg',
      rooms: {
        intake: 'Intake',
        sorting: 'Sorting floor',
        franking: 'Franking room',
        restante: 'Poste restante',
        hall: 'Sorting hall',
      },
    },
  },
  levels,
};

const problems = validateTournament(quest);
const sizesByVariant = new Map<string, number[]>();
for (const level of quest.levels) {
  const id = level.variant ?? quest.theme.defaultVariant;
  sizesByVariant.set(id, [...(sizesByVariant.get(id) ?? []), level.size]);
}
for (const variant of quest.theme.variants) {
  const sizes = sizesByVariant.get(variant.id);
  if (sizes) problems.push(...checkPalette(variant, sizes));
}

if (problems.length) {
  console.error('VALIDATION FAILED:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(quest));
console.log(`Wrote ${OUT} (${(JSON.stringify(quest).length / 1024).toFixed(0)} KB) — validation clean.`);
