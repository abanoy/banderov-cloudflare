// Inspect one explicitly named local snapshot; never publish or replace it.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

(async () => {
  const name = process.argv[2];
  assert(name && /^[A-Za-z0-9-]+$/.test(name), 'Pass the exact local staging folder name');
  const root = path.resolve(__dirname, 'staging', name);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'staging-manifest.json'), 'utf8'));
  const base = 'http://127.0.0.1:4173/staging/' + name + '/';
  for (const file of manifest.files) {
    const target = path.resolve(root, file.path);
    assert(target.startsWith(root + path.sep));
    let source = await fs.readFile(path.join(__dirname, file.path));
    if (file.transform) {
      assert.equal(file.path, 'index.html');
      assert.equal(file.transform, 'compact-local-review');
      assert.equal(hash(source), file.sourceSha256, 'Original source HTML hash');
      const html = source.toString('utf8');
      assert(!html.includes('id="workspace-review"'));
      source = Buffer.from(html.replace('</title>', ' · Compact desktop review</title>').replace('</head>', '<link id="workspace-review" rel="stylesheet" href="review/workspace.css"></head>'), 'utf8');
    }
    const snapshot = await fs.readFile(target);
    const response = await fetch(base + file.path);
    assert.equal(response.status, 200, file.path);
    const served = Buffer.from(await response.arrayBuffer());
    for (const bytes of [source, snapshot, served]) {
      assert.equal(bytes.length, file.bytes, file.path);
      assert.equal(hash(bytes), file.sha256, file.path);
    }
  }
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const rows = [];
  const output = path.join(__dirname, 'review', process.argv[3] || 'snapshot-verification');
  await fs.mkdir(output, { recursive: true });
  const checkProjectDrawer = async page => {
    const drawer = page.locator('.project-drawer');
    const summary = drawer.locator(':scope > summary');
    assert.equal(await drawer.evaluate(e => e.open), false);
    await summary.press('Space');
    assert(await drawer.evaluate(e => e.open));
    assert((await summary.boundingBox()).height >= 44);
    assert.equal(await summary.evaluate(e => getComputedStyle(e).outlineWidth), '3px');
    const links = page.getByRole('navigation', { name: 'Game project directory' }).getByRole('link');
    assert.equal(await links.count(), 4);
    for (const link of await links.all()) {
      const target = await link.getAttribute('href');
      await link.press('Enter');
      await page.waitForURL(url => url.hash === target);
      await page.waitForFunction(h => document.activeElement === document.querySelector(h), target);
      assert(await page.locator(target).evaluate(e => {
        const box = e.getBoundingClientRect();
        return box.top >= document.querySelector('.header').getBoundingClientRect().bottom - 2 && box.top < innerHeight;
      }));
    }
    await summary.press('Enter');
    assert.equal(await drawer.evaluate(e => e.open), false);
  };
  const checkMusicFileNames = async page => {
    for (const [name, file] of [['Open title theme file', 'title.mp3'], ['Open Cognition file', 'cognition.mp3']]) {
      const link = page.getByRole('link', { name, exact: true });
      assert.equal(await link.getAttribute('href'), 'assets/' + file);
      assert((await link.boundingBox()).height >= 44);
    }
  };
  try {
    for (const width of [320, 390, 1280]) for (const palette of ['day', 'night']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(8000);
      const errors = [], bad = [], audioRequests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) bad.push(r.url()); });
      page.on('request', r => { if (/\.(mp3|ogg)(?:\?|$)/.test(r.url())) audioRequests.push(r.url()); });
      await page.addInitScript(p => localStorage.setItem('banderov-portfolio.palette', p), palette);
      await page.goto(base + 'index.html', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('html').getAttribute('data-palette'), palette);
      assert.equal(audioRequests.length, 0);
      await checkProjectDrawer(page);
      // The directory may select another feature; restore Idols before its music link.
      await page.locator('#tab-idols').press('Enter');
      await checkMusicFileNames(page);
      assert.equal(await page.locator('.art-picker-preview[src]').count(), 0);
      await page.mouse.move(20, 140);
      await page.waitForFunction(() => document.body.classList.contains('desktop-pointer-lit'));
      if (manifest.layout === 'workspace') {
        assert.equal(await page.locator('#workspace-review').getAttribute('href'), 'review/workspace.css');
        if (width >= 1100) assert.equal(await page.locator('#main').evaluate(e => getComputedStyle(e).display), 'grid');
      }
      for (const link of await page.locator('.discipline-bar a').all()) {
        const target = await link.getAttribute('href');
        await link.press('Enter');
        assert.equal(new URL(page.url()).hash, target);
      }
      for (const link of await page.locator('.art-grid .art-link').all()) {
        await link.scrollIntoViewIfNeeded();
        await link.locator('img').evaluate(e => e.decode());
        assert(await link.evaluate(e => {
          const drawing = e.querySelector('img').getBoundingClientRect();
          const cue = e.querySelector('.art-open-prompt').getBoundingClientRect();
          return cue.height >= 44 && drawing.bottom <= cue.top + 1 && cue.bottom <= e.getBoundingClientRect().bottom + 1;
        }));
      }
      assert.equal(await page.locator('.preview-unavailable').count(), 0);
      assert.equal(await page.locator('.art-preview-status:visible').count(), 0);
      assert.equal(await page.locator('.track-repeat input').count(), 2);
      for (let index = 0; index < 2; index++) {
        const repeat = page.locator('.track-repeat input').nth(index);
        assert.equal(await repeat.isChecked(), false);
        await repeat.press('Space');
        assert(await page.locator('audio').nth(index).evaluate(e => e.loop));
        await repeat.press('Space');
        assert.equal(await page.locator('audio').nth(index).evaluate(e => e.loop), false);
      }
      assert.equal(audioRequests.length, 0);
      await page.locator('.intro-actions .background-toggle').press('Enter');
      assert.equal(await page.locator('body').evaluate(e => e.classList.contains('desktop-pointer-lit')), false);
      assert.deepEqual(await page.locator('.background-toggle').evaluateAll(items => items.map(e => e.getAttribute('aria-pressed'))), ['true', 'true']);
      await page.locator('.footer-links .background-toggle').press('Space');
      assert.deepEqual(await page.locator('.background-toggle').evaluateAll(items => items.map(e => e.getAttribute('aria-pressed'))), ['false', 'false']);
      assert.equal(await page.locator('.footer').getAttribute('id'), 'footer');
      assert.equal(await page.locator('.footer').evaluate(e => getComputedStyle(e).outlineWidth), '2px');
      assert.equal(await page.locator('h1').textContent(), 'Banderov.com');
      assert.equal(await page.locator('.hop-helper-card .status').textContent(), 'Local build');
      for (const section of ['Games', 'Artwork', 'Music', 'Stories']) {
        const link = page.locator('.header nav').getByRole('link', { name: section, exact: true });
        await link.press('Enter');
        const href = await link.getAttribute('href');
        await page.waitForFunction(h => document.querySelector('.header nav a[aria-current=location]')?.getAttribute('href') === h, href);
        const stops = palette === 'night'
          ? { '#games': '#21183f', '#art': '#172c46', '#music': '#12333d', '#stories': '#2b2141' }
          : { '#games': '#d5ceff', '#art': '#c7dcfa', '#music': '#c5e6ee', '#stories': '#e4d5f4' };
        assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).getPropertyValue('--desktop-start').trim()), stops[href]);
      }
      const connectionSummary = page.locator('#connections>summary');
      await page.locator('.game-music-link').press('Enter');
      assert.equal(new URL(page.url()).hash, '#music');
      assert(await page.locator('audio').evaluateAll(items => items.every(e => e.paused)));
      assert.equal(audioRequests.length, 0);
      await connectionSummary.press('Space');
      assert.equal(await page.locator('#connections').evaluate(e => e.open), false);
      await page.locator('#tab-crusaders').press('Enter');
      await page.locator('.crusaders-feature .button').press('Enter');
      await page.waitForFunction(() => location.hash === '#connections'
        && document.querySelector('#connections').open
        && document.activeElement === document.querySelector('#connections>summary'));
      await connectionSummary.press('Space');
      assert.equal(await page.locator('#connections').evaluate(e => e.open), false);
      await page.locator('.crusaders-feature .button').press('Enter');
      await page.waitForFunction(() => document.querySelector('#connections').open
        && document.activeElement === document.querySelector('#connections>summary'));
      assert.equal(await page.locator('#connections article:visible').count(), 3);
      await page.locator('.connection-grid .text-link').press('Enter');
      await page.waitForFunction(() => document.querySelector('#tab-crusaders').getAttribute('aria-selected') === 'true');
      const study = page.locator('.study-art-view');
      assert.equal(await study.getAttribute('aria-haspopup'), 'dialog');
      await study.press('Enter');
      await page.waitForFunction(() => document.querySelector('.dialog-image').naturalWidth === 1690 && !document.querySelector('.detail-toggle').disabled);
      assert.equal(await page.locator('.art-image-size').innerText(), 'Image: 1690 × 620 px');
      assert.equal(await page.locator('.dialog-original').getAttribute('href'), base + 'assets/crusaders-turns.png');
      await page.waitForFunction(() => [...document.querySelectorAll('.art-picker-preview')].every(e => e.complete && e.naturalWidth > 0 && !e.hidden));
      const thumbnails = await page.locator('.art-picker-preview').evaluateAll(items => items.map(e => ({ width: e.naturalWidth, height: e.naturalHeight, fit: getComputedStyle(e).objectFit, alt: e.alt, src: e.src })));
      assert.deepEqual(thumbnails.map(e => [e.width, e.height]), [[1280, 2830], [720, 480], [1690, 620]]);
      assert(thumbnails.every(e => e.fit === 'contain' && e.alt === '' && e.src.startsWith(base + 'assets/')));
      await page.locator('.art-picker button').nth(1).press('Enter');
      await page.waitForFunction(() => document.querySelector('.dialog-image').naturalWidth === 720 && !document.querySelector('.dialog-image').hidden);
      assert.equal(await page.locator('.dialog-original').getAttribute('href'), base + 'assets/archive-art-1.png');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement === document.querySelector('.study-art-view') && !document.querySelector('.art-dialog').open);
      const art = page.getByRole('link', { name: 'View full illustration of Maria from the introduction', exact: true });
      await art.press('Enter');
      await page.waitForFunction(() => document.querySelector('.dialog-image').naturalWidth > 0 && !document.querySelector('.detail-toggle').disabled);
      assert.equal(await page.locator('.art-image-size').innerText(), 'Image: 1280 × 2830 px');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement === document.querySelector('.hero-art-view'));
      if ([320, 1280].includes(width) && palette === 'day') {
        await page.locator('#tab-idols').click();
        await page.locator('[data-game-capture]').press('Enter');
        await page.waitForFunction(() => document.querySelector('.capture-stage img')?.naturalWidth === 1280 && !document.querySelector('.capture-stage img').hidden);
        assert.equal(await page.locator('.capture-original').evaluate(e => e.href), base + 'assets/don-bass-screen.png');
        await page.locator('.capture-detail-toggle').press('Space');
        assert(await page.locator('.capture-stage').evaluate(e => e === document.activeElement && e.tabIndex === 0));
        assert(await page.locator('.capture-stage img').evaluate(e => e.getBoundingClientRect().width === 1280));
        assert(await page.locator('.capture-stage').evaluate(e => {
          const box = e.getBoundingClientRect(), image = e.querySelector('img').getBoundingClientRect();
          return e.scrollLeft === 0 && e.scrollTop === 0 && e.scrollWidth === 1280
            && Math.abs(image.left - box.left - e.clientLeft) < 1
            && Math.abs(image.top - box.top - e.clientTop) < 1;
        }));
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(() => { const s = document.querySelector('.capture-stage'); return s.scrollLeft > 0 && s.scrollTop > 0; });
        await page.locator('.capture-dialog [data-capture-view=cover]').press('Space');
        await page.waitForFunction(() => document.querySelector('.capture-stage img')?.naturalWidth === 1920 && !document.querySelector('.capture-stage img').hidden);
        assert.equal(await page.locator('.capture-original').evaluate(e => e.href), base + 'assets/don-bass-cover.png');
        assert.match(await page.locator('#capture-caption').innerText(), /Not a gameplay screenshot/);
        assert.equal(await page.locator('.capture-detail-toggle').getAttribute('aria-pressed'), 'false');
        assert.equal(await page.locator('.capture-stage').getAttribute('tabindex'), '-1');
        await page.keyboard.press('Escape');
        assert(await page.locator('[data-game-capture]').evaluate(e => e === document.activeElement));
        await page.locator('.seven-sips-card .project-capture a').press('Enter');
        await page.waitForFunction(() => document.querySelector('.capture-stage img')?.naturalWidth === 390 && !document.querySelector('.capture-stage img').hidden);
        assert.equal(await page.locator('.capture-original').evaluate(e => e.href), base + 'assets/seven-sips-opening.png');
        await page.keyboard.press('Escape');
        await page.locator('.hop-helper-card .project-capture a').first().press('Enter');
        await page.locator('.capture-dialog [data-capture-view=gameplay]').press('Enter');
        await page.waitForFunction(() => document.querySelector('.capture-stage img')?.naturalWidth === 1280 && !document.querySelector('.capture-stage img').hidden);
        assert.equal(await page.locator('.capture-original').evaluate(e => e.href), base + 'assets/hop-hop-helper-opening.png');
        assert.match(await page.locator('#capture-caption').innerText(), /Local archive gameplay capture/);
        await page.keyboard.press('Escape');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await page.locator('#music').scrollIntoViewIfNeeded();
      const idleDeck = await page.locator('.deck-status').evaluate(e => getComputedStyle(e).backgroundImage);
      await page.locator('audio').nth(1).evaluate(a => { a.muted = true; return a.play(); });
      await page.waitForFunction(() => document.querySelectorAll('audio')[1].currentTime > .2 && document.querySelector('.deck-status').textContent === 'Playing / Cognition');
      assert.notEqual(await page.locator('.deck-status').evaluate(e => getComputedStyle(e).backgroundImage), idleDeck);
      await page.locator('audio').nth(1).evaluate(a => { a.currentTime = a.duration - .2; });
      await page.waitForFunction(() => document.querySelectorAll('audio')[1].ended && document.querySelector('.deck-status').textContent === 'Selected tracks');
      assert.equal(await page.locator('.track.is-playing').count(), 0);
      assert.equal(await page.locator('.deck-status').evaluate(e => getComputedStyle(e).backgroundImage), idleDeck);
      assert.deepEqual(errors, []); assert.deepEqual(bad, []);
      // Section captures hide sticky chrome only in this disposable test page.
      await page.addStyleTag({ content: '.header,.header *,.skip-link{visibility:hidden!important}' });
      await page.locator('#stories').screenshot({ path: path.join(output, palette + '-' + width + '-stories.png') });
      rows.push({ width, palette, initialAudio: 0, errors, bad, studyViewerEntry: true, studyNestedOriginal: true, mutedProgrammaticCognitionEnd: true });
      await page.close();
    }
    const fallbackPage = await browser.newPage({ viewport: { width: 320, height: 740 } });
    const expectedFallback404 = [], fallbackErrors = [];
    fallbackPage.on('pageerror', e => fallbackErrors.push(e.message));
    fallbackPage.on('response', r => { if (r.status() >= 400) expectedFallback404.push(r.url()); });
    await fallbackPage.goto(base + 'index.html#art');
    await fallbackPage.locator('.art-link img').first().evaluate(e => { e.src = new URL('assets/snapshot-missing-preview.webp', document.baseURI).href; });
    await fallbackPage.waitForFunction(() => document.querySelector('.art-link').classList.contains('preview-unavailable'));
    await fallbackPage.locator('.art-link').first().press('Enter');
    await fallbackPage.waitForFunction(() => !document.querySelector('.dialog-image').hidden && document.querySelector('.dialog-image').naturalWidth === 1280);
    assert.equal(await fallbackPage.locator('.dialog-image').evaluate(e => e.src), base + 'assets/archive-art-3.png');
    assert.deepEqual(fallbackErrors, []);
    assert.deepEqual(expectedFallback404, [base + 'assets/snapshot-missing-preview.webp']);
    await fallbackPage.keyboard.press('Escape');
    assert(await fallbackPage.locator('.art-link').first().evaluate(e => e === document.activeElement));
    await fallbackPage.close();
    const page = await browser.newPage({ viewport: { width: 320, height: 740 }, javaScriptEnabled: false });
    page.setDefaultTimeout(8000);
    await page.goto(base + 'index.html');
    await checkProjectDrawer(page);
    await checkMusicFileNames(page);
    assert.equal(await page.locator('.featured-game:visible').count(), 2);
    assert.equal(await page.locator('.track-repeat').count(), 0);
    assert.equal(await page.locator('.art-open-prompt').count(), 3);
    for (const link of await page.locator('.discipline-bar a').all()) {
      const target = await link.getAttribute('href');
      await link.press('Enter');
      assert.equal(new URL(page.url()).hash, target);
    }
    await page.locator('#connections>summary').press('Space');
    assert.equal(await page.locator('#connections').evaluate(e => e.open), false);
    await page.locator('.crusaders-feature .button').press('Enter');
    assert.equal(new URL(page.url()).hash, '#connections');
    await page.locator('#connections>summary').press('Space');
    assert.equal(await page.locator('#connections article:visible').count(), 3);
    await page.getByRole('link', { name: 'View full Maria illustration', exact: true }).press('Enter');
    assert(page.url().endsWith('/assets/archive-art-3.png'));
    await page.goto(base + 'index.html');
    assert.equal(await page.locator('.study-art-view').getAttribute('aria-haspopup'), null);
    await page.locator('.study-art-view').press('Enter');
    assert.equal(page.url(), base + 'assets/crusaders-turns.png');
    await page.goto(base + 'index.html');
    assert.equal(await page.locator('.background-toggle:visible').count(), 0);
    await page.locator('[data-game-capture]').press('Enter');
    assert.equal(page.url(), base + 'assets/don-bass-screen.png');
    await page.close();
    await fs.writeFile(path.join(output, 'snapshot-check.json'), JSON.stringify({ browser: browser.version(), base, layout: manifest.layout || 'main', files: manifest.files.length, totalBytes: manifest.totalBytes, sourceSnapshotHttpHashesMatch: true, nativeProjectDrawerAndNoJsTargetFocus: true, distinctMusicFileNamesAnd44pxActions: true, desktopPointerAndPause: true, contactStripDeferredAndNested: true, gameMusicNavigationWithoutAudio: true, noJsOriginalNavigation: true, foldedConnectionsAndSameHashEntry: true, noJsNativeConnections: true, directoryNavigation: true, repeatControls: true, galleryBelowImageCues: true, packagedOriginalFallback: true, expectedFallback404, sharedPauseControls: true, sectionTints: true, hopLocalBuild: true, terminalDeckState: true, artworkSizeStrip: true, activeFooterFrame: true, nestedGameCaptureOriginalsFullOriginAndDetailScrollAt320And1280Day: true, rows }, null, 2));
    console.log('Snapshot files, six browser cases and no-JS original navigation passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
