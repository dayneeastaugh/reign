import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTournament, type TournamentDef } from '../packages/engine/src/index';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'tournaments');
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const t = JSON.parse(readFileSync(join(dir, file), 'utf8')) as TournamentDef;
  const problems = validateTournament(t);
  if (problems.length) {
    failed = true;
    console.error(`✗ ${file}:`);
    for (const p of problems) console.error('  -', p);
  } else {
    console.log(`✓ ${file}: ${t.name} v${t.version} — ${t.levels.length} levels, all valid`);
  }
}

process.exit(failed ? 1 : 0);
