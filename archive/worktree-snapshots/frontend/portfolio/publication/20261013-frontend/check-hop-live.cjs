const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const packageRoot=path.resolve(process.argv[2]), manifest=JSON.parse(fs.readFileSync(path.join(packageRoot,'integration-manifest.json'))), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 for(const f of manifest.files){assert.equal(hash(fs.readFileSync(f.source)),f.sourceSha256);const bytes=fs.readFileSync(path.join(packageRoot,f.path));assert.equal(hash(bytes),f.sha256);if(f.path.startsWith('public/'))assert(bytes.length<=25*1024*1024)}
 const hopRoot=path.join(packageRoot,'public/games/hop-hop-helper');assert.equal(hash(Buffer.concat([fs.readFileSync(path.join(hopRoot,'index.wasm.part-1.bin')),fs.readFileSync(path.join(hopRoot,'index.wasm.part-2.bin'))])),hash(fs.readFileSync('portfolio/games/hop-hop-helper/original/index.wasm')));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--mute-audio','--enable-unsafe-swiftshader']});const rows=[];
 try{for(const width of [320,1280]){
  const context=await browser.newContext({viewport:{width,height:844}});const chunkUrls=[];context.on('response',r=>{if(r.url().includes('.part-'))chunkUrls.push({url:r.url(),status:r.status()})});await context.route('**/*',r=>new URL(r.request().url()).hostname==='banderov.com'?r.continue():r.abort());const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[],bad=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url())});page.on('request',r=>requests.push(r.url()));
  await page.goto('https://banderov.com/#hop-hop-helper',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);const card=page.locator('.hop-helper-card');
  assert.equal(await card.locator('img').evaluate(e=>e.naturalWidth),1920);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert(!requests.some(u=>u.includes('games/hop-hop-helper/index.')));
  await card.getByRole('link',{name:'View full Hop Hop Helper cover',exact:true}).press('Enter');await page.locator('.capture-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('.capture-stage img')?.naturalWidth===1920);await page.keyboard.press('Escape'); await page.waitForFunction(()=> !document.querySelector('.capture-dialog').open && document.activeElement?.getAttribute('aria-label') === 'View full Hop Hop Helper cover'); 
  if(width===1280)await card.screenshot({path:'portfolio/publication/20261013-frontend/hop-library-desktop.png'});
  const popupPromise=context.waitForEvent('page');await card.getByRole('link',{name:'Play Hop Hop Helper',exact:true}).press('Enter',{noWaitAfter:true});const game=await popupPromise;game.setDefaultTimeout(60000);const gameErrors=[],gameBad=[],consoleErrors=[];
  game.on('pageerror',e=>gameErrors.push(e.message));game.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});game.on('response',r=>{if(r.status()>=400)gameBad.push(r.url())});
  await game.waitForLoadState('load');await game.waitForFunction(()=>!document.querySelector('#status')&&document.querySelector('#canvas').width>0,{},{timeout:60000});assert.equal(await game.evaluate(()=>window.opener),null);
  await game.locator('#canvas').press('Enter');await game.waitForTimeout(800);await game.locator('#canvas').press('ArrowRight');await game.locator('#canvas').press('Space');
  await game.screenshot({path:`portfolio/publication/20261013-frontend/hop-live-startup-${width}.png`});assert.equal(new URL(game.url()).pathname,'/games/hop-hop-helper/');assert.equal(chunkUrls.length,2);assert(chunkUrls.every(r=>r.status===200));assert.deepEqual(gameErrors,[]);assert.deepEqual(gameBad,[]);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  rows.push({width,landscapeDecoded:1920,noEagerEngine:true,nativeCoverAndPlay:true,engineChunks:chunkUrls,gameErrors,consoleErrors,errors,bad,gameBad});await context.close();
 }
 fs.writeFileSync('portfolio/publication/20261013-frontend/hop-live-readiness.json',JSON.stringify({browser:browser.version(),files:manifest.files.length,allSourceStageHashes:true,allAssetsUnder25MiB:true,reconstructedEngineExact:true,externalSdkBlocked:true,muted:true,rows},null,2));console.log('Hop covers, play tabs and streamed Godot engine startup passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
