import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTournament, checkPalette, type TournamentDef } from '../packages/engine/src/index';

const root = dirname(fileURLToPath(import.meta.url));
const dir = join(root, 'tournaments');
const ASSET_BUDGET = 500 * 1024;
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const t = JSON.parse(readFileSync(join(dir, file), 'utf8')) as TournamentDef;
  const problems = validateTournament(t);

  // Region colour carries gameplay information, so an illegible palette is a
  // bug, not a matter of taste. Check each variant at the board sizes it is
  // actually used at, including under simulated colour blindness.
  const sizesByVariant = new Map<string, number[]>();
  for (const level of t.levels) {
    const id = level.variant ?? t.theme.defaultVariant;
    sizesByVariant.set(id, [...(sizesByVariant.get(id) ?? []), level.size]);
  }
  for (const variant of t.theme.variants) {
    const sizes = sizesByVariant.get(variant.id);
    if (!sizes) continue;
    problems.push(...checkPalette(variant, sizes));
  }
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
