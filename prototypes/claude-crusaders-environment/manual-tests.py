from pathlib import Path
r=Path(__file__).parent
p=r/'test/physics.mjs';s=p.read_text(encoding='utf-8').replace('step,launch,reset','step,launch as rawLaunch,reset');s=s.replace('const world=makeLayout();let checks=0;','const world=makeLayout();let checks=0;\nfunction launch(s,w,id){const accepted=rawLaunch(s,w,id);if(accepted)guide(s,w,id);return accepted;}')
s+='\nreset(s,world);check(rawLaunch(s,world,"island"),"manual native launch accepted");check(s.travel.mode==="free"&&s.y===4,"immediate manual lift and hover");const manualStart=JSON.stringify([s.x,s.y,s.z]);for(let i=0;i<100;i++)step(s,world,{},1/120);check(manualStart===JSON.stringify([s.x,s.y,s.z]),"manual launch never follows a route without guide");console.log(checks+" current physics assertions passed");\n';p.write_text(s,encoding='utf-8')
p=r/'test/browser.cjs';s=p.read_text(encoding='utf-8')
s=s.replace("await page.click('[data-destination=\"island\"]');await page.waitForTimeout(1250);", "await page.click('[data-destination=\"island\"]');check(await page.evaluate(()=>window.__demo.state.travel.mode==='free'&&window.__demo.state.y===4),'manual launch default');await page.click('#guidePod');await page.waitForTimeout(1250);")
s=s.replace("await page.waitForFunction(()=>!!window.__demo.state.travel);await page.waitForFunction(()=>!window.__demo.state.travel", "await page.waitForFunction(()=>!!window.__demo.state.travel);await page.click('#guidePod');await page.waitForFunction(()=>!window.__demo.state.travel")
s=s.replace("throw Error('launch');while(s.travel)", "throw Error('launch');d.guide(dest.id);while(s.travel)")
s=s.replace("d.launch('island');while(s.travel)", "d.launch('island');d.guide('island');while(s.travel)")
s=s.replace("throw Error('trip '+i);while(d.state.travel)", "throw Error('trip '+i);d.guide(target);while(d.state.travel)")
p.write_text(s,encoding='utf-8')
p=r/'test/package-smoke.cjs';s=p.read_text(encoding='utf-8').replace('state.y>35','state.y>15');p.write_text(s,encoding='utf-8')
for path in [r/'src/main.js',r/'integration/src/main.js']:
 s=path.read_text(encoding='utf-8').replace("'Steer to take control · Space/C up · Z/Ctrl down · release to hover.'", "(state.travel.mode==='free'?'Manual flight · steer, rise or descend · release to hover.':'Guided flight · steer to take over.')")
 path.write_text(s,encoding='utf-8')
