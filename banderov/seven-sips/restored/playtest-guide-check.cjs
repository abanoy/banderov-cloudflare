const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=__dirname,guide='file:///'+path.resolve(dir,'../PLAYTEST.html').replaceAll('\\','/');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});const results=[];try{
for(const width of [320,1280]){const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(guide);
assert.equal(await page.title(),'Seven Sips — local playtest');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const links=await page.locator('a').evaluateAll(xs=>xs.map(e=>({href:e.href,text:e.textContent})));
for(const l of links){assert.ok(l.href.startsWith('file:///'));assert.ok(fs.existsSync(new URL(l.href)));}
await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Play Seven Sips');
await page.screenshot({path:path.join(dir,'playtest-guide-'+width+'.png'),fullPage:true});
await page.keyboard.press('Enter');await page.waitForURL('**/restored/index.html');await page.locator('.blk').first().waitFor();assert.equal(await page.evaluate(()=>BOT),null);assert.deepEqual(errors,[]);results.push({width,links:links.length,nativePlay:true,errors});await context.close();}
const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:568}}),page=await context.newPage();await page.goto(guide);assert.equal(await page.locator('a.play').count(),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));results.push({noJavaScriptGuide:true});await context.close();
}finally{await browser.close();}fs.writeFileSync(path.join(dir,'playtest-guide-results.json'),JSON.stringify(results,null,2));console.log('PASS guide: phone/desktop links, native Play, no-JavaScript content and normal browser cleanup');})().catch(e=>{console.error(e);process.exitCode=1;});
