/// <reference types="vite/client" />
import type { TournamentDef } from '@reign/engine';
import { getQuests, putQuest, kvGet, kvSet } from './db';
import seedQuest from '../../../content/tournaments/grand-orbit.json';

/**
 * Quests are content, not code. They are served from the site's content
 * directory and cached in IndexedDB, so publishing or revising one is a content
 * commit that an installed app picks up on its own — no new app version, no
 * store round trip. One quest is bundled as a seed purely so a first run with
 * no network is never empty.
 */
export const CONTENT_BASE = `${import.meta.env.BASE_URL}content/`;

const SEED: TournamentDef = seedQuest as unknown as TournamentDef;
const LAST_SYNC = 'contentLastSync';

export interface ManifestEntry {
  id: string;
  name: string;
  version: number;
  goal: string;
  levelCount: number;
  file: string;
  bytes: number;
}

export interface ContentManifest {
  schemaVersion: number;
  publishedAt: string;
  quests: ManifestEntry[];
}

/** Quests already on the device; seeded on first run so play can start offline. */
export async function loadLocalQuests(): Promise<TournamentDef[]> {
  const stored = await getQuests();
  if (stored.length) return stored;
  await putQuest(SEED);
  return [SEED];
}

export interface SyncResult {
  added: string[];
  updated: string[];
  skipped: string[];
}

/**
 * Fetch the published manifest and pull down anything new or revised. Quests
 * whose schema this build predates are skipped rather than breaking the app —
 * an old install simply keeps playing what it understands.
 */
export async function syncContent(known: TournamentDef[], appSchema: number): Promise<SyncResult> {
  const result: SyncResult = { added: [], updated: [], skipped: [] };
  const res = await fetch(`${CONTENT_BASE}manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const manifest = (await res.json()) as ContentManifest;

  const have = new Map(known.map((q) => [q.id, q.version]));
  for (const entry of manifest.quests) {
    const current = have.get(entry.id);
    if (current !== undefined && current >= entry.version) continue;

    const questRes = await fetch(`${CONTENT_BASE}${entry.file}`, { cache: 'no-cache' });
    if (!questRes.ok) continue;
    const quest = (await questRes.json()) as TournamentDef;
    if (quest.schemaVersion > appSchema) {
      result.skipped.push(quest.id);
      continue;
    }
    await putQuest(quest);
    (current === undefined ? result.added : result.updated).push(quest.id);
  }

  await kvSet(LAST_SYNC, Date.now());
  return result;
}

export async function lastSyncedAt(): Promise<number | undefined> {
  return kvGet<number>(LAST_SYNC);
}

/** Resolve a quest-relative asset path (artwork travels with the content). */
export function contentUrl(path: string): string {
  return `${CONTENT_BASE}${path}`;
}
