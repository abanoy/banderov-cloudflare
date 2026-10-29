const fs = require('node:fs');
const p = 'portfolio/review/current-preview-index.json';
const before = fs.readFileSync(p);
const data = JSON.parse(before);
const backup = 'portfolio/review/reader-preview-index-before-address-fix.json';
if (fs.existsSync(backup)) throw Error('Backup already exists');
fs.writeFileSync(backup, before, {flag:'wx'});
data.currentReader = {
  url:'http://127.0.0.1:4228/stories/alternate-1404/#chapter-1',
  server:data.reviewDesk.server,
  guide:data.reviewDesk.guide,
  status:'Current local unpublished reading desk; older individual study URLs below are historical references, not the recommended entry point.',
  verified:new Date().toISOString(),
  evidence:'Owned server handle 82131 live; in-app browser tab 10 visibly loaded Chapter 1, page 3 of 88. This is availability evidence, not a new full regression test or future uptime guarantee.'
};
data.updated = new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(data,null,2)+'\r\n');
const after = JSON.parse(fs.readFileSync(p));
if (JSON.stringify(after.previews)!==JSON.stringify(JSON.parse(before).previews)) throw Error('Historical entries changed');
const stamp = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
const entry = '\r\n\r\n### Reading-preview address recovery — '+stamp+' EDT\r\n> OpenAI Codex, GPT-6-based Windows desktop assistant (exact suffix unavailable).\r\n\r\n- Owner reported the older4218 reading-desk link unreachable. Confirmed owned current4228 server82131 live, opened existing IAB tab10 at /stories/alternate-1404/#chapter-1, and observed Chapter1/Page3of88 in the actual accessibility tree; marked reader deliverable. Did not test whether old4218 is down, so no process-failure cause claimed.\r\n- Retained portfolio/review/current-preview-index.json now has explicit currentReader entry pointing to verified4228 reader and current server/guide, while preserving every historical study entry. Exact preimage saved reader-preview-index-before-address-fix.json; parsedJSON/history equality verified. No product/manuscript/assets/backend/public/routing/deployment changes. Prior goal turn yielded new reachability evidence; continuous goal active, aesthetic feedback pending. This check is availability only, not repeated browser regression or an uptime promise.\r\n';
for (const log of ['LLM.md']) {
  const latest = fs.readFileSync(log);
  fs.appendFileSync(log,entry);
  if(!fs.readFileSync(log).subarray(0,latest.length).equals(latest)) throw Error('History prefix changed');
}
console.log('Preview guide corrected; historical entries and log prefix preserved.');
