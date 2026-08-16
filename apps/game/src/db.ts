import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Difficulty, GeneratedPuzzle } from '@reign/engine';

export interface Settings {
  autoX: boolean;
  showConflicts: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { autoX: false, showConflicts: true, sound: false };

export interface SavedGame {
  game: GeneratedPuzzle;
  marks: number[];
  /** Provenance of auto-placed × marks, so auto-mark stays reversible on resume. */
  autoCells?: boolean[];
  elapsed: number;
  savedAt: number;
  mode?: 'quick' | 'tournament';
  tournamentId?: string;
  levelIndex?: number;
  queenActions?: number;
}

export interface GameResult {
  puzzleId: string;
  difficulty: Difficulty;
  seconds: number;
  hintsUsed: number;
  finishedAt: number;
}

interface ReignDB extends DBSchema {
  kv: { key: string; value: unknown };
  results: {
    key: number;
    value: GameResult;
    indexes: { 'by-finishedAt': number };
  };
}

/**
 * Schema is versioned from day one: every future change bumps DB_VERSION and
 * adds a migration branch in upgrade(). History must survive app updates.
 */
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ReignDB>> | null = null;

function db(): Promise<IDBPDatabase<ReignDB>> {
  dbPromise ??= openDB<ReignDB>('reign', DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('kv');
        const results = d.createObjectStore('results', { autoIncrement: true });
        results.createIndex('by-finishedAt', 'finishedAt');
      }
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get('kv', key) as Promise<T | undefined>;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key);
}

export async function kvDel(key: string): Promise<void> {
  await (await db()).delete('kv', key);
}

export async function addResult(result: GameResult): Promise<void> {
  await (await db()).add('results', result);
}

export async function allResults(): Promise<GameResult[]> {
  return (await db()).getAll('results');
}

interface Backup {
  app: 'reign';
  schema: number;
  exportedAt: number;
  settings?: Settings;
  current?: SavedGame;
  tournaments?: Record<string, unknown>;
  results?: GameResult[];
}

export async function exportBackup(): Promise<string> {
  const [settings, current, orbitProgress, results] = await Promise.all([
    kvGet<Settings>('settings'),
    kvGet<SavedGame>('current'),
    kvGet('tournament:grand-orbit'),
    allResults(),
  ]);
  const backup: Backup = {
    app: 'reign',
    schema: DB_VERSION,
    exportedAt: Date.now(),
    settings,
    current,
    tournaments: { 'grand-orbit': orbitProgress },
    results,
  };
  return JSON.stringify(backup);
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json) as Backup;
  if (data.app !== 'reign' || typeof data.schema !== 'number') {
    throw new Error('Not a Reign backup file');
  }
  if (data.settings) await kvSet('settings', data.settings);
  if (data.current) await kvSet('current', data.current);
  else await kvDel('current');
  const progress = data.tournaments?.['grand-orbit'];
  if (progress) await kvSet('tournament:grand-orbit', progress);
  if (Array.isArray(data.results)) {
    const d = await db();
    const tx = d.transaction('results', 'readwrite');
    await tx.objectStore('results').clear();
    for (const r of data.results) void tx.objectStore('results').add(r);
    await tx.done;
  }
}

export async function resetAll(): Promise<void> {
  const d = await db();
  await d.clear('kv');
  await d.clear('results');
}
