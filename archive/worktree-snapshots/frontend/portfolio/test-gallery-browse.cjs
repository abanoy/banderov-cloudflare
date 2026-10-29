const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, 'review/pass-32');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 390, 1280]) for (const palette of ['day', 'night']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto('http://127.0.0.1:4173/');
      await page.evaluate(palette => document.documentElement.dataset.palette = palette, palette);
      const links = page.locator('.art-link');
      const sources = await links.evaluateAll(links => links.map(link => ({ href: link.href, alt: link.querySelector('img').alt })));
      await links.first().focus();
      await page.keyboard.press('Enter');
      const expectArtwork = async index => {
        await page.waitForFunction(() => !document.querySelector('.dialog-image').hidden && document.querySelector('.dialog-image').naturalWidth > 0);
        assert.equal(await page.locator('.dialog-original').getAttribute('href'), sources[index].href);
        assert.equal(await page.locator('.dialog-image').getAttribute('alt'), sources[index].alt);
        assert.ok((await page.locator('.art-position').textContent()).startsWith(`${index + 1} of 3`));
        assert.equal(await page.locator('.detail-toggle').getAttribute('aria-pressed'), 'false');
        assert.ok(await page.locator('.art-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
      };
      await expectArtwork(0);
      await page.locator('.detail-toggle').click();
      await page.locator('.art-next').focus();
      for (const index of [1, 2, 0]) {
        await page.keyboard.press('Enter');
        await expectArtwork(index);
        assert.equal(await page.evaluate(() => document.activeElement.className), 'art-next');
      }
      await page.locator('.art-previous').focus();
      await page.keyboard.press('Enter');
      await expectArtwork(2);
      await page.locator('.art-dialog').screenshot({ path: path.join(output, `${palette}-${width}-viewer.png`) });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.art-dialog').open);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'View full Maria illustration');
      await links.nth(1).click();
      await expectArtwork(1);
      // Switching away from a failed file must recover without closing the viewer.
      await page.route('**/assets/crusaders-turns.webp', route => route.abort());
      await page.locator('.art-next').click();
      await page.waitForFunction(() => document.querySelector('.image-status').textContent.includes('could not load'));
      assert.equal(await page.locator('.detail-toggle').isDisabled(), true);
      assert.equal(await page.locator('.dialog-original').getAttribute('href'), sources[2].href);
      await page.locator('.art-next').click();
      await expectArtwork(0);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.art-dialog').open);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'View full original character sketch');
      console.log(`PASS ${width}/${palette}: keyboard cycle/wrap, Fit reset, correct originals/captions, failure recovery, opener focus`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
