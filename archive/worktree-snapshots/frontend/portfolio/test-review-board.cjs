// Inspectable local comparison board; no product source mutation.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-52');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, javaScriptEnabled: false });
      await page.goto('http://127.0.0.1:4173/review/index.html');
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode(); }));
      });
      assert.equal(await page.locator('img').count(), 16);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(await page.evaluate(() => [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/["']/g, '')).sort()), ['Share Tech Mono', 'Silkscreen']);
      await page.screenshot({ path: path.join(output, `${width}-board.png`) });
      for (const href of ['#opening', '#games', '#gallery', '#sound', '#fiction', '#mobile', '#ending']) {
        await page.locator(`nav a[href="${href}"]`).press('Enter');
        assert.equal(new URL(page.url()).hash, href);
        assert.ok(await page.locator(href).isVisible());
      }
      for (const href of await page.locator('a').evaluateAll(links => [...new Set(links.map(link => link.getAttribute('href')))].filter(href => !href.startsWith('#')))) {
        assert.equal((await page.request.get(new URL(href, page.url()).href)).status(), 200);
      }
      await page.evaluate(() => {
        const originals = [...document.querySelectorAll('body *')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
        originals.forEach(([el, size]) => { el.style.fontSize = `${size * 2}px`; });
        scrollTo(0, 0);
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `${width}-enlarged.png`) });
      console.log(`PASS ${width}: no-JS, two fonts, 16 decoded images, local links, keyboard anchors, normal/enlarged no overflow`);
      await page.close();
    }
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 900 }, forcedColors: 'active', colorScheme: scheme });
      await page.goto('http://127.0.0.1:4173/review/index.html');
      await page.locator('nav a[href="#games"]').focus();
      assert.equal(await page.locator('nav').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
      assert.equal(await page.locator('nav a[href="#games"]').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `forced-${scheme}.png`) });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
    await page.route('**/*.ttf', route => route.abort());
    await page.goto('http://127.0.0.1:4173/review/index.html');
    assert.ok(await page.locator('h1').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.close();
    console.log('PASS forced-color light/dark focus and failed-font fallback');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
