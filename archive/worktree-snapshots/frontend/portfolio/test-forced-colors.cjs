// Browser forced-color emulation, not a Windows theme or screen-reader audit.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PORTFOLIO_CHROME || path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
  try {
    const review = path.join(__dirname, 'review', 'pass-08');
    await fs.mkdir(review, { recursive: true });
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, forcedColors: 'active', colorScheme: scheme });
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(review, `forced-${scheme}-intro.png`) });
      await page.getByRole('link', { name: 'Games', exact: true }).click();
      const first = page.getByRole('tab', { name: 'Don Bass Idols', exact: false });
      const second = page.getByRole('tab', { name: 'Don Bass Crusaders', exact: false });
      await first.focus();
      await first.press('ArrowRight');
      await second.press('ArrowLeft');
      await page.screenshot({ path: path.join(review, `forced-${scheme}-tabs.png`) });
      const cue = await first.evaluate(tab => {
        const selected = getComputedStyle(tab);
        const other = getComputedStyle(document.querySelector('[role=tab][aria-selected=false]'));
        const surface = node => {
          while (node) {
            const color = getComputedStyle(node).backgroundColor;
            if (!color.startsWith('rgba') || !color.endsWith(', 0)')) return color;
            node = node.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        };
        return { selected: surface(tab), other: surface(document.querySelector('[role=tab][aria-selected=false]')), border: selected.borderBottomWidth, otherBorder: other.borderBottomWidth, outline: selected.outlineWidth, outlineStyle: selected.outlineStyle };
      });
      console.log(JSON.stringify({ scheme, ...cue }));
      assert.ok(cue.selected !== cue.other || cue.border !== cue.otherBorder, 'Selected tab needs a visible forced-color cue');
      assert.notEqual(cue.outline, '0px', 'Focused tab needs a visible outline');
      assert.notEqual(cue.outlineStyle, 'none', 'Focused outline must actually be rendered');
      await first.press('ArrowRight');
      assert.equal(await second.getAttribute('aria-selected'), 'true');
      await page.getByRole('link', { name: 'View full Maria illustration', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.dialog-image').naturalWidth > 0 && !document.querySelector('.dialog-image').hidden);
      assert.equal(await page.locator('#art-stage').evaluate(stage => getComputedStyle(stage).backgroundColor), 'rgb(255, 255, 255)', 'Original transparent art retains a white mount');
      await page.screenshot({ path: path.join(review, `forced-${scheme}-artwork.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').isVisible(), false);
      console.log(`PASS ${scheme}: selection, focus, keyboard switching, original artwork and dismissal`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
