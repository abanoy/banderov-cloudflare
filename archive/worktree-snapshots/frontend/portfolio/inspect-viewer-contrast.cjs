// Inspect rendered dialog text against sampled composed backgrounds.
// Disposable Chrome pages only; no source images or product state are modified.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const luminance = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const artwork = process.argv[3] || 'crusaders';
const artworkLabels = { maria: 'View full Maria illustration', sketch: 'View full original character sketch', crusaders: 'View full Crusaders character rotation study' };
if (!artworkLabels[artwork]) throw new Error('Artwork must be maria, sketch or crusaders');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.PORTFOLIO_CHROME || path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
 const results = [];
 try {
  for (const width of [390, 1280]) for (const palette of ['day', 'night']) for (const mode of ['fit', 'detail']) for (const position of ['top', 'bottom']) {
   const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
   await page.addInitScript(value => localStorage.setItem('banderov-portfolio.palette', value), palette);
   await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
   await page.evaluate(() => document.fonts.ready);
   await page.getByRole('link', { name: artworkLabels[artwork], exact: true }).click();
   await page.locator('.dialog-image').evaluate(image => image.decode());
   if (mode === 'detail') await page.getByRole('button', { name: 'Inspect details' }).click();
   await page.mouse.move(0, 0);
   await page.locator('.art-dialog').evaluate((dialog, position) => { dialog.scrollTop = position === 'bottom' ? dialog.scrollHeight : 0; }, position);
   const lines = await page.locator('.art-dialog').evaluate(dialog => {
    const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT), lines = [];
    const bounds = dialog.getBoundingClientRect();
    while (walker.nextNode()) {
     const node = walker.currentNode, element = node.parentElement, text = node.textContent.trim();
     if (!text || element.closest('[hidden],[aria-hidden=true]')) continue;
     const style = getComputedStyle(element);
     if (style.visibility !== 'visible' || style.display === 'none') continue;
     const range = document.createRange(); range.selectNodeContents(node);
     const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
     for (const rect of range.getClientRects()) {
      // Sample only text inside the dialog's visible viewport, not clipped lines.
      if (rect.width <= 2 || rect.height <= 2 || rect.top < Math.max(0, bounds.top) || rect.bottom > Math.min(innerHeight, bounds.bottom)) continue;
      lines.push({ text, element: element.className || element.tagName, color: style.color, threshold: large ? 3 : 4.5, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
     }
    }
    return lines;
   });
   if (!lines.length) throw Error('No visible dialog text sampled');
   await page.addStyleTag({ content: '.art-dialog,.art-dialog *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}' });
   const png = PNG.sync.read(await page.screenshot());
   const sampled = lines.map(line => {
    let minimum = Infinity;
    for (const fx of [.15, .5, .85]) for (const fy of [.3, .7]) {
     const x = Math.max(0, Math.min(png.width - 1, Math.round(line.rect.x + line.rect.width * fx)));
     const y = Math.max(0, Math.min(png.height - 1, Math.round(line.rect.y + line.rect.height * fy)));
     const pixel = (y * png.width + x) * 4;
     minimum = Math.min(minimum, contrast(rgb(line.color), [...png.data.subarray(pixel, pixel + 3)]));
    }
    return { ...line, minimum: +minimum.toFixed(2), passes: minimum >= line.threshold };
   });
   const failures = sampled.filter(line => !line.passes);
   results.push({ width, palette, mode, position, sampled_lines: sampled.length, failures, lines: sampled });
   console.log(JSON.stringify({ width, palette, mode, position, sampled_lines: sampled.length, failures: failures.map(({text,minimum,threshold}) => ({text,minimum,threshold})) }));
   await page.close();
  }
 } finally { await browser.close(); }
 const review = path.join(__dirname, 'review', process.argv[2] || 'pass-22'); await fs.mkdir(review, { recursive: true });
 await fs.writeFile(path.join(review, 'viewer-contrast-inventory.json'), JSON.stringify({ artwork, scope: 'Six composed background samples per fully visible dialog text line, fit/detail, top/bottom, day/night, 390/1280. Only the selected artwork caption/title. Excludes clipped text, image pixels, loading/failure messages, hover/focus states and exhaustive pixel coverage. Not accessibility certification.', results }, null, 2));
 if (results.some(result => result.failures.length)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
