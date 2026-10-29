// Read-only source/runtime audit; writes a local review inventory, never public/.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

(async () => {
  const sourceNames = ['index.html', 'style.css', 'creative.css', 'gradient.css', 'main.js'];
  const references = new Set([...sourceNames, 'assets/fonts/orbitron-OFL.txt', 'assets/fonts/sharetechmono-OFL.txt', 'assets/fonts/silkscreen-OFL.txt']);
  for (const name of sourceNames) {
    const text = await fs.readFile(path.join(__dirname, name), 'utf8');
    for (const match of text.matchAll(/assets\/[A-Za-z0-9.\[\]/-]+/g)) references.add(match[0]);
  }
  const files = [];
  for (const name of [...references].sort()) {
    const bytes = await fs.readFile(path.join(__dirname, name));
    files.push({ path: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  const browser = await chromium.launch({ executablePath: process.env.PORTFOLIO_CHROME || path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
  const loads = [];
  try {
    for (const layout of ['main', 'workspace']) {
    for (const { width, deviceScaleFactor } of [{ width: 390, deviceScaleFactor: 1 }, { width: 390, deviceScaleFactor: 3 }, { width: 1280, deviceScaleFactor: 1 }]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor });
      const page = await context.newPage();
      const responses = [];
      const errors = [];
      const failures = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => failures.push(request.url()));
      page.on('response', response => responses.push({ url: new URL(response.url()).pathname, status: response.status(), bytes: Number(response.headers()['content-length'] || 0) }));
      await page.goto(`http://127.0.0.1:4173/${layout === 'workspace' ? '?layout=workspace' : ''}`, { waitUntil: 'networkidle' });
      const initial = responses.slice();
      const selectedCover = await page.locator('#idols-visual').evaluate(image => new URL(image.currentSrc).pathname);
      assert(initial.every(item => item.status === 200), 'initial response failure');
      assert(!initial.some(item => /\.(mp3|ogg)$/.test(item.url)), 'audio downloaded before playback');
      for (const name of ['Games', 'Artwork', 'Music', 'Stories']) {
        await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
        await page.waitForLoadState('networkidle');
      }
      await page.getByRole('link', { name: 'View the development study', exact: false }).click();
      await page.locator('#feature-crusaders').waitFor({ state: 'visible' });
      await page.waitForLoadState('networkidle');
      assert(responses.every(item => item.status === 200), 'browsing response failure');
      assert(!responses.some(item => /\.(mp3|ogg)$/.test(item.url)), 'audio downloaded while browsing');
      assert.deepEqual(errors, [], 'page script errors');
      assert.deepEqual(failures, [], 'failed requests');
      loads.push({ layout, viewport: width, deviceScaleFactor, errors, failures, selected_cover: selectedCover, initial_body_bytes: initial.reduce((sum, item) => sum + item.bytes, 0), initial,
                   after_browsing_body_bytes: responses.reduce((sum, item) => sum + item.bytes, 0), after_browsing: responses });
      await context.close();
    }
    }
  } finally { await browser.close(); }
  const unreferencedAssets = (await fs.readdir(path.join(__dirname, 'assets'), { withFileTypes: true })).filter(entry => entry.isFile() && !references.has(`assets/${entry.name}`)).map(entry => entry.name);
  const report = {
    scope: 'Local review inventory only. No packaging, integration, routing or deployment performed.',
    limitations: 'Body sizes from loopback no-store uncompressed Content-Length. Not public speed, transfer overhead, or field performance. Source reference scan covers this small static frontend; inspect again after edits.',
    pending_integration: ['Approve portfolio/game URLs', 'Replace /game-preview/ only during reviewed integration', 'Preserve Worker relay endpoints and existing game', 'Exclude review tools, captures and unused reference assets from public assets'],
    referenced_files: files, referenced_total_bytes: files.reduce((sum, item) => sum + item.bytes, 0),
    preserved_unreferenced_assets: unreferencedAssets, loads,
  };
  const directory = path.join(__dirname, 'review', process.argv[2] || '');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'delivery-inventory.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ referenced_files: files.length, referenced_total_bytes: report.referenced_total_bytes,
    preserved_unreferenced_assets: unreferencedAssets, loads: loads.map(({ layout, viewport, deviceScaleFactor, selected_cover, initial_body_bytes, after_browsing_body_bytes }) => ({ layout, viewport, deviceScaleFactor, selected_cover, initial_body_bytes, after_browsing_body_bytes })) }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
