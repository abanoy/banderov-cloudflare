// Scoped screenshot sampling of actual text backgrounds, not WCAG certification.
// Text is hidden only in a disposable capture page; source assets are untouched.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const luminance = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PORTFOLIO_CHROME || path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
  const results = [];
  const review = path.join(__dirname, 'review', process.argv[2] || 'pass-18');
  await fs.mkdir(review, { recursive: true });
  try {
    for (const width of [390, 1280]) for (const palette of ['day', 'night']) for (const project of ['idols', 'crusaders']) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      await page.addInitScript(value => localStorage.setItem('banderov-portfolio.palette', value), palette);
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
      if (process.argv[3]) {
        await page.addStyleTag({ url: new URL(process.argv[3], 'http://127.0.0.1:4173/').href });
        await page.evaluate(() => document.fonts.ready);
      }
      if (project === 'crusaders') {
        await page.getByRole('tab', { name: 'Don Bass Crusaders', exact: false }).click();
        await page.evaluate(() => scrollTo(0, 0));
      }
      await page.evaluate(async () => { await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })); });
      // A static header avoids full-page screenshot stitching over later text.
      await page.addStyleTag({ content: '.header{position:static!important}' });
      const lines = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const lines = [];
        while (walker.nextNode()) {
          const node = walker.currentNode, element = node.parentElement;
          const text = node.textContent.trim();
          if (!text || element.closest('script,style,[hidden],[aria-hidden=true],audio,dialog,.skip-link')) continue;
          const style = getComputedStyle(element);
          if (style.visibility !== 'visible' || style.display === 'none') continue;
          const range = document.createRange(); range.selectNodeContents(node);
          const fill = style.webkitTextFillColor;
          const gradients = fill === 'rgba(0, 0, 0, 0)' ? style.backgroundImage.match(/rgb\([^)]+\)/g) : null;
          const colors = gradients || [style.color];
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
          for (const rect of range.getClientRects()) if (rect.width > 2 && rect.height > 2) lines.push({ text, element: element.tagName.toLowerCase() + (element.className ? '.' + String(element.className).trim().replace(/\s+/g, '.') : ''), colors, threshold: large ? 3 : 4.5, rect: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height } });
        }
        return lines;
      });
      await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}.hero h1 span,.section-heading h2,.music-section h2{background:none!important}' });
      const buffer = await page.screenshot({ fullPage: true });
      const png = PNG.sync.read(buffer);
      const sampled = lines.map(line => {
        let minimum = Infinity;
        for (const fx of [.15, .5, .85]) for (const fy of [.3, .7]) {
          const x = Math.max(0, Math.min(png.width - 1, Math.round(line.rect.x + line.rect.width * fx)));
          const y = Math.max(0, Math.min(png.height - 1, Math.round(line.rect.y + line.rect.height * fy)));
          const pixel = (y * png.width + x) * 4;
          const background = [...png.data.subarray(pixel, pixel + 3)];
          for (const color of line.colors) minimum = Math.min(minimum, contrast(rgb(color), background));
        }
        return { ...line, minimum: +minimum.toFixed(2), passes: minimum >= line.threshold };
      });
      const failures = sampled.filter(line => !line.passes);
      results.push({ width, palette, project, sampled_lines: sampled.length, failures, lines: sampled });
      console.log(JSON.stringify({ width, palette, project, sampled_lines: sampled.length, failures: failures.map(({ text, element, minimum, threshold }) => ({ text, element, minimum, threshold })) }));
      await page.close();
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(review, 'contrast-inventory.json'), JSON.stringify({ reviewStylesheet: process.argv[3] || null, scope: 'Six background samples per visible text-line rectangle in both project states; gradient text compares every opaque stop, not every interpolated foreground pixel. Static header capture only. Excludes hidden/decorative text, native audio internals, artwork viewer, hover/focus states. Not exhaustive pixel coverage or certification.', results }, null, 2));
  if (results.some(result => result.failures.length)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
