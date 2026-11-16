// Regenerate test-checksums.json — the integrity manifest for every graded
// test file. The grader refuses to grade against a test file whose hash does
// not match this manifest, so an accidental (or "helpful") edit that weakens a
// suite turns into a loud error instead of a silently lower bar.
//
// Run this ONLY when you have intentionally changed a test suite:
//   node scripts/update-test-checksums.ts

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const files: string[] = [];

// challenges/*/test.ts
for (const dir of readdirSync(join(ROOT, 'challenges'), { withFileTypes: true })) {
  if (dir.isDirectory()) files.push(join(ROOT, 'challenges', dir.name, 'test.ts'));
}
// labs/*/test/*.test.ts
for (const dir of readdirSync(join(ROOT, 'labs'), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const testDir = join(ROOT, 'labs', dir.name, 'test');
  try {
    for (const f of readdirSync(testDir)) {
      if (f.endsWith('.test.ts') || f === 'helper.ts') files.push(join(testDir, f));
    }
  } catch { /* lab without a test dir */ }
}
// graduation/acceptance/*.test.ts + the shared client
for (const f of readdirSync(join(ROOT, 'graduation', 'acceptance'))) {
  if (f.endsWith('.test.ts') || f === 'client.ts') files.push(join(ROOT, 'graduation', 'acceptance', f));
}

const manifest: Record<string, string> = {};
for (const file of files.sort()) {
  const rel = relative(ROOT, file);
  manifest[rel] = createHash('sha256').update(readFileSync(file)).digest('hex');
}

writeFileSync(join(ROOT, 'test-checksums.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`test-checksums.json updated — ${Object.keys(manifest).length} files hashed.`);
