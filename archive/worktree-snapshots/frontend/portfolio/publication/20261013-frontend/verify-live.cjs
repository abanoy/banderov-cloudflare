const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const root=__dirname,prepared=JSON.parse(fs.readFileSync(path.join(root,'prepared.json'))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const base='https://banderov.com',rows=[];
 for(const f of prepared.publicFiles){const r=await fetch(base+'/'+f.path.slice(7));assert.equal(r.status,200,f.path);assert.equal(sha(Buffer.from(await r.arrayBuffer())),f.sha256,f.path);}
 for(const origin of prepared.origins){const r=await fetch(base+'/rooms',{headers:{Origin:origin}});assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),origin)}
 for(const origin of ['null','https://unapproved.invalid','https://b661d8fc-f78e-45a5-bc32-340936a88d31.starhermit.com.evil.example']){const r=await fetch(base+'/rooms',{headers:{Origin:origin}});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null)}
 assert.equal(await(await fetch(base+'/health')).text(),'ok');const stats=await(await fetch(base+'/stats')).json();assert.equal(stats.version,'1.1.2');assert.deepEqual(new Set(stats.allowedOrigins||stats.allowed_origins||stats.origins),new Set(prepared.origins));
 const image=await fetch('https://banderov-backend.alexanderbanderov.workers.dev/media/don-bass-idols-cover.png');assert.equal(image.status,200);assert.equal(sha(Buffer.from(await image.arrayBuffer())),'2c840d1a47e8cac7803eb9adb7d655cb99ab0852bc50f9c6e9ffd05a647c29bb');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--mute-audio']});
 try{for(const [width,noJs] of [[320,false],[1280,false],[320,true]]){
  const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:!noJs});const page=await context.newPage(),errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url())});
  await page.goto(base+'/',{waitUntil:'networkidle'});assert.equal(await page.locator('h1').innerText(),'Banderov.com');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  for(const name of ['Games','Artwork','Music','Stories']){await page.locator('.header nav').getByRole('link',{name,exact:true}).press('Enter');assert.equal(new URL(page.url()).hash,'#'+({Stories:'stories',Games:'games',Artwork:'art',Music:'music'}[name]));}
  for(const p of ['/games/don-bass-idols/','/games/seven-sips/','/games/hop-hop-helper/']){const a=page.locator('.play-tabs a').filter({has:undefined});const link=page.locator(`.play-tabs a[href="${p}"]`);assert.equal(await link.getAttribute('target'),'_blank');assert((await link.getAttribute('rel')).includes('noopener'));}
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);await page.screenshot({path:path.join(root,`live-portfolio-${width}-${noJs?'nojs':'js'}.png`),fullPage:true});rows.push({width,noJs,keyboardNavigation:true,threeNativeGameTabs:true,errors,bad});await context.close();
 }
 const page=await browser.newPage();await page.routeWebSocket('**/*',ws=>ws.close());await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await page.goto(base+'/?roomId=local-verification-only&join=1#retained',{waitUntil:'domcontentloaded'});await page.waitForURL(base+'/games/don-bass-idols/?roomId=local-verification-only&join=1#retained');await page.close();
 fs.writeFileSync(path.join(root,'verified-live.json'),JSON.stringify({verifiedAtUtc:new Date().toISOString(),base,browser:browser.version(),publicAssetsHashMatched:prepared.publicFiles.length,originsAllowed:prepared.origins.length,rejectedOrigins:3,health:true,legacyInvitationRedirect:true,existingImageUnchanged:true,rows,limitations:['Headless Chrome, muted; no physical touch, audible playback, full game progression or fresh cross-network multiplayer proof.']},null,2));console.log('Live HTTPS assets, 13 origins, preserved image and mobile/desktop/keyboard/no-JS checks passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
