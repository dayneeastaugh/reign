import { readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTournament, CONTENT_SCHEMA_VERSION, type TournamentDef } from '../packages/engine/src/index';

/**
 * Publishes validated quests to the site's content directory. This is served
 * and cached separately from the app bundle, so adding or revising a quest is a
 * content commit — the installed app picks it up without a new app version.
 */
const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'tournaments');
const out = join(root, '..', 'apps', 'game', 'public', 'content');

interface ManifestEntry {
  id: string;
  name: string;
  version: number;
  goal: string;
  levelCount: number;
  file: string;
  bytes: number;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'quests'), { recursive: true });

const quests: ManifestEntry[] = [];
let failed = false;

for (const file of readdirSync(src).filter((f) => f.endsWith('.json'))) {
  const raw = readFileSync(join(src, file), 'utf8');
  const quest = JSON.parse(raw) as TournamentDef;
  const problems = validateTournament(quest);
  if (problems.length) {
    failed = true;
    console.error(`✗ ${file}:`);
    for (const p of problems) console.error('  -', p);
    continue;
  }
  writeFileSync(join(out, 'quests', file), raw);
  quests.push({
    id: quest.id,
    name: quest.name,
    version: quest.version,
    goal: quest.goal,
    levelCount: quest.levels.length,
    file: `quests/${file}`,
    bytes: Buffer.byteLength(raw),
  });
  console.log(`✓ ${quest.name} v${quest.version} — ${quest.levels.length} levels`);
}

if (failed) {
  console.error('Publish aborted: invalid content.');
  process.exit(1);
}

// Quest artwork travels with the content, not the app bundle.
const assets = join(root, 'assets');
try {
  if (statSync(assets).isDirectory()) {
    cpSync(assets, join(out, 'assets'), { recursive: true });
  }
} catch {
  /* no assets yet */
}

const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  // Stamped by the publishing step so the app can tell editions apart.
  publishedAt: new Date().toISOString(),
  quests: quests.sort((a, b) => a.id.localeCompare(b.id)),
};

writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nPublished ${quests.length} quest(s) to ${out}`);
