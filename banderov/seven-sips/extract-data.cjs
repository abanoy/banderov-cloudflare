// Extract only known declarative dialogue from the preserved archive; never boot it.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = __dirname;
const source = fs.readFileSync(path.join(base, 'reference/seven-sips-archive/src/all.js'), 'utf8');
const begin = source.indexOf('const TAGS =');
const girls = source.indexOf('const GIRLS =', begin);
const end = source.indexOf('\n];', girls) + 3;
if (begin < 0 || girls < 0 || end < girls) throw Error('Archive markers changed');
const ctx = {};
vm.runInNewContext(source.slice(begin, end) + '\nresult = {TAGS, OPENERS, CLOSERS, GIRLS};', ctx, {timeout:1000});
fs.writeFileSync(path.join(base, 'src/dialogue.js'), '// Derived from preserved Seven Sips archive.\n' +
  'globalThis.SevenDialogue = ' + JSON.stringify(ctx.result, null, 2) + ';\n');
