import * as T from '../vendor/three.module.js';

// Presentation only. Owner sprite maps, hitboxes, team membership and clocks stay intact.
export function createBattleIdentity({root,views,camera,viewerTeam}){
 const group=new T.Group();group.name='Shadow identities and reconstruction';root.add(group);
 const geometry=new T.BoxGeometry(1,1,1),particles=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({transparent:true,opacity:.8,depthWrite:false}),384),dummy=new T.Object3D(),color=new T.Color(),frustum=new T.Frustum(),matrix=new T.Matrix4(),point=new T.Vector3();particles.frustumCulled=false;particles.count=0;group.add(particles);
 const friendlyBadge=new T.CircleGeometry(.25,4),hostileBadge=new T.CircleGeometry(.28,3);hostileBadge.rotateZ(-Math.PI/2);
 const records=views.map(v=>{
  const uniforms={identityTime:{value:0},identityShadow:{value:0},identityGlitch:{value:0},identityDeath:{value:0}};
  function shader(material){material.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.fragmentShader='uniform float identityTime; uniform float identityShadow; uniform float identityGlitch; uniform float identityDeath;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec2 uv=vUv;
    float row=floor(uv.y*22.0);
    float noise=fract(sin(row*37.7+floor(identityTime*9.0)*13.1)*43758.5453);
    uv.x+=(noise-.5)*.15*identityGlitch*step(.65,noise);
    vec4 texel=texture2D(map,uv);
    float edge=max(max(texture2D(map,uv+vec2(.012,0.)).a,texture2D(map,uv-vec2(.012,0.)).a),max(texture2D(map,uv+vec2(0.,.012)).a,texture2D(map,uv-vec2(0.,.012)).a));
    vec3 original=mapTexelToLinear(texel).rgb;
    vec3 shadow=mix(vec3(.025,.012,.055),vec3(.085,.035,.14),uv.y);
    vec3 ink=mix(original,shadow,identityShadow);
    ink=mix(ink,vec3(.64,.23,.52),step(.84,noise)*identityGlitch*.65);
    if(texel.a<.4&&edge>.5&&identityShadow>.05){texel.a=edge;ink=vec3(.7,.22,.5)*identityShadow;}
    float cut=fract(sin(floor(uv.x*18.)*17.1+row*91.7)*43758.5453);
    if(identityDeath>0.&&cut<identityDeath)discard;
    diffuseColor*=vec4(ink,texel.a);
   #endif
  `);};material.customProgramCacheKey=()=> 'crusaders-shadow-identity-v1';material.needsUpdate=true;}
  if(!v.a.human)shader(v.sprite.material);
  const ghost=v.sprite.clone();ghost.material=v.sprite.material.clone();shader(ghost.material);ghost.visible=false;group.add(ghost);
  const aura=new T.Mesh(new T.PlaneGeometry(4.4,4.8),new T.ShaderMaterial({
   transparent:true,depthWrite:false,side:T.DoubleSide,
   uniforms:{clock:{value:0},enemy:{value:0}},
   vertexShader:'varying vec2 uvAura; void main(){uvAura=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 uvAura; uniform float clock; uniform float enemy;
    void main(){vec2 p=(uvAura-.5)*2.;float a=atan(p.y,p.x);
     float edge=length(p)+.055*sin(a*7.+clock*2.)+.04*sin(a*11.-clock*3.);
     float mist=(1.-smoothstep(.45,.96,edge))*(.65+.22*sin(a*5.+clock));
     vec3 c=mix(vec3(.34,1.,.85),vec3(.035,.006,.075),enemy);
     gl_FragColor=vec4(c,mist*mix(.23,.65,enemy));}`
  }));aura.name='Persistent team aura';aura.position.y=1.25;aura.renderOrder=-1;v.group.add(aura);
  const badge=new T.Mesh(friendlyBadge,new T.MeshBasicMaterial({color:0x80eee2,side:T.DoubleSide,depthWrite:false}));badge.position.y=3.12;v.group.add(badge);
  const beam=new T.Mesh(new T.CylinderGeometry(.12,1.1,18,8,1,true),new T.MeshBasicMaterial({color:0xbfffee,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));beam.visible=false;group.add(beam);
  const halo=new T.Mesh(new T.RingGeometry(.9,1.12,24),new T.MeshBasicMaterial({color:0xbfffee,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.visible=false;group.add(halo);
  return {v,uniforms,aura,ghost,badge,beam,halo,seen:false,entered:-99,deathAt:-99,spawnAt:-99,deathPosition:new T.Vector3(),spawnPosition:new T.Vector3(),enemy:false};
 });
 function reset(){particles.count=0;for(const r of records){r.seen=false;r.entered=r.deathAt=r.spawnAt=-99;r.aura.visible=r.ghost.visible=r.beam.visible=r.halo.visible=false;r.uniforms.identityDeath.value=r.uniforms.identityGlitch.value=r.uniforms.identityShadow.value=0;}}
 function event(e){const r=records.find(r=>r.v.a.id===e.actor);if(!r)return;const s=r.v.a.state;
  if(e.type==='down'){r.spawnAt=-99;r.deathAt=e.time;r.deathPosition.set(s.x,s.y+(s.flight?.7:0),s.z);r.ghost.material.map=r.v.sprite.material.map;r.ghost.position.copy(r.deathPosition);}
  if(e.type==='respawn'){r.deathAt=-99;r.spawnAt=e.time;r.spawnPosition.set(s.x,s.y,s.z);r.entered=e.time;}
 }
 function shard(p,i,age,strength,enemy){if(particles.count>=384)return;const phase=i*2.399,spread=.7+age*1.8;dummy.position.set(p.x+Math.cos(phase)*spread,p.y+.15+(i%7)*.32+age*.7,p.z+Math.sin(phase)*spread*.45);dummy.rotation.set(0,phase,0);dummy.scale.set((.08+(i%3)*.1)*strength,.04*strength,.06*strength);dummy.updateMatrix();particles.setMatrixAt(particles.count,dummy.matrix);particles.setColorAt(particles.count++,color.set(i%3===0?0xc9fff7:enemy?0xda79bd:0x80eee2));}
 function update(time){
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));particles.count=0;
  for(const r of records){if(r.v.a.enabled===false){r.aura.visible=r.ghost.visible=r.beam.visible=r.halo.visible=false;continue;}const {v,uniforms:u}=r,s=v.a.state,enemy=v.a.team!==viewerTeam(),visible=v.a.alive&&frustum.containsPoint(point.set(s.x,s.y+1,s.z));r.enemy=enemy;
   if(visible&&!r.seen)r.entered=time;r.seen=visible;const entry=Math.max(0,Math.min(1,(time-r.entered)/.65)),death=time-r.deathAt,spawn=time-r.spawnAt,dying=death>=0&&death<.85,spawning=spawn>=0&&spawn<1.3;
   u.identityTime.value=time;u.identityShadow.value=enemy?(visible?entry:1):0;u.identityGlitch.value=dying?1:enemy&&visible?Math.max(0,1-entry):0;u.identityDeath.value=dying?death/.85:0;
   r.aura.visible=v.a.alive;r.aura.quaternion.copy(camera.quaternion);r.aura.material.uniforms.clock.value=time;r.aura.material.uniforms.enemy.value=enemy?1:0;
   r.badge.quaternion.copy(camera.quaternion);r.badge.material.color.set(enemy?0xf58bbb:0x80eee2);r.badge.geometry=enemy?hostileBadge:friendlyBadge;
   r.ghost.visible=dying;r.ghost.position.copy(r.deathPosition);r.ghost.position.x+=dying?Math.sin(Math.floor(time*12)*4)*.12*(1-death/.85):0;
   if(dying&&frustum.containsPoint(r.deathPosition))for(let i=0;i<16;i++)shard(r.deathPosition,i,death,1-death/.85,enemy);
   else if(enemy&&visible){const amount=entry<1?10:3;for(let i=0;i<amount;i++)shard(s,i+Math.floor(time*3)%5,.08+(i%3)*.03,entry<1?1:.5,true);}
   r.beam.visible=r.halo.visible=spawning;if(spawning){const fade=Math.sin(Math.PI*spawn/1.3);r.beam.position.copy(r.spawnPosition).add(new T.Vector3(0,9,0));r.beam.material.opacity=fade*.38;r.beam.material.color.set(enemy?0xf5bbec:0xbfffee);r.halo.position.copy(r.spawnPosition).add(new T.Vector3(0,.07,0));r.halo.scale.setScalar(1+spawn);r.halo.material.opacity=fade*.7;for(let i=0;i<6;i++)shard(r.spawnPosition,i,spawn,fade,enemy);}
  }
  particles.instanceMatrix.needsUpdate=true;if(particles.instanceColor)particles.instanceColor.needsUpdate=true;
 }

 return {event,update,reset,snapshot:()=>({particles:particles.count,capacity:384,actors:records.map(r=>({id:r.v.a.id,enemy:r.enemy,aura:r.aura.visible?(r.enemy?'dark':'glow'):'none',shadow:r.uniforms.identityShadow.value,glitch:r.uniforms.identityGlitch.value,death:r.ghost.visible,beam:r.beam.visible,onScreen:r.seen}))})};
}
