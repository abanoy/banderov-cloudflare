// Target-spacing and keyboard review in existing Chrome; not an accessibility certification.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PORTFOLIO_CHROME || path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
  const results = [];
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
      const targets = await page.locator('.screenshot-link,.audio-fallback,.text-link,.footer-links a,.visual-controls button').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent.trim(), width: rect.width, height: rect.height };
      }));
      const stops = [];
      for (let step = 0; step < 36; step++) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(() => {
          const element = document.activeElement;
          const rect = element.getBoundingClientRect();
          const header = document.querySelector('.header');
          const headerRect = header.getBoundingClientRect();
          const sticky = getComputedStyle(header).position === 'sticky';
          return { tag: element.tagName, text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 100),
            visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
            covered: sticky && !header.contains(element) && !element.classList.contains('skip-link') && rect.bottom <= headerRect.bottom };
        });
        if (stop.tag === 'BODY') break;
        stops.push(stop);
      }
      await page.getByRole('link', { name: 'View full Maria illustration', exact: true }).click();
      const originalTarget = await page.locator('.dialog-original').boundingBox();
      targets.push({ text: 'Artwork viewer original file', width: originalTarget.width, height: originalTarget.height });
      await page.keyboard.press('Escape');
      results.push({ width, targets, stops });
      await page.close();
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(__dirname, 'review', 'interaction-inventory.json'), JSON.stringify(results, null, 2) + '\n');
  for (const result of results) {
    const minimum = result.width <= 620 ? 44 : 24;
    const small = result.targets.filter(target => target.height < minimum - .1 || target.width < 24);
    const obscured = result.stops.filter(stop => !stop.visible || stop.covered);
    console.log(JSON.stringify({ width: result.width, minimum, small, obscured, keyboard_stops: result.stops.length }));
    assert(small.length === 0, `${result.width}: small standalone targets`);
    assert(obscured.length === 0, `${result.width}: obscured keyboard focus`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
