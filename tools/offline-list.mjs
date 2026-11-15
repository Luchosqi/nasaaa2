// Writes offline-files.json: every file "Save for offline" downloads, with a content version.
// Only files tracked by git are listed, so the list matches what is deployed and zipped.
//   node tools/offline-list.mjs           regenerate
//   node tools/offline-list.mjs --check   fail if it is out of date (used by CI)
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'index.html', 'museo.html', 'CREDITS.md', 'src', 'vendor', 'assets'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean).sort();

const hash = createHash('sha256');
let bytes = 0;
for (const f of tracked) {
  const data = await readFile(join(root, f));
  hash.update(f).update(data); bytes += data.length;
}
const json = JSON.stringify({ version: hash.digest('hex').slice(0, 12), bytes, files: ['./', ...tracked] }, null, 1) + '\n';
const target = join(root, 'offline-files.json');

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== json) { console.error('offline-files.json is out of date: run node tools/offline-list.mjs and commit it.'); process.exit(1); }
  console.log('offline-files.json is up to date.');
} else {
  await writeFile(target, json);
  console.log(`offline-files.json: ${tracked.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
}
