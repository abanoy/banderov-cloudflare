const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict'), { createHash } = require('node:crypto'), { chromium } = require('playwright');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const root = path.resolve(process.argv[2]), base = process.argv[3] || 'http://127.0.0.1:8792';
  assert(/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(base), 'Only an explicit loopback Worker is allowed');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'integration-manifest.json'), 'utf8'));
  let served = 0;
  for (const file of manifest.files) {
    assert.equal(hash(await fs.readFile(file.source)), file.sourceSha256, 'Concurrent source changed: ' + file.path);
    assert.equal(hash(await fs.readFile(path.join(root, file.path))), file.sha256, 'Staged bytes changed: ' + file.path);
    if (file.path.startsWith('public/')) {
      const response = await fetch(base + '/' + file.path.slice(7));
      assert.equal(response.status, 200, file.path);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())), file.sha256, 'HTTP bytes: ' + file.path);
      served++;
    }
  }
  const canonical = await fetch(base + '/games/don-bass-idols', { redirect: 'manual' });
  assert.equal(canonical.status, 307); assert.equal(new URL(canonical.headers.get('location'), base).pathname, '/games/don-bass-idols/');
  assert.equal(await (await fetch(base + '/health')).text(), 'ok');
  assert.equal((await fetch(base + '/ws')).status, 426);
  for (const origin of ['https://html-classic.itch.zone', 'https://uploads.ungrounded.net', 'https://don-bass-idols-make-music-battle.game-files.crazygames.com']) {
    const response = await fetch(base + '/rooms', { headers: { Origin: origin } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert(Array.isArray((await response.json()).rooms));
  }
  assert.equal((await fetch(base + '/rooms', { headers: { Origin: 'https://unapproved.invalid' } })).status, 403);
  assert.equal((await fetch(base + '/missing-asset-that-must-not-be-spa')).status, 404);
  const stats = await (await fetch(base + '/stats')).json(); assert.equal(stats.version, '1.1.2');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--mute-audio'] });
  const rows = [];
  try {
    for (const [width, noJs] of [[320, false], [1280, false], [320, true]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, javaScriptEnabled: !noJs }); page.setDefaultTimeout(8000);
      const errors = [], bad = [], audio = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) bad.push(r.url()); });
      page.on('request', r => { if (/\.(mp3|ogg)(?:\?|$)/.test(r.url())) audio.push(r.url()); });
      await page.goto(base + '/', { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('h1').innerText(), 'Banderov.com'); assert.equal(await page.locator('#workspace-review').getAttribute('href'), 'workspace.css');
      const play = page.getByRole('link', { name: 'Play Don Bass Idols', exact: true }); assert.equal(await play.getAttribute('href'), '/games/don-bass-idols/');
      for (const section of ['Games', 'Artwork', 'Music', 'Stories']) {
        const link = page.locator('.header nav').getByRole('link', { name: section, exact: true }); await link.press('Enter');
        assert.equal(new URL(page.url()).hash, await link.getAttribute('href'));
      }
      if (!noJs) {
        await page.goto(base + '/#feature-crusaders'); await page.waitForFunction(() => document.activeElement === document.querySelector('#feature-crusaders') && !document.querySelector('#feature-crusaders').hidden);
        await page.locator('.study-art-view').press('Enter'); await page.waitForFunction(() => document.querySelector('.dialog-image').naturalWidth === 1690 && !document.querySelector('.dialog-image').hidden); await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]') && document.activeElement === document.querySelector('.study-art-view')); 
        await page.goto(base + '/#connections'); await page.waitForFunction(() => document.querySelector('#connections').open && document.activeElement === document.querySelector('#connections>summary'));
        await page.locator('.header nav a[href="#music"]').press('Enter'); await page.getByRole('slider', { name: 'Music volume', exact: true }).press('Home');
        await page.waitForFunction(() => [...document.querySelectorAll('audio')].every(e => e.volume === 0 && e.paused));
        assert(await page.locator('audio').evaluateAll(items => items.every(e => e.volume === 0 && e.paused)));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width); assert.deepEqual(errors, []); assert.deepEqual(bad, []); assert.deepEqual(audio, []);
      if (width === 1280) await page.screenshot({ path: path.join(root, 'verification', 'portfolio-worker-desktop.png') });
      rows.push({ width, noJs, keyboardSectionLinks: true, errors, bad, initialAudio: 0 }); await page.close();
    }
    const game = await browser.newPage({ viewport: { width: 390, height: 844 } }); game.setDefaultTimeout(8000);
    const gameErrors = [], gameBad = [], externalBlocked = [];
    game.on('pageerror', e => gameErrors.push(e.message)); game.on('response', r => { if (r.status() >= 400) gameBad.push(r.url()); });
    await game.route('**/*', route => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      externalBlocked.push(route.request().url()); return route.abort();
    });
    await game.goto(base + '/games/don-bass-idols/', { waitUntil: 'networkidle' }); await game.waitForFunction(() => document.querySelector('canvas')?.width > 0);
    assert.equal(await game.evaluate(() => window.BUILD), 47);
    const tracks = await game.evaluate(() => Object.values(window.TRACKS).flatMap(t => t.src).map(s => new URL(s, document.baseURI).pathname));
    assert(tracks.every(s => s.startsWith('/games/don-bass-idols/music/')));
    assert.deepEqual(gameErrors, []); assert.deepEqual(gameBad, []);
    await game.screenshot({ path: path.join(root, 'verification', 'game-worker-phone.png') }); await game.close();
    await fs.writeFile(path.join(root, 'verification', 'readiness.json'), JSON.stringify({ browser: browser.version(), files: manifest.files.length, assetsServedWithHashes: served, allSourceAndStageHashesMatch: true, canonicalGameSlash: true, relayHttpAndOrigins: true, statsVersion: stats.version, rows, game: { build: 47, tracks, gameErrors, gameBad, externalBlocked, scope: 'Muted startup and relative-resource resolution; external SDK blocked, no multiplayer/gameplay progression proof.' }, limitations: ['Installed local Worker runtime falls back to2025-07-18 from requested2025-09-01.', 'No physical-device, audible, spoken-screen-reader, live cross-network or production-domain routing test.'] }, null, 2));
    console.log('Source/stage/HTTP hashes, local Worker paths and browser checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
