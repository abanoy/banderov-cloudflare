// Local visual review using the existing Chrome/Playwright setup.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PORTFOLIO_CHROME || path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
  try {
    const directory = path.join(__dirname, 'review', process.argv[2] || 'pass-09');
    await fs.mkdir(directory, { recursive: true });
    for (const { width, height } of [{ width: 1280, height: 900 }, { width: 390, height: 900 }, { width: 1920, height: 1080 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
      // Capture the artwork rather than a lazy image's reserved blank space.
      await page.evaluate(async () => {
        await document.fonts.ready;
        const images = [...document.querySelectorAll('main img')];
        images.forEach(image => { image.loading = 'eager'; });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.all(images.map(image => image.decode()));
      });
      for (const palette of ['day', 'night']) {
        if (palette === 'night') await page.getByRole('button', { name: 'Toggle night palette' }).click();
        await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: path.join(directory, `${palette}-${width}-page.png`), fullPage: true });
        await page.screenshot({ path: path.join(directory, `${palette}-${width}-intro.png`) });
        // Element captures scroll/stitch internally. Hide fixed chrome only in
        // these review images so it cannot obscure the section during stitching.
        const captureStyle = await page.addStyleTag({ content: '.header,.header *,.skip-link{visibility:hidden!important}' });
        for (const section of ['games', 'art', 'music', 'stories']) {
          await page.locator(`#${section}`).screenshot({ path: path.join(directory, `${palette}-${width}-${section}.png`) });
        }
        await captureStyle.evaluate(element => element.remove());
      }
      await page.close();
    }
    console.log(`Review captures saved: ${directory}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
