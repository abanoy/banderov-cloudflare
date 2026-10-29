const {chromium}=require(process.env.SEVEN_PLAYWRIGHT||'playwright');const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SEVEN_BROWSER});try{
 const c=await browser.newContext({viewport:{width:320,height:568}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.__noBoot=true;window.denyCopy=true;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{if(window.holdCopy)await new Promise(resolve=>window.releaseCopy=resolve);if(denyCopy)throw new DOMException('fixture denied','NotAllowedError');window.copiedText=t;}}});});
 await p.goto('file:///'+path.resolve(__dirname,'index.html').replaceAll('\\','/'));await p.waitForFunction(()=>UI.snd);
 await p.evaluate(()=>{Sound.setMusic(false);Sound.setSfx(false);Engine.speed=5;SAVE.fast=true;newRun();G.day=7;G.best={said:'A lovely cup of tea.',who:'Waitress',reply:'Stay for another?'};endLonely().then(next=>main(next));});await p.locator('.ending').waitFor();await p.waitForTimeout(400);
 await p.getByRole('button',{name:'Copy',exact:true}).focus();await p.keyboard.press('Space');
 if(process.env.SEVEN_EXPECT_BASELINE==='1'){await p.getByRole('button',{name:"Can't copy",exact:true}).waitFor();assert.equal(await p.locator('textarea').count(),0);assert.equal(await p.locator('.quote p').first().evaluate(e=>getComputedStyle(e).userSelect),'none');console.log('Denied clipboard has no selectable fallback in baseline.');}
 else{
  const field=p.getByRole('textbox',{name:'Quote to copy',exact:true});await field.waitFor();const text='"A lovely cup of tea."\nWaitress: Stay for another?\n- Seven Sips';assert.equal(await field.inputValue(),text);assert.deepEqual(await field.evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,text.length]);
  await p.keyboard.press('ArrowLeft');assert.equal(await p.evaluate(()=>document.activeElement.tagName),'TEXTAREA');await p.keyboard.press('1');assert.equal(await p.locator('.ending').count(),1);await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'Play again');
  await p.screenshot({path:path.join(__dirname,'quote-fallback-320.png')});await p.evaluate(()=>window.denyCopy=false);await p.getByRole('button',{name:'Retry copy',exact:true}).click();await p.getByRole('button',{name:'Copied!',exact:true}).waitFor();assert.equal(await p.evaluate(()=>copiedText),text);assert.equal(await field.count(),0);
  await p.evaluate(()=>{window.denyCopy=true;window.holdCopy=true;});await p.getByRole('button',{name:'Copied!',exact:true}).click();await p.keyboard.press('Escape');await p.evaluate(()=>releaseCopy());await field.waitFor();assert.equal(await p.evaluate(()=>document.activeElement.dataset.k),'resume','delayed denial must not steal pause focus');await p.getByRole('button',{name:'Resume',exact:true}).click();assert.deepEqual(errors,[]);
  await p.getByRole('button',{name:'Play again',exact:true}).focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>G&&G.day===1&&document.querySelectorAll('.ending').length===0);console.log('Clipboard failure/native selection/textbox keys/retry/replay passed.');
 }
 await c.close();
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
