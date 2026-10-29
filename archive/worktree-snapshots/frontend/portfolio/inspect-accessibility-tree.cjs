// Chrome's platform accessibility tree; no actual screen reader is exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const property = (node, name) => node.properties?.find(item => item.name === name)?.value.value;
const named = (nodes, role, name) => nodes.find(node => node.role === role && node.name.trim() === name);

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-39');
  await fs.mkdir(output, { recursive: true });
  const report = [];
  try {
    for (const width of [320, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto('http://127.0.0.1:4173/');
      const client = await page.context().newCDPSession(page);
      const states = [];
      const snapshot = async state => {
        const tree = await client.send('Accessibility.getFullAXTree');
        const nodes = tree.nodes.filter(node => !node.ignored).map(node => ({
          role: node.role?.value, name: node.name?.value || '',
          description: node.description?.value, properties: node.properties,
        }));
        states.push({ state, nodes });
        return nodes;
      };
      let nodes = await snapshot('initial');
      const h1s = nodes.filter(node => node.role === 'heading' && property(node, 'level') === 1);
      assert.deepEqual(h1s.map(node => node.name), ['Banderov.com']);
      assert.ok(named(nodes, 'link', 'Banderov.com, home'));
      assert.equal(property(named(nodes, 'button', 'Toggle night palette: Day / Night'), 'pressed'), 'false');
      assert.ok(named(nodes, 'navigation', 'Main navigation'));
      for (const name of ['Made to be played.', 'Characters come first.', 'A world has its own sound.', 'Alternate 1404: Crusaders']) {
        assert.ok(named(nodes, 'region', name));
        assert.equal(property(named(nodes, 'heading', name), 'level'), 2);
      }
      for (const name of ['Play Don Bass Idols title theme', 'Play Cognition from Don Bass Idols']) assert.ok(named(nodes, 'Audio', name));
      for (const [caption, link] of [
        ['Maria, in full', 'View full Maria illustration'],
        ['Character sketch', 'View full original character sketch'],
        ['A character, every angle', 'View full Crusaders character rotation study'],
      ]) {
        assert.ok(named(nodes, 'StaticText', caption), 'Gallery title must remain exposed');
        assert.ok(named(nodes, 'link', link), 'Original artwork entry must remain named');
      }
      for (const name of ['Alternate 1404', 'Project Ovi', 'Don Bass Crusaders']) {
        assert.equal(property(named(nodes, 'heading', name), 'level'), 4);
      }
      const sourceText = nodes.filter(node => node.role === 'StaticText').map(node => node.name);
      assert.ok(sourceText.some(text => text.includes('My work-in-progress novel is a separate creative project')));
      assert.ok(sourceText.some(text => text.includes('Its canon remains its own')));
      assert.ok(sourceText.some(text => text.includes('does not rewrite either project’s canon')));
      assert.equal(property(named(nodes, 'tab', 'Don Bass Idols'), 'selected'), true);
      assert.equal(property(named(nodes, 'tab', 'Don Bass Crusaders'), 'selected'), false);
      assert.ok(named(nodes, 'group', 'Don Bass Idols image selection'));
      assert.equal(property(named(nodes, 'button', 'Cover art'), 'pressed'), 'true');
      assert.equal(property(named(nodes, 'button', 'Game screenshot'), 'pressed'), 'false');
      await page.getByRole('button', { name: 'Game screenshot', exact: true }).press('Enter');
      await page.waitForFunction(() => !document.querySelector('[data-image=screen]').disabled && document.querySelector('[data-image=screen]').getAttribute('aria-pressed') === 'true');
      nodes = await snapshot('Idols screenshot selected');
      assert.equal(property(named(nodes, 'button', 'Game screenshot'), 'pressed'), 'true');
      assert.equal(property(named(nodes, 'button', 'Cover art'), 'pressed'), 'false');
      await page.getByRole('button', { name: 'Cover art', exact: true }).press('Enter');
      await page.waitForFunction(() => !document.querySelector('[data-image=cover]').disabled);
      await page.getByRole('tab', { name: 'Don Bass Idols', exact: false }).focus();
      await page.keyboard.press('ArrowRight');
      nodes = await snapshot('Crusaders selected');
      assert.equal(property(named(nodes, 'tab', 'Don Bass Crusaders'), 'selected'), true);
      assert.equal(property(named(nodes, 'tab', 'Don Bass Idols'), 'selected'), false);
      assert.equal(nodes.filter(node => node.role === 'tabpanel').length, 1);
      assert.ok(named(nodes, 'tabpanel', 'Don Bass Crusaders'));
      assert.ok(!named(nodes, 'group', 'Don Bass Idols image selection'));
      await page.getByRole('button', { name: 'Toggle night palette' }).click();
      nodes = await snapshot('Night palette');
      assert.equal(property(named(nodes, 'button', 'Toggle night palette: Day / Night'), 'pressed'), 'true');
      await page.locator('.art-link').first().focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.querySelector('.detail-toggle').disabled);
      nodes = await snapshot('Maria Fit dialog');
      assert.equal(property(named(nodes, 'dialog', 'Maria, in full'), 'modal'), true);
      assert.ok(!nodes.some(node => ['main', 'navigation'].includes(node.role)));
      for (const name of ['Close artwork viewer', 'Inspect details', 'Previous artwork', 'Next artwork']) assert.ok(named(nodes, 'button', name));
      assert.ok(named(nodes, 'link', 'Open original file'));
      assert.equal(named(nodes, 'region', 'Artwork image').description, 'Fit view shows the whole image.');
      assert.ok(nodes.some(node => node.role === 'status' && property(node, 'live') === 'polite' && property(node, 'atomic') === true));
      await page.locator('.detail-toggle').click();
      nodes = await snapshot('Maria Details dialog');
      assert.equal(property(named(nodes, 'button', 'Fit whole image'), 'pressed'), 'true');
      assert.ok(named(nodes, 'region', 'Artwork image').description.includes('use arrow keys'));
      await page.locator('.art-next').click();
      await page.waitForFunction(() => !document.querySelector('.detail-toggle').disabled);
      nodes = await snapshot('Sketch Fit dialog');
      assert.ok(named(nodes, 'dialog', 'Character sketch'));
      assert.equal(property(named(nodes, 'button', 'Inspect details'), 'pressed'), 'false');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.art-dialog').open);
      nodes = await snapshot('closed dialog');
      assert.ok(!nodes.some(node => node.role === 'dialog'));
      assert.ok(named(nodes, 'navigation', 'Main navigation'));
      assert.equal(property(named(nodes, 'link', 'View full Maria illustration'), 'focused'), true);
      report.push({ width, states });
      console.log(`PASS ${width}: headings, landmarks, gallery names, distinct fiction projects, named audio, tab/palette states, modal isolation, Details descriptions, focus return`);
      await page.close();
    }
    await fs.writeFile(path.join(output, 'accessibility-tree.json'), JSON.stringify({
      scope: 'Exposed Chrome AX nodes at two viewport widths across seven states. No screen reader, speech output, live-announcement timing, native audio internal controls, other engines or exhaustive accessibility certification.',
      report,
    }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
