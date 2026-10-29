const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-49');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [], audio = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/\.(mp3|ogg)(?:\?|$)/.test(request.url())) audio.push(request.url()); });
      await page.goto('http://127.0.0.1:4173/review/cobalt.html');
      await page.waitForFunction(() => document.querySelector('#status').textContent === 'Cobalt console. Review only.');
      const frame = page.frames().find(frame => frame.url().endsWith('/index.html'));
      const original = await frame.locator('.hero-art img').getAttribute('src');
      assert.ok(await frame.evaluate(() => [...document.fonts].some(face => face.family === 'ProggyClean' && face.status === 'loaded')));
      for (const palette of ['day', 'night']) {
        if (await frame.locator('html').getAttribute('data-palette') !== palette) await frame.locator('.palette-toggle').click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, `${palette}-${width}-opening.png`), fullPage: true });
        // Iframe element screenshots can include outer chrome and clip long
        // sections. Use a disposable standalone page with the actual frame width.
        const capture = await browser.newPage({ viewport: { width: await frame.evaluate(() => innerWidth), height: 900 } });
        try {
          await capture.addInitScript(value => localStorage.setItem('banderov-portfolio.palette', value), palette);
          await capture.goto('http://127.0.0.1:4173/');
          await capture.addStyleTag({ url: 'http://127.0.0.1:4173/review/cobalt.css' });
          await capture.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.querySelectorAll('main img')].map(image => { image.loading = 'eager'; return image.decode(); }));
          });
          await capture.addStyleTag({ content: '.header,.skip-link{visibility:hidden!important}' });
          for (const project of ['idols', 'crusaders']) {
            await capture.locator(`#tab-${project}`).click();
            await capture.locator('#games').screenshot({ path: path.join(output, `${palette}-${width}-${project}-games.png`) });
          }
          for (const section of ['art', 'music', 'stories']) {
            await capture.locator(`#${section}`).screenshot({ path: path.join(output, `${palette}-${width}-${section}.png`) });
          }
        } finally { await capture.close(); }
        await frame.locator('#tab-crusaders').press('End');
        assert.equal(await frame.locator('#tab-crusaders').getAttribute('aria-selected'), 'true');
        await frame.locator('nav a[href="#art"]').press('Enter');
        await frame.waitForFunction(() => document.querySelector('nav a[href="#art"]').getAttribute('aria-current') === 'location');
        await frame.locator('.art-link').first().press('Enter');
        await frame.waitForFunction(() => document.querySelector('.art-dialog').open);
        await page.keyboard.press('Escape');
        await frame.waitForFunction(() => !document.body.classList.contains('dialog-open'));
        await frame.locator('.header .wordmark').click();
      }
      await page.locator('#direction').selectOption('current');
      assert.equal(await frame.locator('#cobalt-review').count(), 0);
      assert.ok((await frame.locator('.header nav').evaluate(el => getComputedStyle(el).fontFamily)).includes('Share Tech Mono'));
      assert.equal(await frame.locator('.hero-art img').getAttribute('src'), original);
      assert.deepEqual(errors, []);
      assert.deepEqual(audio, []);
      console.log(`PASS ${width}: Cobalt/current, both palettes, original art, keyboard tabs/art/dialog, no overflow/audio/errors`);
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 320, height: 900 }, javaScriptEnabled: false });
    await page.goto('http://127.0.0.1:4173/review/cobalt.html');
    assert.ok(await page.locator('#direction').isDisabled());
    assert.ok(await page.locator('noscript').isVisible());
    assert.ok(page.frames().some(frame => frame.url().endsWith('/index.html')));
    await page.close();
    console.log('PASS no-JS: current portfolio and disabled comparison control');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
