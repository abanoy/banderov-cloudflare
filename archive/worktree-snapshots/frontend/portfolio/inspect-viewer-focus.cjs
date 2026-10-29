// Installed Chrome keyboard traversal; this is not a screen-reader audit.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, process.argv[2] || 'review/pass-34');
  await fs.mkdir(output, { recursive: true });
  const results = [];
  try {
    for (const [width, height] of [[320, 740], [390, 844], [844, 390], [1280, 900]]) {
      for (const palette of ['day', 'night']) {
        const page = await browser.newPage({ viewport: { width, height } });
        await page.goto('http://127.0.0.1:4173/');
        await page.evaluate(p => document.documentElement.dataset.palette = p, palette);
        await page.locator('.art-link').first().focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => !document.querySelector('.detail-toggle').disabled);
        await page.evaluate(() => document.fonts.ready);
        const stops = [];
        let browserChromeStops = 0;
        let nativeDialogStops = 0;
        const advance = async key => {
          await page.keyboard.press(key);
          if (!await page.evaluate(() => document.hasFocus())) {
            assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');
            browserChromeStops++;
            await page.keyboard.press(key);
          }
          if (await page.evaluate(() => document.activeElement === document.querySelector('.art-dialog'))) {
            nativeDialogStops++;
            await page.keyboard.press(key);
            if (!await page.evaluate(() => document.hasFocus())) {
              browserChromeStops++;
              await page.keyboard.press(key);
            }
          }
        };
        const inspect = async () => {
          const stop = await page.evaluate(() => {
            const el = document.activeElement;
            const box = el.getBoundingClientRect();
            const dialog = document.querySelector('.art-dialog');
            const shell = dialog.getBoundingClientRect();
            const style = getComputedStyle(el);
            return {
              name: el.className, inside: dialog.contains(el),
              visible: box.right > 0 && box.left < innerWidth && box.bottom > Math.max(0, shell.top) && box.top < Math.min(innerHeight, shell.bottom),
              textFullyVisible: el.classList.contains('dialog-stage') || (box.top >= Math.max(0, shell.top) && box.bottom <= Math.min(innerHeight, shell.bottom)),
              outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
              top: box.top, bottom: box.bottom,
            };
          });
          assert.ok(stop.inside, `Focus escaped: ${JSON.stringify(stop)}`);
          assert.ok(stop.visible && stop.textFullyVisible, `Focus clipped: ${JSON.stringify(stop)}`);
          assert.ok(stop.outline, `No rendered outline: ${JSON.stringify(stop)}`);
          stops.push(stop);
          return stop.name.split(' ')[0];
        };
        assert.equal(await inspect(), 'dialog-close');
        for (const expected of ['detail-toggle', 'art-previous', 'art-next', 'dialog-stage', 'dialog-original', 'dialog-close']) {
          await advance('Tab');
          assert.equal(await inspect(), expected);
        }
        await advance('Shift+Tab');
        assert.equal(await inspect(), 'dialog-original');
        await advance('Tab');
        await advance('Tab');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.detail-toggle').getAttribute('aria-pressed'), 'true');
        for (const expected of ['art-previous', 'art-next', 'dialog-stage', 'dialog-original', 'dialog-close']) {
          await advance('Tab');
          assert.equal(await inspect(), expected);
        }
        await page.locator('.art-dialog').screenshot({ path: path.join(output, `${palette}-${width}-focus.png`) });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.art-dialog').open);
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'View full Maria illustration');
        results.push({ width, height, palette, browserChromeStops, nativeDialogStops, stops });
        console.log(`PASS ${width}x${height}/${palette}: sequential Fit/Details focus, reverse wrap, Escape`);
        await page.close();
      }
    }
    await fs.writeFile(path.join(output, 'focus.json'), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
