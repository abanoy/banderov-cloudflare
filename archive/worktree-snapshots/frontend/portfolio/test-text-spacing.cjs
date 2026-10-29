// Controlled reader text-spacing stress; scoped Chrome evidence, not certification.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.PORTFOLIO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const output = path.join(__dirname,'review',process.argv[2] || 'pass-27');
  await fs.mkdir(output,{recursive:true});
  const results=[];
  try {
    for(const width of [320,390,768,1280]) for(const palette of ['day','night']) {
      const page=await browser.newPage({viewport:{width,height:900}});
      await page.addInitScript(p=>localStorage.setItem('banderov-portfolio.palette',p),palette);
      await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('html').getAttribute('data-palette'),palette);
      await page.addStyleTag({content:'body *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'});
      const inspect=async scope=>page.evaluate(scope=>{
        const nodes=[...document.querySelectorAll(scope+' h1,'+scope+' h2,'+scope+' h3,'+scope+' p,'+scope+' nav,'+scope+' button,'+scope+' .card-meta,'+scope+' .project-kind')];
        return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow:nodes.filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.trim().slice(0,80),width:e.clientWidth,scroll:e.scrollWidth}))};
      },scope);
      const navigation=[];
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.screenshot({path:path.join(output,`${palette}-${width}-opening.png`)});
      for(const name of ['Games','Artwork','Music','Stories']) {
        await page.locator('.header nav').getByRole('link',{name,exact:true}).press('Enter');
        await page.waitForFunction(href=>document.querySelector('.header nav a[aria-current="location"]')?.getAttribute("href")===href,await page.locator(".header nav").getByRole("link",{name,exact:true}).getAttribute("href"));
        const placement=await page.evaluate(()=>{
          const header=document.querySelector('.header');const section=document.querySelector(location.hash);
          return {hash:location.hash,top:section.getBoundingClientRect().top,clearance:getComputedStyle(header).position==='sticky'?header.getBoundingClientRect().bottom:0};
        });
        assert(placement.top>=placement.clearance-1,`${width} ${palette} ${name}: heading covered`);
        navigation.push({name,...placement});
      }
      const main=await inspect('body');
      await page.getByRole('link',{name:'View full Maria illustration',exact:true}).press('Enter');
      await page.waitForFunction(()=>document.querySelector('.dialog-image').naturalWidth>0);
      const viewer=await inspect('dialog');
      await page.screenshot({path:path.join(output,`${palette}-${width}-viewer.png`)});
      await page.getByRole('button',{name:'Inspect details',exact:true}).press('Enter');
      assert.equal(await page.getByRole('button',{name:'Fit whole image',exact:true}).getAttribute('aria-pressed'),'true');
      const details=await inspect('dialog');
      assert(await page.locator('.dialog-image').evaluate(e=>e.clientWidth===e.naturalWidth));
      await page.locator('#art-stage').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(()=>document.querySelector('#art-stage').scrollLeft>0);
      await page.screenshot({path:path.join(output,`${palette}-${width}-details.png`)});
      await page.getByRole('button',{name:'Fit whole image',exact:true}).press('Enter');
      assert(await page.locator('#art-stage').evaluate(e=>e.scrollLeft===0&&e.scrollWidth<=e.clientWidth));
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.body.classList.contains('dialog-open'));
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'View full Maria illustration');
      results.push({width,palette,navigation,main,viewer,details});
      console.log(JSON.stringify(results.at(-1)));
      if(main.documentWidth>width||viewer.documentWidth>width||main.overflow.length||viewer.overflow.length||details.documentWidth>width||details.overflow.length)process.exitCode=1;
      await page.close();
    }
    await fs.writeFile(path.join(output,'text-spacing.json'),JSON.stringify({scope:'CSS spacing override; visible body headings/paragraphs/nav/buttons, four section links, Maria Fit/Details scrolling/reset/focus return; not all controls, screen reader, OS zoom or physical device',results},null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
