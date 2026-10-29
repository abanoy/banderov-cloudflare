// Review captures only. Native header hiding applies to disposable capture pages.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-40');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [320, 1280]) for (const palette of ['day', 'night']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.addInitScript(value => localStorage.setItem('banderov-portfolio.palette', value), palette);
      await page.goto('http://127.0.0.1:4173/');
      await page.evaluate(async () => {
        await document.fonts.ready;
        const images = [...document.querySelectorAll('#games img')];
        images.forEach(image => { image.loading = 'eager'; });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        for (const image of images) {
          image.loading = 'eager';
          await image.decode();
        }
        await document.fonts.ready;
      });
      for (const project of ['idols', 'crusaders']) {
        await page.locator(`#tab-${project}`).click();
        await page.evaluate(() => document.activeElement.blur());
        const captureStyle = await page.addStyleTag({ content: '.header,.header *,.skip-link{visibility:hidden!important}' });
        await page.locator('#games').screenshot({ path: path.join(output, `${palette}-${width}-${project}-games.png`) });
        await captureStyle.evaluate(element => element.remove());
      }
      await page.close();
    }
    console.log(`Game captures saved: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
