const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const c=await b.newContext({viewport:{width:320,height:568}}),p=await c.newPage();await p.addInitScript(()=>window.__noBoot=true);
 await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);await p.addStyleTag({content:'*{animation:none!important;transition:none!important}'});
 const result=await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);showPanel(true);
  const pickLongest=pool=>Object.entries(pool).map(([tag,ts])=>({tag,text:ts.slice().sort((a,b)=>b.length-a.length)[0]}));
  const starts=pickLongest(OPENERS),ends=pickLongest(CLOSERS),failures=[];let count=0,worst=null;
  for(const girl of GIRLS)for(const line of girl.lines){const [text,tag]=line[1].slice().sort((a,b)=>b[0].length-a[0].length)[0];for(const a of starts)for(const z of ends){const parts=[a,{text,tag},z];paintSentence(parts);count++;const box=UI.say.getBoundingClientRect(),words=[...UI.say.children].map(e=>e.getBoundingClientRect());if(words.some(r=>r.top<box.top-1||r.bottom>box.bottom+1||r.left<box.left-1||r.right>box.right+1)){const item={parts,box:box.toJSON(),words:words.map(r=>r.toJSON())};failures.push(item);if(!worst||words.at(-1).bottom>worst.words.at(-1).bottom)worst=item;}}}
  if(worst)paintSentence(worst.parts);return {count,failures:failures.length,worst};});
 console.log({count:result.count,failures:result.failures,worst:result.worst?.parts});require('node:fs').writeFileSync(path.join(__dirname,'review','sentence-layout.json'),JSON.stringify(result,null,2));await p.screenshot({path:path.join(__dirname,'review','sentence-layout-320.png')});await c.close();
 assert.equal(result.failures,0);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
