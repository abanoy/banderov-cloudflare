// Existing installed Firefox via native WebDriver BiDi; no driver/package install.
// Creates its own headless profile, uses loopback only, and closes only its process.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

(async () => {
  const output = path.join(__dirname, 'review', process.argv[2] || 'pass-70');
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(output, 'firefox-profile-'));
  await fs.writeFile(path.join(profile, 'user.js'), [
    'user_pref("browser.startup.homepage", "about:blank");',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);'
  ].join('\n'));
  const child = spawn(process.env.PORTFOLIO_FIREFOX || 'C:/Program Files/Mozilla Firefox/firefox.exe',
    ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', '0', 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let socket;
  const pending = new Map();
  const events = [];
  let serial = 0;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Firefox endpoint unavailable after 20s')), 20000);
      let log = '';
      const inspect = chunk => {
        log += chunk.toString();
        const match = log.match(/WebDriver BiDi listening on (ws:\/\/127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timer); resolve(match[1] + '/session'); }
      };
      child.stdout.on('data', inspect);
      child.stderr.on('data', inspect);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Own Firefox exited ${code}`)); });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Firefox WebSocket failed')), { once: true });
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const task = pending.get(message.id);
        if (!task) return;
        clearTimeout(task.timer); pending.delete(message.id);
        if (message.type === 'error') task.reject(new Error(`${message.error}: ${message.message}`));
        else task.resolve(message.result);
      } else events.push(message);
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const session = await command('session.new', { capabilities: {} });
    await command('session.subscribe', { events: ['log.entryAdded', 'network.beforeRequestSent', 'network.responseCompleted'] });
    const evaluate = async (context, expression) => {
      const result = await command('script.evaluate', { expression, target: { context }, awaitPromise: true });
      if (result.type !== 'success') throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const value = (context, expression) => evaluate(context, `(async()=>JSON.stringify(await (${expression})))()`).then(JSON.parse);
    const wait = async (context, expression) => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (await evaluate(context, expression)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`State wait failed: ${expression}`);
    };
    const key = (context, value) => command('input.performActions', { context, actions: [{
      type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value }, { type: 'keyUp', value }]
    }] });
    const screenshot = async (context, name) => {
      const result = await command('browsingContext.captureScreenshot', { context, origin: 'viewport' });
      await fs.writeFile(path.join(output, name), Buffer.from(result.data, 'base64'));
    };
    const inspectWaveform = async (context, index, captureName) => {
      await value(context, `(async()=>{document.querySelectorAll('audio').forEach(a=>a.pause());await document.querySelectorAll('audio')[${index}].play();return true})()`);
      await wait(context, `!document.querySelectorAll('.waveform-seek')[${index}].disabled&&document.querySelectorAll('audio')[${index}].currentTime>.2`);
      await evaluate(context, `document.querySelectorAll('audio')[${index}].pause();document.querySelectorAll('.waveform-seek')[${index}].focus();true`);
      await key(context, '\uE011'); // Native Home.
      await wait(context, `document.querySelectorAll('audio')[${index}].currentTime<.05`);
      await key(context, '\uE014'); // Native ArrowRight.
      await wait(context, `document.querySelectorAll('audio')[${index}].currentTime>=.09`);
      const keyboard = await value(context, `(()=>{const a=document.querySelectorAll('audio')[${index}],s=document.querySelectorAll('.waveform-seek')[${index}],r=s.getBoundingClientRect();return {time:a.currentTime,paused:a.paused,focused:document.activeElement===s,focusVisible:s.matches(':focus-visible'),outline:getComputedStyle(s).outlineStyle,height:r.height,name:s.getAttribute('aria-label')}})()`);
      assert.equal(keyboard.paused,true);assert.equal(keyboard.focused,true);assert.equal(keyboard.focusVisible,true);assert.equal(keyboard.outline,'solid');assert.ok(keyboard.height>=44);
      const box=await value(context, `(()=>{const r=document.querySelectorAll('.waveform-seek')[${index}].getBoundingClientRect();return {x:Math.round(r.x+r.width*.6),y:Math.round(r.y+r.height/2)}})()`);
      await command('input.performActions',{context,actions:[{type:'pointer',id:'waveform-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:box.x,y:box.y,origin:'viewport'},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
      await wait(context, `Math.abs(document.querySelectorAll('audio')[${index}].currentTime/document.querySelectorAll('audio')[${index}].duration-.6)<.1`);
      await wait(context, `!document.querySelectorAll('audio')[${index}].seeking`);
      await evaluate(context, `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const pointer=await value(context, `(()=>{const a=document.querySelectorAll('audio')[${index}],s=document.querySelectorAll('.waveform-seek')[${index}],t=s.closest('.track-timeline');return {time:a.currentTime,duration:a.duration,paused:a.paused,progress:t.style.getPropertyValue('--track-progress'),valueText:s.getAttribute('aria-valuetext'),documentWidth:document.documentElement.scrollWidth,width:innerWidth}})()`);
      assert.equal(pointer.paused,true);assert.ok(pointer.documentWidth<=pointer.width);assert.ok(parseFloat(pointer.progress)>50&&parseFloat(pointer.progress)<70);
      if(captureName)await screenshot(context,captureName);
      await key(context,'\uE010'); // Native End stays paused near the track end.
      await wait(context, `document.querySelectorAll('audio')[${index}].currentTime/document.querySelectorAll('audio')[${index}].duration>.95`);
      await key(context,'\uE011');
      await value(context, `(async()=>{await document.querySelectorAll('audio')[${index}].play();return true})()`);
      await wait(context, `document.querySelectorAll('audio')[${index}].currentTime>.2`);
      await key(context,'\uE014');
      assert.equal(await value(context,`document.querySelectorAll('audio')[${index}].paused`),false);
      await evaluate(context,`document.querySelectorAll('audio')[${index}].pause();true`);
      return {index,keyboard,pointer,nativeHomeEnd:true,playingSeekPreserved:true};
    };
    const reviewStylesheet = process.argv[3] ? new URL(process.argv[3], 'http://127.0.0.1:4173/').href : null;
  if (reviewStylesheet) assert.ok(reviewStylesheet.startsWith('http://127.0.0.1:4173/review/'), 'Review stylesheet must stay on the local preview');
  const applyReview = async context => {
    if (!reviewStylesheet) return;
    await evaluate(context, `(async()=>{const link=document.createElement('link');link.rel='stylesheet';link.href=${JSON.stringify(reviewStylesheet)};const loaded=new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>reject(new Error('Review stylesheet unavailable'))});document.head.append(link);await loaded;await document.fonts.ready;return true})()`);
  };
  const rows = [];
    for (const width of [320, 390, 1280]) for (const palette of ['day', 'night']) {
      const { context } = await command('browsingContext.create', { type: 'tab' });
      await command('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
      await command('browsingContext.navigate', { context, url: 'http://127.0.0.1:4173/', wait: 'complete' });
      await evaluate(context, `localStorage.setItem('banderov-portfolio.palette', '${palette}')`);
      await command('browsingContext.reload', { context, wait: 'complete' });
      await applyReview(context);
      await evaluate(context, `(async()=>{await document.fonts.ready;const images=[...document.querySelectorAll('main img')];images.forEach(i=>i.loading='eager');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(images.map(i=>i.decode()));return true})()`);
      const layout = await value(context, `({width:innerWidth,document:document.documentElement.scrollWidth,palette:document.documentElement.dataset.palette,font:getComputedStyle(document.querySelector('h1')).fontFamily,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)})`);
      assert.equal(layout.width, width); assert.equal(layout.palette, palette);
      assert.ok(layout.document <= width); assert.ok(layout.font.includes('Share Tech Mono'));
      assert.ok(layout.fonts.some(f=>f.includes('Share Tech Mono')) && layout.fonts.some(f=>f.includes('Silkscreen')));
      await screenshot(context, `${palette}-${width}-intro.png`);
      // Native Tab traversal records DOM hosts; audio shadow controls may repeat a host.
      const expectedStops = await value(context, `[...document.querySelectorAll('a[href],button,audio[controls],[tabindex]')].filter(e=>e.tabIndex>=0&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').length`);
      const keyboardStops = [];
      for (let step = 0; step < 96; step++) {
        await key(context, '\uE004');
        const stop = await value(context, `(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const e=document.activeElement,targets=[...document.querySelectorAll('a[href],button,audio[controls],[tabindex]')].filter(e=>e.tabIndex>=0&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'),b=e.getBoundingClientRect(),h=document.querySelector('.header'),hb=h.getBoundingClientRect(),w=[e.closest('.intro'),e.closest('.track-list'),e.closest('#music')].find(n=>n&&getComputedStyle(n).outlineStyle!=='none')||e.closest('.intro,.track-list'),ws=w&&getComputedStyle(w);return {index:targets.indexOf(e),tag:e.tagName,label:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,100),href:e.getAttribute('href'),visible:b.width>0&&b.height>0&&b.bottom>0&&b.top<innerHeight,covered:getComputedStyle(h).position==='sticky'&&!h.contains(e)&&!e.classList.contains('skip-link')&&b.bottom<=hb.bottom,top:b.top,bottom:b.bottom,windowFocus:w?{name:w.classList.contains('intro')?'intro':'soundtrack',active:w.matches(':focus-within'),outline:ws.outlineStyle,width:ws.outlineWidth,color:ws.outlineColor}:null}})()`);
        if (stop.tag === 'BODY' && keyboardStops.length) break;
        if (stop.index < 0) continue;
        if (keyboardStops.length && stop.index === keyboardStops[0].index) break;
        assert.equal(stop.visible, true, JSON.stringify({width,palette,stop}));
        assert.equal(stop.covered, false, JSON.stringify({width,palette,stop}));
        if (stop.windowFocus) {
          assert.equal(stop.windowFocus.active, true, JSON.stringify({width,palette,stop}));
          assert.equal(stop.windowFocus.outline, 'solid', JSON.stringify({width,palette,stop}));
          assert.ok(parseFloat(stop.windowFocus.width) >= 2, JSON.stringify({width,palette,stop}));
        }
        keyboardStops.push(stop);
        if (new Set(keyboardStops.map(item=>item.index)).size === expectedStops) break;
      }
      const uniqueStops = new Set(keyboardStops.map(stop=>stop.index)).size;
      assert.equal(uniqueStops, expectedStops, JSON.stringify({width,palette,expectedStops,keyboardStops}));
      const windowFocusStops = keyboardStops.filter(stop=>stop.windowFocus);
      assert.equal(windowFocusStops.filter(stop=>stop.windowFocus.name==='intro').length, 1);
      assert.equal(new Set(windowFocusStops.filter(stop=>stop.windowFocus.name==='soundtrack').map(stop=>stop.index)).size, 4);
      const keyboardTraversal = { expectedStops, uniqueStops, steps: keyboardStops.length, keyboardStops, windowFocusStops };
      console.log(`PASS Firefox ${width} ${palette}: ${uniqueStops} keyboard hosts visible and not fully header-covered`);
      for (const section of ['games', 'art', 'music', 'stories']) {
        await evaluate(context, `document.querySelector('nav a[href="#${section}"]').focus()`);
        await key(context, '\uE007');
        await wait(context, `location.hash==='#${section}'&&document.querySelector('nav a[href="#${section}"]').getAttribute('aria-current')==='location'`);
      }
      let pairedNavigation = null;
      if (reviewStylesheet && width >= 1100) {
        const visit = async section => {
          await evaluate(context, `document.querySelector('nav a[href="#${section}"]').focus()`);
          await key(context, '\uE007');
          await wait(context, `location.hash==='#${section}'&&document.querySelector('nav a[aria-current]').getAttribute('href')==='#${section}'`);
        };
        await visit('art');
        const tops = await value(context, `({art:document.querySelector('#art').getBoundingClientRect().top,music:document.querySelector('#music').getBoundingClientRect().top})`);
        assert.ok(Math.abs(tops.art - tops.music) < 1, JSON.stringify(tops));
        await visit('music');
        await evaluate(context, 'history.back();true');
        await wait(context, `location.hash==='#art'&&document.querySelector('nav a[aria-current]').getAttribute('href')==='#art'`);
        await evaluate(context, 'history.forward();true');
        await wait(context, `location.hash==='#music'&&document.querySelector('nav a[aria-current]').getAttribute('href')==='#music'`);
        await visit('art');
        await evaluate(context, `document.querySelector('audio').focus();true`);
        await wait(context, `document.querySelector('nav a[aria-current]').getAttribute('href')==='#music'`);
        assert.equal(await value(context, 'location.hash'), '#art');
        await evaluate(context, `document.querySelector('.art-link').focus();true`);
        await wait(context, `document.querySelector('nav a[aria-current]').getAttribute('href')==='#art'`);
        await evaluate(context, `document.activeElement.blur();document.querySelector('#stories').scrollIntoView({block:'start'});true`);
        await wait(context, `document.querySelector('nav a[aria-current]').getAttribute('href')==='#stories'`);
        assert.equal(await value(context, 'location.hash'), '#art');
        pairedNavigation = { tops, nativeAnchors: true, nativeHistory: true, focusRow: true, scrollPreservesHash: true };
        console.log(`PASS Firefox ${width} ${palette}: paired-row anchors/history/focus without URL writes`);
      }
      await evaluate(context, `document.querySelector('.connections .text-link').focus()`);
      await key(context, '\uE007');
      await wait(context, `document.querySelector('#tab-crusaders').getAttribute('aria-selected')==='true'`);
      await evaluate(context, `document.querySelector('#tab-crusaders').focus()`);
      await key(context, '\uE011'); // Home
      await wait(context, `document.querySelector('#tab-idols').getAttribute('aria-selected')==='true'`);
      await key(context, '\uE014'); // ArrowRight
      await wait(context, `document.querySelector('#tab-crusaders').getAttribute('aria-selected')==='true'`);
      await key(context, '\uE012'); // ArrowLeft
      await wait(context, `document.querySelector('#tab-idols').getAttribute('aria-selected')==='true'`);
      const imageChoices = [];
      for (const choice of ['screen', 'cover']) {
        await evaluate(context, `document.querySelector('[data-image=${choice}]').focus()`);
        await key(context, '\uE007'); // Native Enter activates the existing button.
        await wait(context, `document.querySelector('#idols-visual').getAttribute('aria-busy')==='false'&&document.querySelector('#idols-visual').naturalWidth>0`);
        const state = await value(context, `(()=>{const g=document.querySelector('.visual-controls'),i=document.querySelector('#idols-visual'),b=document.querySelector('[data-image=${choice}]');return {choice:'${choice}',group:g.getAttribute('aria-label'),source:i.currentSrc,busy:i.getAttribute('aria-busy'),font:getComputedStyle(b).fontSize,focusVisible:b.matches(':focus-visible'),width:document.documentElement.scrollWidth,buttons:[...g.querySelectorAll('button')].map(e=>({choice:e.dataset.image,pressed:e.getAttribute('aria-pressed'),top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height,client:e.clientWidth,scroll:e.scrollWidth}))}})()`);
        assert.equal(state.group, 'Don Bass Idols image selection');
        assert.equal(state.busy, 'false'); assert.equal(state.focusVisible, true);
        assert.equal(state.font, '13px'); assert.equal(state.width, width);
        assert.ok(state.source.includes(choice === 'screen' ? 'don-bass-screen' : 'don-bass-cover'));
        assert.equal(state.buttons[0].top, state.buttons[1].top);
        for (const button of state.buttons) {
          assert.equal(button.pressed, String(button.choice === choice));
          assert.ok(button.height >= 44); assert.ok(button.scroll <= button.client + 1);
        }
        imageChoices.push(state);
      }
      await evaluate(context, `document.querySelector('#tab-idols').focus()`);
      await key(context, '\uE010'); // End selects the last project tab again.
      await wait(context, `document.querySelector('#tab-crusaders').getAttribute('aria-selected')==='true'`);
      const artworkPopupCues = await value(context, `[...document.querySelectorAll('.art-link,.hero-art-view,.study-art-view')].map(e=>e.getAttribute('aria-haspopup'))`);
      assert.deepEqual(artworkPopupCues, ['dialog','dialog','dialog','dialog','dialog']);
      await evaluate(context, `document.querySelector('.study-art-view').focus();true`);
      const studyFragment = await value(context, 'location.hash');
      await key(context, '\uE007');
      await wait(context, `document.querySelector('.art-dialog').open&&!document.querySelector('.detail-toggle').disabled&&document.querySelector('.dialog-image').naturalWidth===1690`);
      await evaluate(context, `document.querySelector('.detail-toggle').focus();true`);
      await key(context, '\uE007');
      const studyViewer = await value(context, `({naturalWidth:document.querySelector('.dialog-image').naturalWidth,displayWidth:document.querySelector('.dialog-image').getBoundingClientRect().width,position:document.querySelector('.art-position').textContent,original:document.querySelector('.dialog-original').getAttribute('href')})`);
      assert.equal(studyViewer.displayWidth,1690);assert.equal(studyViewer.position,'3 of 3 · A character, every angle');assert.ok(studyViewer.original.endsWith('crusaders-turns.png'));
      await evaluate(context, `document.querySelector('.art-next').focus();true`);
      await key(context, '\uE007');
      await wait(context, `document.querySelector('.dialog-image').naturalWidth===1280&&!document.querySelector('.detail-toggle').disabled`);
      await key(context, '\uE00C');
      await wait(context, `!document.querySelector('.art-dialog').open&&document.activeElement===document.querySelector('.study-art-view')`);
      assert.equal(await value(context,'location.hash'),studyFragment);
      studyViewer.openerReturned=true;studyViewer.fragmentPreserved=true;
      const galleryFocus = [];
      for (const index of [0, 1, 2]) {
        await key(context, '\uE004'); // Tab establishes native keyboard modality.
        await evaluate(context, `document.querySelectorAll('.art-link')[${index}].focus()`);
        const state = await value(context, `(()=>{const a=document.querySelectorAll('.art-link')[${index}],s=getComputedStyle(a),c=getComputedStyle(a.closest('figure').querySelector('figcaption'));return {index:${index},focusVisible:a.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor,caption:c.borderTopColor}})()`);
        assert.equal(state.focusVisible, true, JSON.stringify(state));
        assert.equal(state.outline, 'solid'); assert.equal(state.width, '3px');
        assert.equal(state.color, 'rgb(169, 240, 255)'); assert.equal(state.caption, state.color);
        if (index === 0) {
          state.mariaThumbnail = await value(context, `(()=>{const i=document.querySelectorAll('.art-link')[0].querySelector('img'),r=i.getBoundingClientRect(),s=getComputedStyle(i);return {naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,width:r.width,height:r.height,fit:s.objectFit,source:i.currentSrc}})()`);
          assert.equal(state.mariaThumbnail.naturalWidth, 1280);
          assert.equal(state.mariaThumbnail.naturalHeight, 2830);
          assert.equal(state.mariaThumbnail.fit, 'contain');
        }
        if (index === 1) {
          state.sketchThumbnail = await value(context, `(()=>{const i=document.querySelectorAll('.art-link')[1].querySelector('img'),r=i.getBoundingClientRect(),s=getComputedStyle(i),c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,marks={left:c.width,top:c.height,right:0,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const p=(y*c.width+x)*4;if(pixels[p+3]&&Math.min(pixels[p],pixels[p+1],pixels[p+2])<255){marks.left=Math.min(marks.left,x);marks.top=Math.min(marks.top,y);marks.right=Math.max(marks.right,x+1);marks.bottom=Math.max(marks.bottom,y+1)}}const scale=(s.objectFit==='cover'?Math.max:Math.min)(r.width/i.naturalWidth,r.height/i.naturalHeight),x=(r.width-i.naturalWidth*scale)/2,y=s.objectPosition==='50% 100%'?r.height-i.naturalHeight*scale:(r.height-i.naturalHeight*scale)/2;return {naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,width:r.width,height:r.height,fit:s.objectFit,position:s.objectPosition,source:i.currentSrc,marks,visibleSource:{left:Math.max(0,-x/scale),top:Math.max(0,-y/scale),right:Math.min(i.naturalWidth,(r.width-x)/scale),bottom:Math.min(i.naturalHeight,(r.height-y)/scale)}}})()`);
          assert.equal(state.sketchThumbnail.naturalWidth, 720);
          assert.equal(state.sketchThumbnail.naturalHeight, 480);
          const { marks, visibleSource } = state.sketchThumbnail;
          // Division can produce 479.99999999999994 for a 480px source edge.
          // This tolerance is in source pixels, far below a raster pixel.
          const coordinateRoundoff = 1e-9;
          assert.ok(visibleSource.left <= marks.left + coordinateRoundoff && visibleSource.top <= marks.top + coordinateRoundoff && visibleSource.right >= marks.right - coordinateRoundoff && visibleSource.bottom >= marks.bottom - coordinateRoundoff, JSON.stringify({width,palette,sketchThumbnail:state.sketchThumbnail}));
        }
        if (index === 2) {
          state.indicatorClearance = await value(context, `(()=>{const a=document.querySelectorAll('.art-link')[2],r=a.getBoundingClientRect(),i=a.querySelector('img').getBoundingClientRect(),s=getComputedStyle(a,'::after'),b=getComputedStyle(a);return r.bottom-parseFloat(b.borderBottomWidth)-parseFloat(s.bottom)-parseFloat(s.height)-i.bottom})()`);
          assert.ok(state.indicatorClearance >= 0, 'Rotation indicator must clear the image rectangle');
        }
        if (index === 1) await screenshot(context, `${palette}-${width}-gallery-focus.png`);
        await key(context, '\uE007');
        await wait(context, `document.querySelector('.art-dialog').open&&!document.querySelector('.detail-toggle').disabled`);
        if (index === 1) {
          await evaluate(context, `document.querySelector('.detail-toggle').focus();true`);
          await key(context, '\uE007');
          await wait(context, `document.querySelector('.detail-toggle').getAttribute('aria-pressed')==='true'`);
          state.sketchDetails = await value(context, `(()=>{const i=document.querySelector('.dialog-image');return {naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,displayWidth:i.getBoundingClientRect().width,original:document.querySelector('.dialog-original').getAttribute('href')}})()`);
          assert.equal(state.sketchDetails.naturalWidth, 720);
          assert.equal(state.sketchDetails.naturalHeight, 480);
          assert.equal(state.sketchDetails.displayWidth, 720);
          assert.ok(state.sketchDetails.original.endsWith('/assets/archive-art-1.png'));
        }
        await key(context, '\uE00C');
        await wait(context, `!document.querySelector('.art-dialog').open&&document.activeElement===document.querySelectorAll('.art-link')[${index}]`);
        galleryFocus.push(state);
      }
      await evaluate(context, `document.querySelector('.hero-art-view').focus()`);
      await key(context, '\uE007');
      await wait(context, `document.querySelector('.art-dialog').open&&document.querySelector('.dialog-image').naturalWidth>0`);
      await screenshot(context, `${palette}-${width}-viewer.png`);
      await key(context, '\uE00C');
      await wait(context, `!document.querySelector('.art-dialog').open&&document.activeElement===document.querySelector('.hero-art-view')`);
      const localEvents = events.filter(e=>e.params?.context===context||e.params?.source?.context===context);
      const errors = localEvents.filter(e=>e.method==='log.entryAdded'&&e.params.type==='javascript'&&e.params.level==='error');
      const failed = localEvents.filter(e=>e.method==='network.responseCompleted'&&e.params.response.status>=400);
      const audio = localEvents.filter(e=>e.method==='network.beforeRequestSent'&&/\.(mp3|ogg)(\?|$)/.test(e.params.request.url));
      const networkResponses = localEvents.filter(e=>e.method==='network.responseCompleted');
      assert.ok(networkResponses.some(e=>e.params.response.url.startsWith('http://127.0.0.1:4173/')), 'Actual local response events observed');
      await fs.writeFile(path.join(output, 'latest-case-diagnostics.json'), JSON.stringify({width,palette,keyboardTraversal,errors,failed,audio},null,2));
      assert.equal(errors.length, 0, JSON.stringify(errors));
      assert.equal(failed.length, 0, JSON.stringify(failed));
      assert.equal(audio.length, 0, JSON.stringify(audio));
      assert.equal(await value(context,`document.querySelectorAll('.waveform-seek:disabled').length`),2);
      await key(context,'\uE004');
      const waveform=await inspectWaveform(context,0,`${palette}-${width}-waveform-progress.png`);
      const waveformEvents=events.filter(e=>e.params?.context===context||e.params?.source?.context===context);
      const waveformErrors=waveformEvents.filter(e=>e.method==='log.entryAdded'&&e.params.type==='javascript'&&e.params.level==='error');
      const waveformFailures=waveformEvents.filter(e=>e.method==='network.responseCompleted'&&e.params.response.status>=400);
      assert.equal(waveformErrors.length,0);assert.equal(waveformFailures.length,0);
      rows.push({ width, palette, layout, keyboardTraversal, imageChoices, artworkPopupCues, studyViewer, galleryFocus, pairedNavigation, errors, failed, audio, waveform, waveformErrors, waveformFailures, localResponseEvents: networkResponses.length });
      console.log(`PASS Firefox ${width} ${palette}: fonts/layout/native keyboard/gallery focus/dialog/no initial audio`);
      await command('browsingContext.close', { context });
    }
    // Isolated native 404 probes exercise the actual image-error handler. They
    // are expected failures, separate from the normal-case network assertions.
    const viewerFailures = [];
    for (const width of [320, 390, 1280]) for (const palette of ['day', 'night']) for (const doubled of [false, true]) {
      const { context } = await command('browsingContext.create', { type: 'tab' });
      await command('browsingContext.setViewport', { context, viewport: { width, height: width === 320 ? 740 : 900 }, devicePixelRatio: 1 });
      await command('browsingContext.navigate', { context, url: 'http://127.0.0.1:4173/', wait: 'complete' });
      await applyReview(context);
      await evaluate(context, `(async()=>{await document.fonts.ready;document.documentElement.dataset.palette='${palette}';if(${doubled}){const pairs=[...document.querySelectorAll('body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);pairs.forEach(([e,n])=>e.style.setProperty('font-size',n*2+'px','important'));}document.querySelectorAll('.art-link')[1].focus();return true})()`);
      await key(context, '\uE007');
      await wait(context, `document.querySelector('.art-dialog').open&&!document.querySelector('.detail-toggle').disabled`);
      await evaluate(context, `document.querySelector('.dialog-image').src='/assets/controlled-missing-viewer-probe.webp';true`);
      await wait(context, `document.querySelector('.image-status').textContent.includes('Artwork could not load')&&!document.querySelector('.image-status').hidden`);
      const state = await value(context, `(()=>{const e=document.querySelector('.image-status'),r=document.createRange();r.selectNodeContents(e);const t=r.getBoundingClientRect(),s=e.parentElement.getBoundingClientRect(),c=document.querySelector('.dialog-caption').getBoundingClientRect();return {text:e.textContent,textTop:t.top,textBottom:t.bottom,surfaceTop:s.top,surfaceBottom:s.bottom,captionTop:c.top,documentWidth:document.documentElement.scrollWidth,client:e.clientWidth,scroll:e.scrollWidth,disabled:document.querySelector('.detail-toggle').disabled,original:document.querySelector('.dialog-original').getAttribute('href'),browseWords:[...document.querySelectorAll('.art-browse button')].flatMap(b=>{const n=b.firstChild;return [...n.textContent.matchAll(/\\S+/g)].map(m=>{const q=document.createRange();q.setStart(n,m.index);q.setEnd(n,m.index+m[0].length);return {word:m[0],rectangles:q.getClientRects().length}})})}})()`);
      assert.equal(state.documentWidth, width); assert.ok(state.scroll <= state.client + 1);
      assert.ok(state.textTop >= state.surfaceTop - 1 && state.textBottom <= state.surfaceBottom + 1, JSON.stringify(state));
      assert.ok(state.captionTop >= state.surfaceBottom - 1); assert.equal(state.disabled, true);
      assert.ok(state.original.endsWith('archive-art-1.png'));
      assert.equal(state.browseWords.length, 4);
      for (const word of state.browseWords) assert.equal(word.rectangles, 1, word.word);
      await evaluate(context, `document.querySelector('.dialog-original').focus();true`);
      const fallbackVisible = await value(context, `(()=>{const a=document.querySelector('.dialog-original').getBoundingClientRect(),d=document.querySelector('.art-dialog').getBoundingClientRect();return a.top>=d.top&&a.bottom<=d.bottom+1})()`);
      assert.equal(fallbackVisible, true);
      if (doubled && width === 320) await screenshot(context, `${palette}-320-enlarged-native-image-failure.png`);
      await key(context, '\uE00C');
      await wait(context, `!document.querySelector('.art-dialog').open&&document.activeElement===document.querySelectorAll('.art-link')[1]`);
      await key(context, '\uE007');
      await wait(context, `document.querySelector('.art-dialog').open&&!document.querySelector('.detail-toggle').disabled&&document.querySelector('.image-status').hidden`);
      await key(context, '\uE00C');
      await wait(context, `!document.querySelector('.art-dialog').open&&document.activeElement===document.querySelectorAll('.art-link')[1]`);
      const contextEvents = events.filter(e => e.params?.context === context || e.params?.source?.context === context);
      const failed = contextEvents.filter(e => e.method === 'network.responseCompleted' && e.params.response.status >= 400);
      const errors = contextEvents.filter(e => e.method === 'log.entryAdded' && e.params.type === 'javascript' && e.params.level === 'error');
      assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(failed.length, 1, JSON.stringify(failed));
      assert.equal(failed[0].params.response.status, 404);
      assert.ok(failed[0].params.response.url.endsWith('/assets/controlled-missing-viewer-probe.webp'));
      viewerFailures.push({ width, palette, doubled, state, fallbackVisible, recovery: true, expectedStatus: 404, errors });
      await command('browsingContext.close', { context });
    }
    console.log('PASS Firefox 12 native image failures: contained text, whole browse words, original fallback and reopen recovery');
    const { context: mediaContext } = await command('browsingContext.create', { type: 'tab' });
    await command('browsingContext.navigate', { context: mediaContext, url: 'http://127.0.0.1:4173/#music', wait: 'complete' });
    await applyReview(mediaContext);
    // Native key activation provides a real interaction before requesting media.
    await evaluate(mediaContext, `document.querySelector('nav a[href="#music"]').focus()`);
    await key(mediaContext, '\uE007');
    const media = [];
    try {
      for (const index of [0, 1]) {
        const started = await value(mediaContext, `(async()=>{const a=document.querySelectorAll('audio')[${index}];let timer;try{await Promise.race([a.play(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Playback did not start within6s')),6000)})]);return {started:true}}catch(error){return {started:false,name:error.name,message:error.message}}finally{clearTimeout(timer)}})()`);
        assert.equal(started.started, true, JSON.stringify(started));
        await wait(mediaContext, `document.querySelectorAll('audio')[${index}].currentTime>0.25`);
        const state = await value(mediaContext, `({index:${index},duration:document.querySelectorAll('audio')[${index}].duration,time:document.querySelectorAll('audio')[${index}].currentTime,source:document.querySelectorAll('audio')[${index}].currentSrc,paused:document.querySelectorAll('audio')[${index}].paused,firstPaused:document.querySelectorAll('audio')[0].paused,playingCards:document.querySelectorAll('.track.is-playing').length})`);
        assert.equal(state.paused, false); assert.equal(state.playingCards, 1);
        state.deckTitle = await value(mediaContext, "document.querySelector('.deck-status').textContent");
        assert.equal(state.deckTitle, index === 0 ? 'Playing / Title theme' : 'Playing / Cognition');
        assert.ok(index===0 ? state.duration>15&&state.duration<20 : state.duration>130&&state.duration<145);
        if(index===1) assert.equal(state.firstPaused, true);
        media.push(state);
      }
      // Preserve the earlier live switching check before testing either ending.
      for(const index of [0,1])media[index].waveform=await inspectWaveform(mediaContext,index);
      for (const index of [0, 1]) {
        await value(mediaContext, `(async()=>{const a=document.querySelectorAll('audio')[${index}];a.currentTime=a.duration-0.2;await a.play();return true})()`);
        await wait(mediaContext, `document.querySelectorAll('audio')[${index}].ended&&document.querySelector('.deck-status').textContent==='Selected tracks'`);
        const ending = await value(mediaContext, `({ended:document.querySelectorAll('audio')[${index}].ended,paused:document.querySelectorAll('audio')[${index}].paused,playingCards:document.querySelectorAll('.track.is-playing').length,deckTitle:document.querySelector('.deck-status').textContent})`);
        assert.equal(ending.ended, true); assert.equal(ending.paused, true);
        assert.equal(ending.playingCards, 0); assert.equal(ending.deckTitle, 'Selected tracks');
        media[index].nativeEnd = ending;
      }
    } finally {
      await evaluate(mediaContext, `document.querySelectorAll('audio').forEach(a=>a.pause());true`);
      await wait(mediaContext, "document.querySelector('.deck-status').textContent==='Selected tracks'");
    }
    const mediaEvents = events.filter(e=>e.params?.context===mediaContext||e.params?.source?.context===mediaContext);
    const mediaErrors = mediaEvents.filter(e=>e.method==='log.entryAdded'&&e.params.type==='javascript'&&e.params.level==='error');
    const mediaFailures = mediaEvents.filter(e=>e.method==='network.responseCompleted'&&e.params.response.status>=400);
    assert.equal(mediaErrors.length,0); assert.equal(mediaFailures.length,0);
    await command('browsingContext.close', { context: mediaContext });
    console.log('PASS Firefox native decoding/time progression and second-player exclusivity; playback stopped');
    // Prove the observer sees an actual uncaught error in a disposable blank tab.
    const { context: probe } = await command('browsingContext.create', { type: 'tab' });
    await evaluate(probe, `setTimeout(()=>{throw new Error('Controlled Firefox observer probe')},0);true`);
    const probeDeadline = Date.now() + 5000;
    let observedProbe;
    while (Date.now() < probeDeadline) {
      observedProbe = events.find(e=>e.method==='log.entryAdded'&&e.params?.source?.context===probe&&e.params.type==='javascript'&&e.params.level==='error'&&e.params.text.includes('Controlled Firefox observer probe'));
      if (observedProbe) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(observedProbe, 'Error observer validated using actual uncaught probe');
    await command('browsingContext.close', { context: probe });
    await fs.writeFile(path.join(output, 'firefox-check.json'), JSON.stringify({
      browser: session.capabilities.browserName, version: session.capabilities.browserVersion,
      reviewStylesheet, rows, viewerFailures, media, mediaErrors, mediaFailures, errorObserverProbeDetected: true,
      scope: 'Installed Firefox, separate headless profile, BiDi viewport/native key automation. Not physical devices, screen-reader speech, audible playback, production, or exhaustive engine coverage.'
    }, null, 2));
    await command('browser.close').catch(() => {});
  } finally {
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('Test cleanup')); }
    pending.clear();
    if (socket) socket.close();
    if (child.exitCode === null) child.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
