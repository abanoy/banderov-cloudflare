from pathlib import Path
r=Path(__file__).parent/'integration'
p=r/'src/main.js';s=p.read_text(encoding='utf-8')
s="import {createWorldCharacter} from '../character/adapter.js';\n"+s
s=s.replace('supportAt}', 'supportAt,landingAt}')
s=s.replace('distance=150','distance=80').replace('const actor=new THREE.Group();scene.add(actor);','const character=createWorldCharacter({worldHeight:2.1});let characterPose=\'idle\',previousX=state.x,previousZ=state.z;character.setPose(characterPose);\nconst marker=new THREE.Group();marker.visible=false;const actor=new THREE.Group();actor.add(character.root,marker);scene.add(actor);')
s=s.replace('actor.add(body)','marker.add(body)').replace('actor.add(head)','marker.add(head)').replace('actor.add(arrow)','marker.add(arrow)')
s=s.replace('function doReset(){reset(state,world);','function doReset(){reset(state,world);character.reset();characterPose=\'idle\';character.setPose(characterPose);previousX=state.x;previousZ=state.z;')
s=s.replace('let currentPad=null;', '''let wideView=false;$('viewToggle').onclick=()=>{wideView=!wideView;distance=wideView?150:80;$('viewToggle').textContent=wideView?'Wide view':'Walk view';};
$('actor').onchange=e=>{const model=e.target.value==='chibi';character.root.visible=model;marker.visible=!model;};
const landingRing=mesh(new THREE.RingGeometry(1.3,1.6,32),new THREE.MeshBasicMaterial({color:0x87efb6,side:THREE.DoubleSide,depthWrite:false}),0,0,0);landingRing.rotation.x=-Math.PI/2;landingRing.visible=false;
let currentPad=null;''')
s=s.replace("$('level').textContent=state.travel?", "$('level').textContent=state.travel?")
s=s.replace("'Steer to take control · Space/C up · Z/Ctrl down · release to hover.'", "(state.travel.mode==='guided'?'Guided trip · steer to take over.':(()=>{const f=landingAt(world,state.x,state.z,state.y);return f?((f.valid?'Open landing: ':'Blocked landing: ')+f.floor.name+' · '+Math.round(state.y-f.y)+' m below'):'Open sky · steer toward a floor, then descend.';})())")
s=s.replace("'Guided flight · steer to take over';", "'Guided flight · steer to take over';\n const destination=state.travel?.end||world.pads.find(p=>p.id===state.homeCastle);const bearing=Math.atan2(destination.x-state.x,-(destination.z-state.z)),degrees=((bearing*180/Math.PI+360)%360).toFixed(0);$('navigation').textContent=(state.travel?'Target: ':'Castle: ')+destination.name+' · '+Math.round(Math.hypot(destination.x-state.x,destination.z-state.z))+' m · bearing '+degrees+'°';")
s=s.replace('actor.position.set(state.x,state.y,state.z);actor.rotation.y=state.facing;', '''actor.position.set(state.x,state.y,state.z);actor.rotation.y=state.facing;
 const moving=Math.hypot(state.x-previousX,state.z-previousZ)>.001;
 const pose=state.travel||!state.grounded?'neutral':moving?'walk':'idle';
 if(!state.paused){if(pose!==characterPose){character.setPose(pose);characterPose=pose;}character.update(dt);}previousX=state.x;previousZ=state.z;
 const landing=state.travel?.mode==='free'?landingAt(world,state.x,state.z,state.y):null;landingRing.visible=!!landing&&state.y-landing.y<40;
 if(landing){landingRing.position.set(state.x,landing.y+.07,state.z);landingRing.rotation.x=-Math.PI/2-Math.atan(landing.floor.slope);landingRing.material.color.setHex(landing.valid?0x87efb6:0xf09c91);}
''')
s=s.replace('scene,actor,shadow,pod,trail,input:', 'scene,actor,character,marker,landingRing,landingAt:(x,z,y)=>landingAt(world,x,z,y),shadow,pod,trail,input:')
s=s.replace("addEventListener('error',", "addEventListener('pagehide',()=>character.dispose());\naddEventListener('error',")
p.write_text(s,encoding='utf-8')
p=r/'src/physics.js';s=p.read_text(encoding='utf-8');s += "\nexport function landingAt(world,x,z,y){const floor=supportAt(world,x,z,y+.01);if(!floor)return null;const top=heightAt(floor,z);return {floor,y:top,valid:!blocked(world,x,z,top)};}\n";p.write_text(s,encoding='utf-8')
p=r/'index.html';s=p.read_text(encoding='utf-8').replace('<title>Crusaders · Sky routes</title>','<title>Crusaders · Pinned character integration</title>')
s=s.replace('<button id="optionsToggle">Look</button>', '<button id="optionsToggle">Look</button><button id="viewToggle">Walk view</button>')
s=s.replace('<aside id="location">','<aside id="location"><span id="navigation">Castle: Dawn</span>')
s=s.replace('<option value="marker">Temporary explorer marker</option>', '<option value="chibi">Pinned 3D sailor study</option><option value="marker">Baseline marker</option>')
s=s.replace('Marker <select','Character <select').replace('Original art integration remains separate.','Copied model study; likeness remains unapproved.')
p.write_text(s,encoding='utf-8')
p=r/'src/style.css';s=p.read_text(encoding='utf-8');s+='\n#navigation{font:11px system-ui;color:#aadfdd}@media(max-width:600px){.tools{gap:4px}.tools button{padding:6px 7px;font-size:12px}#location{top:110px}#flightPanel{top:220px}}\n';p.write_text(s,encoding='utf-8')
