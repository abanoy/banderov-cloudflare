import * as T from '../vendor/three.module.js';

// Presentation only. Owner sprite maps, hitboxes, team membership and clocks stay intact. The death ghost takes the
// sprite's current map, size and anchor (classic billboard or Crusader chibi art).
// Feet on the floor: a character's feet sit at its physics foot point, but launch pads, steps and some floors are drawn a few
// centimetres higher, which hid the boots. Every character sprite gets a small view-space depth bias toward the camera: the
// camera is a true orthographic one, so this changes depth only (never where the sprite appears on screen) and stays far
// below the collision radius (.48 m), so walls in front of a character still hide it.
export const FEET_DEPTH_BIAS=.3;
const feetVertex=s=>{s.vertexShader=s.vertexShader.replace('gl_Position = projectionMatrix * mvPosition;','mvPosition.z+='+FEET_DEPTH_BIAS.toFixed(2)+';\n\tgl_Position = projectionMatrix * mvPosition;');};
// The local player's sprite (no identity shading): only the bias. Its own cache key, so it never shares a plain sprite program.
// Head line (screen height above the feet, in metres on the camera's up axis) where battle.js draws the bot health bar and this
// module stacks the team badge (+.332) and the YOU chevron (+.636). Classic billboards keep their 2.65 m bar across the hair top;
// the taller Crusader chibi (whose hat or helmet says its class) gets the bar just above its drawn top. World height = x sqrt 2
// under the 45 degree camera.
export const headLine=sprite=>sprite.userData.chibi?sprite.scale.y*(1-sprite.center.y)+.06:2.65*Math.SQRT1_2;
const standing=new WeakSet();
// spriteLod (material.userData.spriteLod, a uniform): a texture LOD bias chibi-actors.js sets while the sprite wears the Crusader
// chibi art (sharper mip choice at play zoom under pixelation 50); 0 keeps the classic billboard's sampling as it was.
const LOD_MAP='#ifdef USE_MAP\n\tvec4 texelColor = texture2D( map, vUv, spriteLod );\n\ttexelColor = mapTexelToLinear( texelColor );\n\tdiffuseColor *= texelColor;\n#endif';
export function standOnFloor(material){if(!material||standing.has(material))return material;standing.add(material);const before=material.onBeforeCompile,lod={value:0};material.userData.spriteLod=lod;
 material.onBeforeCompile=function(s,r){before.call(this,s,r);feetVertex(s);s.uniforms.spriteLod=lod;s.fragmentShader='uniform float spriteLod;\n'+s.fragmentShader.replace('#include <map_fragment>',LOD_MAP);};material.customProgramCacheKey=()=> 'crusaders-sprite-feet-v2';material.needsUpdate=true;return material;}
export function createBattleIdentity({root,views,camera,viewerTeam}){
 const group=new T.Group();group.name='Shadow identities and reconstruction';root.add(group);
 const up9=new T.Vector3(0,9,0),up07=new T.Vector3(0,.07,0),geometry=new T.BoxGeometry(1,1,1),particles=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({transparent:true,opacity:.8,depthWrite:false}),384),dummy=new T.Object3D(),color=new T.Color(),frustum=new T.Frustum(),matrix=new T.Matrix4(),point=new T.Vector3();particles.frustumCulled=false;particles.count=0;particles.visible=false;group.add(particles);
 // r128 compiles the instancing-colour switch only when instanceColor exists at first render, so allocate it up front.
 particles.instanceColor=new T.InstancedBufferAttribute(new Float32Array(384*3),3).setUsage(T.DynamicDrawUsage);
 const friendlyBadge=new T.CircleGeometry(.25,4),hostileBadge=new T.CircleGeometry(.28,3);hostileBadge.rotateZ(-Math.PI/2);
 // Local player only: gilt YOU ring + chevron (ally/enemy aura and badges stay as they were). Static under prefers-reduced-motion.
 const motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
 function youMarker(){const mark=new T.Group();mark.name='Local player YOU marker';const gold=new T.MeshBasicMaterial({color:0xffe29c,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false}),ink=new T.MeshBasicMaterial({color:0x231a2e,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false});
  const ring=new T.Mesh(new T.RingGeometry(1.08,1.5,40),gold);ring.rotation.x=-Math.PI/2;ring.position.y=.1;ring.renderOrder=2;const under=new T.Mesh(new T.RingGeometry(.92,1.66,40),ink);under.rotation.x=-Math.PI/2;under.position.y=.09;under.renderOrder=1;
  const ticks=new T.Group(),arc=new T.RingGeometry(1.82,2.12,8,1,-.32,.64);arc.rotateX(-Math.PI/2);for(let i=0;i<4;i++){const t=new T.Mesh(arc,gold);t.rotation.y=i*Math.PI/2+Math.PI/4;t.renderOrder=2;ticks.add(t);}ticks.position.y=.1;
  const shape=new T.Shape();shape.moveTo(-.62,.42);shape.lineTo(0,-.06);shape.lineTo(.62,.42);shape.lineTo(.62,.1);shape.lineTo(0,-.38);shape.lineTo(-.62,.1);shape.closePath();const chevronGeo=new T.ShapeGeometry(shape),top=new T.MeshBasicMaterial({color:0xffe29c,depthTest:false,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false}),edge=new T.MeshBasicMaterial({color:0x231a2e,depthTest:false,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false});
  const chevron=new T.Group(),face=new T.Mesh(chevronGeo,top),rim=new T.Mesh(chevronGeo,edge);rim.scale.setScalar(1.32);rim.position.set(0,.02,-.01);face.renderOrder=15;rim.renderOrder=14;chevron.add(rim,face);chevron.position.y=3.55;
  mark.add(under,ring,ticks,chevron);return {mark,ring,ticks,chevron,gold};}
 const records=views.map(v=>{
  const uniforms={identityTime:{value:0},identityShadow:{value:0},identityGlitch:{value:0},identityDeath:{value:0},identityLod:{value:0}};
  function shader(material){material.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);feetVertex(s);s.fragmentShader='uniform float identityTime; uniform float identityShadow; uniform float identityGlitch; uniform float identityDeath; uniform float identityLod;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec2 uv=vUv;
    float row=floor(uv.y*22.0);
    float noise=fract(sin(row*37.7+floor(identityTime*9.0)*13.1)*43758.5453);
    uv.x+=(noise-.5)*.15*identityGlitch*step(.65,noise);
    vec4 texel=texture2D(map,uv,identityLod);
    float edge=max(max(texture2D(map,uv+vec2(.03,0.),identityLod).a,texture2D(map,uv-vec2(.03,0.),identityLod).a),max(texture2D(map,uv+vec2(0.,.022),identityLod).a,texture2D(map,uv-vec2(0.,.022),identityLod).a));
    vec3 original=mapTexelToLinear(texel).rgb;
    vec3 shadow=mix(vec3(.025,.012,.055),vec3(.085,.035,.14),uv.y);
    vec3 ink=mix(original,shadow,identityShadow);
    ink=mix(ink,vec3(.64,.23,.52),step(.84,noise)*identityGlitch*.65);
    if(texel.a<.4&&edge>.5&&identityShadow>.05){texel.a=edge;ink=vec3(1.,.42,.74)*identityShadow;}
    float cut=fract(sin(floor(uv.x*18.)*17.1+row*91.7)*43758.5453);
    if(identityDeath>0.&&cut<identityDeath)discard;
    diffuseColor*=vec4(ink,texel.a);
   #endif
  `);};material.customProgramCacheKey=()=> 'crusaders-shadow-identity-v3';material.userData.spriteLod=uniforms.identityLod;material.needsUpdate=true;}
  if(!v.a.human)shader(v.sprite.material);else standOnFloor(v.sprite.material);
  const ghost=v.sprite.clone();ghost.material=v.sprite.material.clone();shader(ghost.material);ghost.visible=false;group.add(ghost);
  const aura=new T.Mesh(new T.PlaneGeometry(4.4,4.8),new T.ShaderMaterial({
   transparent:true,depthWrite:false,side:T.DoubleSide,
   uniforms:{clock:{value:0},enemy:{value:0}},
   vertexShader:'varying vec2 uvAura; uniform float enemy; void main(){uvAura=uv;vec4 mv=modelViewMatrix*vec4(position,1.);mv.z-=.7*(1.-enemy);gl_Position=projectionMatrix*mv;}',// the ally glow sits behind its sprite (the enemy veil stays in front)
   fragmentShader:`varying vec2 uvAura; uniform float clock; uniform float enemy;
    void main(){vec2 p=(uvAura-.5)*2.;float a=atan(p.y,p.x);
     float edge=length(p)+.055*sin(a*7.+clock*2.)+.04*sin(a*11.-clock*3.);
     float mist=(1.-smoothstep(.45,.96,edge))*(.65+.22*sin(a*5.+clock));
     vec3 c=mix(vec3(.34,1.,.85),vec3(.035,.006,.075),enemy);
     // Enemies keep the dark aura but gain a thin Dusk-pink rim so they read on dark (enemy-held) ground.
     float rim=enemy*smoothstep(.72,.78,edge)*(1.-smoothstep(.86,.92,edge));
     gl_FragColor=vec4(mix(c,vec3(1.,.62,.84),rim),max(mist*mix(.23,.65,enemy),rim*.88));}`
  }));aura.name='Persistent team aura';aura.position.y=1.25;aura.renderOrder=-1;v.group.add(aura);
  const badge=new T.Mesh(friendlyBadge,new T.MeshBasicMaterial({color:0x80eee2,side:T.DoubleSide,depthWrite:false}));badge.position.y=3.12;/* classic height; update() stacks it on the sprite's head line (classic or chibi) */v.group.add(badge);
  const beam=new T.Mesh(new T.CylinderGeometry(.12,1.1,18,8,1,true),new T.MeshBasicMaterial({color:0xbfffee,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));beam.visible=false;group.add(beam);
  const halo=new T.Mesh(new T.RingGeometry(.9,1.12,24),new T.MeshBasicMaterial({color:0xbfffee,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.visible=false;group.add(halo);
  const you=v.a.human?youMarker():null;if(you)v.group.add(you.mark);
  return {v,uniforms,aura,ghost,badge,beam,halo,you,seen:false,entered:-99,deathAt:-99,spawnAt:-99,deathPosition:new T.Vector3(),spawnPosition:new T.Vector3(),enemy:false};
 });
 function reset(){particles.count=0;particles.visible=false;for(const r of records){if(r.you)r.you.mark.visible=false;r.seen=false;r.entered=r.deathAt=r.spawnAt=-99;r.aura.visible=r.ghost.visible=r.beam.visible=r.halo.visible=false;r.uniforms.identityDeath.value=r.uniforms.identityGlitch.value=r.uniforms.identityShadow.value=0;}}
 function event(e){const r=records.find(r=>r.v.a.id===e.actor);if(!r)return;const s=r.v.a.state;
  if(e.type==='down'){r.spawnAt=-99;r.deathAt=e.time;r.deathPosition.set(s.x,s.y+(s.flight?.7:0),s.z);r.ghost.material.map=r.v.sprite.material.map;r.uniforms.identityLod.value=r.v.sprite.material.userData.spriteLod?.value??0;r.ghost.scale.copy(r.v.sprite.scale);r.ghost.center.copy(r.v.sprite.center);r.ghost.position.copy(r.deathPosition);}
  if(e.type==='respawn'){r.deathAt=-99;r.spawnAt=e.time;r.spawnPosition.set(s.x,s.y,s.z);r.entered=e.time;}
 }
 function shard(p,i,age,strength,enemy){if(particles.count>=384)return;const phase=i*2.399,spread=.7+age*1.8;dummy.position.set(p.x+Math.cos(phase)*spread,p.y+.15+(i%7)*.32+age*.7,p.z+Math.sin(phase)*spread*.45);dummy.rotation.set(0,phase,0);dummy.scale.set((.08+(i%3)*.1)*strength,.04*strength,.06*strength);dummy.updateMatrix();particles.setMatrixAt(particles.count,dummy.matrix);particles.setColorAt(particles.count++,color.set(i%3===0?0xc9fff7:enemy?0xda79bd:0x80eee2));}
 function update(time){
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));particles.count=0;
  for(const r of records){if(r.v.a.enabled===false){r.aura.visible=r.ghost.visible=r.beam.visible=r.halo.visible=false;continue;}const {v,uniforms:u}=r,s=v.a.state,enemy=v.a.team!==viewerTeam(),visible=v.a.alive&&frustum.containsPoint(point.set(s.x,s.y+1,s.z));r.enemy=enemy;
   if(visible&&!r.seen)r.entered=time;r.seen=visible;const entry=Math.max(0,Math.min(1,(time-r.entered)/.65)),death=time-r.deathAt,spawn=time-r.spawnAt,dying=death>=0&&death<.85,spawning=spawn>=0&&spawn<1.3;
   u.identityTime.value=time;u.identityShadow.value=enemy?(visible?entry:1):0;u.identityGlitch.value=dying?1:enemy&&visible?Math.max(0,1-entry):0;u.identityDeath.value=dying?death/.85:0;
   r.aura.visible=v.a.alive;r.aura.quaternion.copy(camera.quaternion);r.aura.material.uniforms.clock.value=time;r.aura.material.uniforms.enemy.value=enemy?1:0;
   r.badge.quaternion.copy(camera.quaternion);const head=headLine(v.sprite);r.badge.position.y=(head+.332)*Math.SQRT2;r.badge.material.color.set(enemy?0xf58bbb:0x80eee2);r.badge.geometry=enemy?hostileBadge:friendlyBadge;
   if(r.you){const y=r.you,calm=motion?.matches===true;y.mark.visible=v.a.alive;r.badge.visible=false;y.chevron.quaternion.copy(camera.quaternion);y.chevron.position.y=(head+.636)*Math.SQRT2+(calm?0:.14*Math.sin(time*4.2));y.gold.opacity=calm?.95:.72+.28*(.5+.5*Math.sin(time*3.4));y.ticks.rotation.y=calm?0:time*.7;}
   r.ghost.visible=dying;r.ghost.position.copy(r.deathPosition);r.ghost.position.x+=dying?Math.sin(Math.floor(time*12)*4)*.12*(1-death/.85):0;
   if(dying&&frustum.containsPoint(r.deathPosition))for(let i=0;i<16;i++)shard(r.deathPosition,i,death,1-death/.85,enemy);
   else if(enemy&&visible){const amount=entry<1?10:3;for(let i=0;i<amount;i++)shard(s,i+Math.floor(time*3)%5,.08+(i%3)*.03,entry<1?1:.5,true);}
   r.beam.visible=r.halo.visible=spawning;if(spawning){const fade=Math.sin(Math.PI*spawn/1.3);r.beam.position.copy(r.spawnPosition).add(up9);r.beam.material.opacity=fade*.38;r.beam.material.color.set(enemy?0xf5bbec:0xbfffee);r.halo.position.copy(r.spawnPosition).add(up07);r.halo.scale.setScalar(1+spawn);r.halo.material.opacity=fade*.7;for(let i=0;i<6;i++)shard(r.spawnPosition,i,spawn,fade,enemy);}
  }
  particles.instanceMatrix.needsUpdate=true;particles.instanceColor.needsUpdate=true;particles.visible=particles.count>0;
 }

 return {event,update,reset,snapshot:()=>({particles:particles.count,capacity:384,actors:records.map(r=>({id:r.v.a.id,enemy:r.enemy,aura:r.aura.visible?(r.enemy?'dark':'glow'):'none',shadow:r.uniforms.identityShadow.value,glitch:r.uniforms.identityGlitch.value,death:r.ghost.visible,beam:r.beam.visible,onScreen:r.seen,you:!!r.you?.mark.visible}))})};
}
