import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

// Local staging only: never copies to public/, replaces a snapshot, or deploys.
const root = path.dirname(fileURLToPath(import.meta.url));
const workspace = process.argv.includes('--workspace');
if (process.argv.slice(2).some(arg => arg !== '--workspace')) throw new Error('Only --workspace is supported');
const compactDocument = bytes => {
  const html = bytes.toString('utf8');
  if (!html.includes('</title>') || !html.includes('</head>') || html.includes('id="workspace-review"')) throw new Error('Unexpected source HTML');
  return Buffer.from(html.replace('</title>', ' · Compact desktop review</title>').replace('</head>', '<link id="workspace-review" rel="stylesheet" href="review/workspace.css"></head>'), 'utf8');
};
const sources = ['index.html', 'style.css', 'creative.css', 'gradient.css', 'main.js'];
const references = new Set([...sources,
  'assets/fonts/orbitron-OFL.txt', 'assets/fonts/orbitron-METADATA.pb',
  'assets/fonts/sharetechmono-OFL.txt', 'assets/fonts/sharetechmono-METADATA.pb',
  'assets/fonts/silkscreen-OFL.txt', 'assets/fonts/silkscreen-METADATA.pb']);
for (const source of sources) {
  const content = await readFile(path.join(root, source), 'utf8');
  for (const match of content.matchAll(/assets\/[A-Za-z0-9.\[\]/-]+/g)) references.add(match[0]);
}

// Also needed by the optional layout query on the standard static snapshot.
references.add('review/workspace.css');

// Read and validate everything before creating any output. All paths must stay
// inside this frontend; absolute URLs and game files are never copied.
const files = [];
for (const relative of [...references].sort()) {
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep)) throw new Error(`Outside portfolio: ${relative}`);
  const original = await readFile(filename);
  const transformed = workspace && relative === 'index.html';
  const bytes = transformed ? compactDocument(original) : original;
  files.push({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...(transformed ? { transform: 'compact-local-review', sourceSha256: createHash('sha256').update(original).digest('hex') } : {}) });
}
const createdAtUtc = new Date().toISOString();
const name = `${createdAtUtc.replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
const output = path.join(root, 'staging', name);
await mkdir(output, { recursive: true });
for (const file of files) {
  const destination = path.join(output, file.path);
  await mkdir(path.dirname(destination), { recursive: true });
  if (file.transform) {
    const source = await readFile(path.join(root, file.path));
    if (createHash('sha256').update(source).digest('hex') !== file.sourceSha256) throw new Error('Source HTML changed during staging');
    await writeFile(destination, compactDocument(source), { flag: 'wx' });
  } else await copyFile(path.join(root, file.path), destination, constants.COPYFILE_EXCL);
  const copied = await readFile(destination);
  if (createHash('sha256').update(copied).digest('hex') !== file.sha256) {
    throw new Error(`Source changed during staging: ${file.path}; inspect this incomplete snapshot.`);
  }
}
await writeFile(path.join(output, 'staging-manifest.json'), JSON.stringify({
  createdAtUtc,
  layout: workspace ? 'workspace' : 'main',
  purpose: 'Inspectable local portfolio snapshot; not approved for production integration or publishing.',
  limitations: [
    '/game-preview/ depends on the local preview server and remains an unresolved integration link.',
    'No game, Worker, backend, routing or Cloudflare settings are included or changed.',
    'Only the compact review stylesheet is included; other review pages, screenshots, tests and unused references are excluded.',
    'Approve portfolio/game URLs and verify eventual hosting behavior before integration.'
  ],
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), files
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Local snapshot: ${output}`);
console.log(`${files.length} files verified against manifest; layout ${workspace ? 'workspace' : 'main'}; no public/ integration or deployment.`);
