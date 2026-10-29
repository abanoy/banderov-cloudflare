// Local font-review behavior; no Worker, source mutation or dependency install.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-30');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors = [], audio = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/\.(mp3|ogg)(\?|$)/.test(request.url())) audio.push(request.url()); });
      await page.goto('http://127.0.0.1:4173/review/type-in-context.html');
      await page.locator('#font').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('#font').disabled);
      const frame = page.frames().find(item => item.url().endsWith('/index.html'));
      assert.ok(frame, 'actual portfolio frame');
      const originalImage = await frame.locator('.hero-art img').getAttribute('src');
      for (const [font, family] of [['current', 'Share Tech Mono'], ['geometric', 'Orbitron'], ['pixel', 'Silkscreen'], ['proggy', 'ProggyClean'], ['system', 'Arial']]) {
        await page.locator('#font').selectOption(font);
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes(document.querySelector('#font').selectedOptions[0].textContent));
        assert.ok((await frame.locator('.hero h1').evaluate(el => getComputedStyle(el).fontFamily)).includes(family));
        await frame.evaluate(() => document.fonts.ready);
        if (font === 'pixel') assert.ok(await frame.evaluate(() => [...document.fonts].some(font => font.family === 'Silkscreen' && font.status === 'loaded')));
        if (font === 'proggy') assert.ok(await frame.evaluate(() => [...document.fonts].some(font => font.family === 'ProggyClean' && font.status === 'loaded')));
        for (const palette of ['day', 'night']) {
          if (await frame.locator('html').getAttribute('data-palette') !== palette) {
            await frame.getByRole('button', { name: 'Toggle night palette' }).click();
          }
          assert.equal(await frame.locator('html').getAttribute('data-palette'), palette);
          assert.equal(await frame.getByRole('button', { name: 'Toggle night palette' }).getAttribute('aria-pressed'), String(palette === 'night'));
          assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${font}/${palette} frame overflow`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'outer review overflow');
          assert.equal(await frame.locator('.hero-art img').getAttribute('src'), originalImage);
          await page.screenshot({ path: path.join(output, `${palette}-${width}-${font}.png`), fullPage: true });
        }
        await frame.locator('nav a[href="#art"]').focus();
        await page.keyboard.press('Enter');
        await frame.waitForFunction(() => document.querySelector('nav a[href="#art"]').getAttribute('aria-current') === 'location');
        await frame.locator('.wordmark').first().click();
      }
      await page.locator('#width').focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#width').value === '390');
      assert.ok(await frame.evaluate(() => innerWidth <= 390));
      assert.deepEqual(errors, []);
      assert.deepEqual(audio, []);
      // Review choice is not saved into the product page.
      const product = await context.newPage();
      await product.goto('http://127.0.0.1:4173/');
      assert.ok((await product.locator('.hero h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Share Tech Mono'));
      assert.equal(await product.locator('#context-font-review').count(), 0);
      console.log(`PASS ${width}px: five fonts, both palettes, keyboard art navigation/width, no audio/errors, product unchanged`);
      await context.close();
    }
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/review/type-in-context.html');
    assert.equal(await page.locator('#font').isDisabled(), true);
    assert.ok(await page.locator('noscript').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(page.frames().some(frame => frame.url().endsWith('/index.html')));
    console.log('PASS 320px no-JavaScript fallback');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
