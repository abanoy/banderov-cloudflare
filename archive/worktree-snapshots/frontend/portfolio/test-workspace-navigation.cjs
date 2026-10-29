// Regression checks for native navigation when artwork and music share a row.
// Loopback preview only; no Worker, game, account, or production changes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-143');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PORTFOLIO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const results = [];
  try {
    for (const width of [390, 1400]) for (const palette of ['day', 'night']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      try {
        await context.addInitScript(value => localStorage.setItem('banderov-portfolio.palette', value), palette);
        const page = await context.newPage();
        const errors = [], audioRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
          if (/\.(mp3|ogg)(\?|$)/.test(request.url())) audioRequests.push(request.url());
        });
        await page.goto('http://127.0.0.1:4173/review/workspace.html');
        const status = mode => mode === 'current' ? 'Current portfolio. Review only.' : 'Compact desktop experiment. Review only.';
        await page.waitForFunction(text => document.querySelector('#status').textContent === text, status('workspace'));
        const frame = page.frames().find(item => item !== page.mainFrame());
        const current = hash => frame.waitForFunction(value => document.querySelector('.header nav [aria-current]')?.getAttribute('href') === value, hash);
        const visit = async hash => {
          await frame.locator('.header nav a[href="' + hash + '"]').press('Enter');
          await current(hash);
          assert.equal(await frame.evaluate(() => location.hash), hash);
        };
        for (const mode of ['workspace', 'current', 'workspace']) {
          await page.locator('#direction').selectOption(mode);
          await page.waitForFunction(text => document.querySelector('#status').textContent === text, status(mode));
          for (const hash of ['#art', '#music', '#art']) await visit(hash);
          if (width === 1400 && mode === 'workspace') {
            // Focus can move to the adjacent window without rewriting the URL.
            await frame.locator('audio').first().focus();
            await current('#music');
            assert.equal(await frame.evaluate(() => location.hash), '#art');
            await visit('#art');
          }
          assert(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await visit('#music');
        await frame.evaluate(() => history.back());
        await frame.waitForFunction(() => location.hash === '#art');
        await current('#art');
        await frame.evaluate(() => history.forward());
        await frame.waitForFunction(() => location.hash === '#music');
        await current('#music');
        await frame.evaluate(() => { document.activeElement.blur(); document.querySelector('#stories').scrollIntoView({ block: 'start' }); });
        await current('#stories');
        assert.equal(await frame.evaluate(() => location.hash), '#music');
        assert.deepEqual(errors, []);
        assert.deepEqual(audioRequests, []);
        results.push({ width, palette, nativeAnchors: true, layoutReselection: true, focusRow: width === 1400, nativeHistory: true, scrollPreservesHash: true, errors, audioRequests });
        console.log('PASS ' + width + ' ' + palette);
      } finally { await context.close(); }
    }
    await fs.writeFile(path.join(output, 'workspace-navigation-regression.json'), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
