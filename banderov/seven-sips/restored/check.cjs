const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await page.locator('.blk').first().waitFor();
await page.screenshot({path:path.resolve(__dirname,'recovered-phone.png')});
assert.equal(await page.locator('.girl svg').count(),1);assert.equal(await page.locator('.blk').count(),4);
for(const size of [{width:320,height:568},{width:1280,height:720},{width:844,height:390}]){
 await page.setViewportSize(size);const rect=await page.locator('#game').boundingBox();
 assert.ok(rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=size.width+1&&rect.y+rect.height<=size.height+1);
 await page.screenshot({path:path.resolve(__dirname,`recovered-${size.width}.png`)});
}
await page.setViewportSize({width:390,height:844});
const b=await page.locator('.blk').first().boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForFunction(()=>G&&G.day===1);await page.locator('.blk:not(:disabled)').first().waitFor();
await page.screenshot({path:path.resolve(__dirname,'recovered-reply.png')});
await page.getByRole('button',{name:'Settings and pause'}).click();assert.equal(await page.evaluate(()=>Engine.paused),true);
await page.getByRole('button',{name:'Resume',exact:true}).click();assert.equal(await page.evaluate(()=>Engine.paused),false);
await page.keyboard.press('1');await page.waitForTimeout(250);
assert.ok(await page.evaluate(()=>UI.say.querySelectorAll('.w:not(.empty)').length)>=1);
const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const mobile=await touch.newPage();mobile.on('pageerror',e=>errors.push(e.message));
await mobile.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await mobile.locator('.blk').first().waitFor();
// Wait for the entrance tween before targeting the moving cold-open button.
await mobile.waitForTimeout(550);
const tb=await mobile.locator('.blk').first().boundingBox();await mobile.touchscreen.tap(tb.x+tb.width/2,tb.y+tb.height/2);
await mobile.waitForFunction(()=>G&&G.day===1,null,{timeout:15000});await touch.close();
assert.deepEqual(errors,[]);console.log('Recovered browser: cold open, cast render, four viewport bounds, day 1 reply, keyboard selection, emulated touch and pause/resume passed; no page errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
