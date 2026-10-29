// Text-resize stress simulation, not a claim about a specific browser zoom setting.
// Every element receives twice its original computed font size, avoiding inheritance
// compounding. Uses installed Chrome and existing Playwright; no production access.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PORTFOLIO_CHROME || path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') });
  try {
    const review = path.join(__dirname, 'review', process.argv[2] || 'pass-07');
    await fs.mkdir(review, { recursive: true });
    for (const width of [320, 768, 1280]) for (const project of ['idols', 'crusaders']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
      await page.locator('#tab-' + project).press('Enter');
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll('body, body *')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
        for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
      });
      await page.screenshot({ path: path.join(review, `${project}-text-200-${width}.png`), fullPage: true });
      await page.screenshot({ path: path.join(review, `${project}-text-200-${width}-intro.png`) });
      const result = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        outside: [...document.querySelectorAll('body *')].filter(node => node.getClientRects().length && node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, class: node.className, text: node.textContent.trim().slice(0, 55), right: node.getBoundingClientRect().right })),
        overflow: [...document.querySelectorAll('h1,h2,h3,h4,p,nav,a,button')].filter(node => node.getClientRects().length && node.scrollWidth > node.clientWidth + 1).map(node => ({ tag: node.tagName, text: node.textContent.trim().slice(0, 75), width: node.clientWidth, content: node.scrollWidth })),
      }));
      console.log(JSON.stringify({ viewport: width, project, ...result }));
      if (result.content > result.width || result.overflow.length) process.exitCode = 1;
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
