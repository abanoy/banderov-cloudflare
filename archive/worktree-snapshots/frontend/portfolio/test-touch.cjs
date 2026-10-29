// Chrome device/touch emulation only, not a physical phone or swipe/zoom test.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-41');
  await fs.mkdir(output, { recursive: true });
  const results = [];
  try {
    for (const [width, height] of [[320, 740], [390, 844]]) for (const palette of ['day', 'night']) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
      const errors = [];
      const audioRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/\.(mp3|ogg)(?:\?|$)/.test(request.url())) audioRequests.push(request.url()); });
      await page.addInitScript(value => localStorage.setItem('banderov-portfolio.palette', value), palette);
      await page.goto('http://127.0.0.1:4173/');
      assert.ok(await page.evaluate(() => matchMedia('(pointer:coarse)').matches && navigator.maxTouchPoints > 0));
      await page.getByRole('link', { name: 'Games', exact: true }).tap();
      await page.locator('#tab-crusaders').tap();
      assert.equal(await page.locator('#tab-crusaders').getAttribute('aria-selected'), 'true');
      assert.ok(await page.locator('#feature-crusaders .status').isVisible());
      await page.locator('#tab-idols').tap();
      await page.locator('[data-image=screen]').tap();
      await page.waitForFunction(() => document.querySelector('#idols-visual').getAttribute('aria-busy') === 'false');
      assert.ok((await page.locator('#idols-visual').getAttribute('alt')).includes('Actual local'));
      await page.getByRole('link', { name: 'Artwork', exact: true }).tap();
      await page.locator('.art-link').first().tap();
      await page.waitForFunction(() => !document.querySelector('.detail-toggle').disabled);
      await page.locator('.detail-toggle').tap();
      assert.equal(await page.locator('.detail-toggle').getAttribute('aria-pressed'), 'true');
      await page.setViewportSize({ width: height, height: width });
      assert.ok(await page.locator('.art-dialog').isVisible());
      assert.ok(await page.locator('.art-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.locator('.art-next').tap();
      await page.waitForFunction(() => !document.querySelector('.detail-toggle').disabled);
      assert.equal(await page.locator('.detail-toggle').getAttribute('aria-pressed'), 'false');
      assert.ok((await page.locator('.art-position').textContent()).startsWith('2 of 3'));
      await page.locator('.art-dialog').screenshot({ path: path.join(output, `${palette}-${width}-landscape.png`) });
      await page.locator('.dialog-close').tap();
      await page.waitForFunction(() => !document.querySelector('.art-dialog').open);
      await page.waitForFunction(() => !document.body.classList.contains('dialog-open'));
      assert.ok(await page.evaluate(() => !document.body.classList.contains('dialog-open')));
      await page.setViewportSize({ width, height });
      await page.getByRole('link', { name: 'Music', exact: true }).tap();
      await page.getByRole('button', { name: 'Toggle night palette' }).tap();
      assert.equal(await page.locator('html').getAttribute('data-palette'), palette === 'day' ? 'night' : 'day');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
      assert.deepEqual(errors, []);
      assert.deepEqual(audioRequests, []);
      results.push({ width, height, palette, touchEmulation: true, deviceScaleFactor: 3, audioRequests, errors });
      console.log(`PASS ${width}x${height}/${palette}: coarse pointer, taps, open-dialog rotation, Next/Fit reset, Close, palette, no initial audio/errors`);
      await page.close();
    }
    await fs.writeFile(path.join(output, 'touch.json'), JSON.stringify({ scope: 'Chrome emulated coarse-pointer taps and viewport rotation, not real hardware/orientation sensors, swipes, pinch zoom or native audio internal controls.', results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
