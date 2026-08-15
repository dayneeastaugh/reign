import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generatePuzzle,
  CONTENT_SCHEMA_VERSION,
  validateTournament,
  type Difficulty,
  type LevelDef,
  type PlayfieldVariantDef,
  type TournamentDef,
} from '../packages/engine/src/index';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'tournaments', 'grand-orbit.json');

const SPECIALS = [7, 15, 23, 31, 39];
const LEVEL_COUNT = 50;
const FINAL = LEVEL_COUNT - 1;

/** 11 spread hues so every board size up to 11 gets distinct region colours. */
const HUES = [215, 315, 160, 45, 265, 195, 20, 95, 350, 235, 285];

function makePalette(shift: number, sat: number, light: number): string[] {
  return HUES.map((h, i) => `hsl(${(h + shift + 360) % 360} ${sat}% ${light + (i % 2 ? 5 : -2)}%)`);
}

const gold = '#e3c27c';
const chrome = { chromeColor: '#f2ead8', chromeSoft: '#8a93b8' };

const VARIANTS: PlayfieldVariantDef[] = [
  {
    id: 'dusk',
    background: 'linear-gradient(#141b30, #1c2444)',
    boardLine: '#0b0e15',
    regionPalette: makePalette(0, 24, 40),
    queenGlyph: '✦',
    queenColor: gold,
    xColor: '#a8b0c8',
    ...chrome,
  },
  {
    id: 'rust',
    background: 'linear-gradient(#221128, #2c1a22)',
    boardLine: '#170d12',
    regionPalette: makePalette(-12, 30, 40),
    queenGlyph: '✦',
    queenColor: '#f0c987',
    xColor: '#c0a8a8',
    ...chrome,
  },
  {
    id: 'ice',
    background: 'linear-gradient(#0e1c28, #14283a)',
    boardLine: '#0a1420',
    regionPalette: makePalette(15, 22, 46),
    queenGlyph: '❅',
    queenColor: '#dff0f8',
    xColor: '#9db8c8',
    ...chrome,
  },
  {
    id: 'violet',
    background: 'linear-gradient(#191228, #241a34)',
    boardLine: '#120a1c',
    regionPalette: makePalette(40, 22, 42),
    queenGlyph: '✦',
    queenColor: gold,
    xColor: '#b0a8c8',
    ...chrome,
  },
  {
    id: 'ember',
    background: 'linear-gradient(#241016, #2c1414)',
    boardLine: '#180b0e',
    regionPalette: makePalette(-20, 28, 38),
    queenGlyph: '✦',
    queenColor: gold,
    xColor: '#c8a8a0',
    ...chrome,
  },
  {
    id: 'station',
    background: '#131c2c',
    boardLine: '#0a0e18',
    regionPalette: makePalette(5, 14, 41),
    queenGlyph: '⚙',
    queenColor: gold,
    xColor: '#9aa3bd',
    ...chrome,
  },
];

const BAND_NAMES: string[][] = [
  ['Duskfall', 'Lantern Deep', 'Vesper', 'Halcyon Drift', 'Umbra', 'Quiet Orbit', 'Eventide', '', 'Nocturne', 'Palisade'],
  ['Rustfall', 'Copperfield', 'Cinder Flats', 'Ferrous Reach', 'Oxide Plain', '', 'Talus', 'Red Harbor', 'Corrode', 'Kiln'],
  ['Glacier Moon', 'Rime', 'Whiteout', '', 'Floe', 'Aurora Shelf', 'Hoarfrost', 'Brine', 'Pale Sound', 'Sastrugi'],
  ['Violet Deep', 'Amethyst Rise', 'Thistle', '', 'Heliotrope', 'Mauve Hollow', 'Iris Field', 'Wisteria', 'Lilac Void', ''],
  ['Emberfall', 'Ashline', 'Furnace Reach', 'Signal Fire', 'Scoria', 'Last Light', 'The Approach', 'Gilt Horizon', 'Antechamber', 'The Golden Orbit'],
];

function nameFor(idx: number): string {
  const station = SPECIALS.indexOf(idx);
  if (station >= 0) {
    const roman = ['I', 'II', 'III', 'IV', 'V'][station];
    return `Station ${roman} · Dock ${idx + 1}`;
  }
  return BAND_NAMES[Math.floor(idx / 10)][idx % 10];
}

function difficultyFor(idx: number): Difficulty {
  if (SPECIALS.includes(idx) || idx === FINAL) return 'hard';
  if (SPECIALS.includes(idx + 1) || idx === FINAL - 1) return 'medium';
  if (idx < 7) return 'easy';
  return idx % 3 === 1 ? 'easy' : 'medium';
}

const levels: LevelDef[] = [];
for (let idx = 0; idx < LEVEL_COUNT; idx++) {
  const difficulty = difficultyFor(idx);
  const seed = 7100 + idx * 13;
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
    variant: special ? 'station' : VARIANTS[Math.floor(idx / 10)].id,
    seed,
  });
  process.stdout.write(`\rlevel ${idx + 1}/${LEVEL_COUNT} (${difficulty}, ${g.puzzle.size}x${g.puzzle.size})   `);
}
console.log();

const tournament: TournamentDef = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'grand-orbit',
  name: 'The Grand Orbit',
  version: 1,
  goal: 'Build the orrery',
  setup: {
    levelCount: LEVEL_COUNT,
    specialLevels: SPECIALS,
    partCount: SPECIALS.length,
    stars: { metric: 'moves', three: 1, two: 6 },
  },
  collectible: {
    name: 'The Orrery',
    partGlyphs: ['⚙', '◉', '◠', '✶', '✧'],
    art: 'assets/grand-orbit/orrery.jpg',
  },
  theme: { id: 'orbit', name: 'Space', defaultVariant: 'dusk', variants: VARIANTS },
  levels,
};

const problems = validateTournament(tournament);
if (problems.length) {
  console.error('VALIDATION FAILED:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(tournament));
console.log(`Wrote ${OUT} (${(JSON.stringify(tournament).length / 1024).toFixed(0)} KB) — validation clean.`);
