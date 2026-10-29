// Controlled artwork loading/failure and enlarged-text layout; not a real outage.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-103');
  await fs.mkdir(output, { recursive: true });
  const rows = [];
  try {
    for (const width of [320, 390, 1280]) for (const palette of ['day', 'night']) for (const doubled of [false, true]) for (const mode of ['loading', 'failure']) {
      const page = await browser.newPage({ viewport: { width, height: width === 320 ? 740 : 900 } });
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await page.route('**/assets/archive-art-1.webp', async route => {
        if (mode === 'loading') { await held; await route.continue(); }
        else await route.abort();
      });
      try {
        await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(({ palette, doubled }) => {
          document.documentElement.dataset.palette = palette;
          if (doubled) {
            const pairs = [...document.querySelectorAll('body *')].map(e => [e, parseFloat(getComputedStyle(e).fontSize)]);
            pairs.forEach(([e, n]) => e.style.setProperty('font-size', n * 2 + 'px', 'important'));
          }
        }, { palette, doubled });
        const opener = page.getByRole('link', { name: 'View full original character sketch', exact: true });
        await opener.press('Enter');
        await page.locator('.image-status').filter({ hasText: mode === 'failure' ? 'Artwork could not load' : 'Loading' }).waitFor();
        const state = await page.locator('.image-status').evaluate(e => {
          const range = document.createRange(); range.selectNodeContents(e);
          const t = range.getBoundingClientRect(), s = e.parentElement.getBoundingClientRect();
          const caption = document.querySelector('.dialog-caption').getBoundingClientRect();
          return { text: e.textContent, textTop: t.top, textBottom: t.bottom, surfaceTop: s.top, surfaceBottom: s.bottom, captionTop: caption.top, client: e.clientWidth, scroll: e.scrollWidth, documentWidth: document.documentElement.scrollWidth };
        });
        assert.equal(state.documentWidth, width);
        assert.ok(state.scroll <= state.client + 1);
        assert.ok(state.textTop >= state.surfaceTop - 1 && state.textBottom <= state.surfaceBottom + 1, JSON.stringify(state));
        assert.ok(state.captionTop >= state.surfaceBottom - 1);
        const browseWords = await page.locator('.art-browse').evaluate(g => [...g.querySelectorAll('button')].flatMap(e => {
          const n = e.firstChild;
          return [...n.textContent.matchAll(/\S+/g)].map(m => {
            const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
            return { word: m[0], rectangles: r.getClientRects().length };
          });
        }));
        for (const word of browseWords) assert.equal(word.rectangles, 1, word.word);
        if (!doubled && width === 1280) {
          const labelLines = await page.locator('.art-browse').evaluate(g => [...g.querySelectorAll('button')].map(e => {
            const r = document.createRange(); r.selectNodeContents(e); return r.getClientRects().length;
          }));
          assert.deepEqual(labelLines, [1, 1], 'Normal desktop labels retain their natural width');
        }
        assert(await page.locator('.detail-toggle').isDisabled());
        const original = page.locator('.dialog-original');
        assert((await original.getAttribute('href')).endsWith('archive-art-1.png'));
        await original.focus();
        const fallbackVisible = await original.evaluate(e => {
          const r = e.getBoundingClientRect(), d = e.closest('dialog').getBoundingClientRect();
          return r.top >= d.top && r.bottom <= d.bottom + 1;
        });
        assert(fallbackVisible, 'Original-file fallback is reachable through focus scrolling');
        await page.screenshot({ path: path.join(output, `${palette}-${width}-${doubled ? 'double' : 'normal'}-${mode}.png`) });
        if (mode === 'loading') {
          release();
          await page.waitForFunction(() => document.querySelector('#art-stage').getAttribute('aria-busy') === 'false' && !document.querySelector('.dialog-image').hidden);
          assert(!await page.locator('.image-status').isVisible());
        }
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.activeElement === document.querySelectorAll('.art-link')[1]);
        rows.push({ width, palette, doubled, mode, state, browseWords, fallbackVisible, loadedRecovery: mode === 'loading' });
      } finally { release(); await page.close(); }
    }
    await fs.writeFile(path.join(output, 'viewer-status.json'), JSON.stringify(rows, null, 2));
    console.log('24 viewer loading/failure/text-layout/fallback/Escape cases passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
