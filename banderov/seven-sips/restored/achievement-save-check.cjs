const { chromium } = require(process.env.SEVEN_PLAYWRIGHT || 'playwright');
const path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SEVEN_BROWSER });
  try {
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => window.__noBoot = true);
    await page.goto('file:///' + path.resolve(__dirname, 'index.html').replaceAll('\\', '/'));
    await page.waitForFunction(() => UI.snd);
    const result = await page.evaluate(() => {
      Sound.setMusic(false); Sound.setSfx(false);
      const unknown = Object.fromEntries(Array.from({length: 8}, (_, i) => ['futureSecret' + i, 1]));
      const keys = GIRLS.map(g => g.key), ends = ALL_ENDINGS();
      const migrated = cleanSave({v: 1, secrets: {...unknown}, endings: {'win:future': 1}});
      const falseKnown = cleanSave({v: 1, secrets: {[keys[0]]: 0}, endings: {[ends[0]]: 0}});
      const valid = cleanSave({v: 1, secrets: Object.fromEntries(keys.map(k => [k, 1])),
        endings: Object.fromEntries(ends.map(k => [k, 1])), stickers: {smooth: 1, futureSticker: 1}});
      const recorded = [];
      for (const count of [0, 1, keys.length]) {
        SAVE = {v: 2, secrets: {...unknown, ...Object.fromEntries(keys.slice(0, count).map(k => [k, 1]))}};
        newRun(); record('lonely');
        recorded.push({count, stickers: {...SAVE.stickers}, unknownRetained: SAVE.secrets.futureSecret7,
          plays: SAVE.plays, ending: SAVE.endings.lonely});
      }
      return {migrated, falseKnown, valid, recorded};
    });
    const baseline = process.env.SEVEN_EXPECT_BASELINE === '1';
    assert.deepEqual(Object.keys(result.migrated.stickers || {}).sort(), baseline ? ['date','first','mind','secret'] : []);
    assert.equal(result.migrated.endings['win:future'], 1);
    assert.equal(result.migrated.secrets.futureSecret7, 1);
    assert.deepEqual(Object.keys(result.falseKnown.stickers || {}).sort(), baseline ? ['date','first','secret'] : []);
    for (const id of ['first','date','hares','stone','secret','mind','all','smooth','futureSticker']) assert.equal(result.valid.stickers[id], 1);
    for (const r of result.recorded) {
      const expected = ['first'];
      if (baseline || r.count >= 1) expected.push('secret');
      if (baseline || r.count === 8) expected.push('mind');
      assert.deepEqual(Object.keys(r.stickers).sort(), expected.sort());
      assert.equal(r.unknownRetained, 1); assert.equal(r.plays, 1); assert.equal(r.ending, 1);
    }
    assert.deepEqual(errors, []);
    console.log(baseline ? 'Baseline reproduced unknown/falsy collection achievement awards.' : 'Recognized achievement migration/record checks passed; valid and future data retained.');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
