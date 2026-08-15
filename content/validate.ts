import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTournament, type TournamentDef } from '../packages/engine/src/index';

const root = dirname(fileURLToPath(import.meta.url));
const dir = join(root, 'tournaments');
const ASSET_BUDGET = 500 * 1024;
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const t = JSON.parse(readFileSync(join(dir, file), 'utf8')) as TournamentDef;
  const problems = validateTournament(t);
  if (t.collectible.art) {
    const artPath = join(root, t.collectible.art);
    if (!existsSync(artPath)) problems.push(`collectible art missing: ${t.collectible.art}`);
    else if (statSync(artPath).size > ASSET_BUDGET) {
      problems.push(`collectible art exceeds ${ASSET_BUDGET / 1024} KB budget: ${t.collectible.art}`);
    }
  }
  if (problems.length) {
    failed = true;
    console.error(`✗ ${file}:`);
    for (const p of problems) console.error('  -', p);
  } else {
    console.log(`✓ ${file}: ${t.name} v${t.version} — ${t.levels.length} levels, all valid`);
  }
}

process.exit(failed ? 1 : 0);
