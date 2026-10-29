// Controlled review-font failure/delay, not measured network timing.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-48');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 1280]) for (const [choice, file] of [['proggy', 'proggy-ProggyClean.ttf'], ['pixel', 'silkscreen-Silkscreen-Regular.ttf']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [], audio = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/\.(mp3|ogg)(?:\?|$)/.test(request.url())) audio.push(request.url()); });
      await page.route(`**/${file}`, route => route.abort());
      await page.goto('http://127.0.0.1:4173/review/type-in-context.html');
      await page.waitForFunction(() => !document.querySelector('#font').disabled);
      const frame = page.frames().find(frame => frame.url().endsWith('/index.html'));
      const original = await frame.locator('.hero-art img').getAttribute('src');
      await page.locator('#font').selectOption(choice);
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Font unavailable; showing fallback lettering.'));
      assert.ok(await frame.locator('.hero h1').isVisible());
      assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `${choice}-${width}-failed.png`), fullPage: true });
      await page.locator('#font').selectOption('system');
      await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Arial'));
      assert.ok(!(await page.locator('#status').textContent()).includes('unavailable'));
      assert.ok((await frame.locator('.hero h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Arial'));
      assert.equal(await frame.locator('.hero-art img').getAttribute('src'), original);
      await frame.locator('nav a[href="#art"]').press('Enter');
      await frame.waitForFunction(() => document.querySelector('nav a[href="#art"]').getAttribute('aria-current') === 'location');
      assert.deepEqual(errors, []);
      assert.deepEqual(audio, []);
      console.log(`PASS ${width}/${choice}: failure disclosed, readable fallback, switch recovery, original art and keyboard navigation`);
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let finish;
    const delivered = new Promise(resolve => { finish = resolve; });
    await page.route('**/proggy-ProggyClean.ttf', async route => { await gate; await route.continue(); finish(); });
    try {
      await page.goto('http://127.0.0.1:4173/review/type-in-context.html');
      await page.waitForFunction(() => !document.querySelector('#font').disabled);
      await page.locator('#font').selectOption('proggy');
      await page.waitForFunction(() => document.querySelector('#status').textContent === 'Loading the selected font…');
      await page.locator('#font').selectOption('system');
      release();
      await delivered;
      await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Arial'));
      const frame = page.frames().find(frame => frame.url().endsWith('/index.html'));
      await frame.evaluate(() => document.fonts.ready);
      assert.ok((await page.locator('#status').textContent()).startsWith('Arial'));
      assert.equal(await page.locator('#font').inputValue(), 'system');
      await page.screenshot({ path: path.join(output, '390-latest-choice.png'), fullPage: true });
      console.log('PASS delayed Proggy: loading disclosed and latest Arial choice retained after delivery');
    } finally { release(); await page.close(); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
