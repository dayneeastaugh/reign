import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Difficulty, GeneratedPuzzle } from '@reign/engine';

export interface Settings {
  autoX: boolean;
  showConflicts: boolean;
}

export const DEFAULT_SETTINGS: Settings = { autoX: false, showConflicts: true };

export interface SavedGame {
  game: GeneratedPuzzle;
  marks: number[];
  elapsed: number;
  savedAt: number;
}

export interface GameResult {
  puzzleId: string;
  difficulty: Difficulty;
  seconds: number;
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
