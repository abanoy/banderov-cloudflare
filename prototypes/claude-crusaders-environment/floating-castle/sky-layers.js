import * as T from '../vendor/three.module.js';
// Depth layers around the floating islands: a low cloud sea far below the islands, a far
// cloud band at the horizon ring and an optional pixel sun/moon disc. Everything here is
// visual only (no solids, never in world.arena, so allegiance/cutaway passes skip it).
// Clouds are camera-facing instanced quads shaded procedurally: 3 tones, Bayer-dithered edges
// and tone steps in screen space, so they stay crisp pixel shapes at overview and follow zoom.
// Close zoom hides the sea clouds near the screen centre (cloudKeep): a cloud shrinks toward its base and only dissolves
// (whole-cloud screen door) in the last stretch. Eroding the lobe threshold instead left each lobe's core behind as a
// flat, pale, dithered disc high in the spawn view; a plain screen door left big checkered clouds there. The distance is
// measured in view space (the orthographic screen offset in world units, from the cloud's middle), not world xz: at 45
// degrees a cloud 150 units below the islands lands on screen behind a castle while it is 200+ units away horizontally,
// and kept full size it magnified into a big flat pale cut-out. The far band never fades (its own zoomFade stays 0).
// zoomFade is 1 up to a view height of 150 (every play zoom: 70, the 112 pod view, x1.3 on portrait screens) and 0 from 240.
const BAYER='float skyBayer(vec2 p){p=mod(floor(p),4.);float a=mod(p.x,2.)*2.+mod(p.y,2.)*3.;a=mod(a,4.);vec2 q=floor(p/2.);float b=mod(q.x*2.+q.y*3.,4.);return (a*4.+b+.5)/16.;}';
const cloudVertex=`attribute vec3 offset;attribute vec4 shape;uniform float zoomFade;varying vec2 cloudUv;varying vec2 cloudShape;varying float cloudFog;varying float cloudKeep;
void main(){vec4 centre=modelMatrix*vec4(offset,1.);vec4 mv=viewMatrix*centre;float near=1.-smoothstep(160.,230.,length(mv.xy+vec2(0.,shape.y*.5)));cloudKeep=1.-zoomFade*near;
 mv.xy+=position.xy*shape.xy*(.35+.65*cloudKeep);cloudUv=uv;cloudShape=shape.zw;cloudFog=-mv.z;gl_Position=cloudKeep<=0.?vec4(0.,0.,2.,1.):projectionMatrix*mv;}`;
const cloudFragment=`uniform vec3 top;uniform vec3 mid;uniform vec3 base;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;varying vec2 cloudUv;varying vec2 cloudShape;varying float cloudFog;varying float cloudKeep;${BAYER}
float hash(float n){return fract(sin(n)*43758.5453);}
void main(){float seed=cloudShape.x,d=0.,rel=0.;vec2 p=vec2(cloudUv.x*2.4,cloudUv.y);
 for(int i=0;i<5;i++){float f=float(i),x=.28+f*.46+(hash(seed*7.1+f)-.5)*.22,r=.2+hash(seed*3.7+f*1.3)*.17-abs(f-2.)*.035,y=.2+r*.62;vec2 q=(p-vec2(x,y))/vec2(r*1.3,r);float v=1.-length(q);if(v>d){d=v;rel=(p.y-(y-r))/(2.*r);}}
 float shelf=smoothstep(.04,.2,cloudUv.y),t=skyBayer(gl_FragCoord.xy);d*=shelf;
 if(d<.04+t*.16||t*.4>=cloudKeep)discard;
 float band=rel+(t-.5)*.16-(1.-shelf)*.4;vec3 c=band>.62?top:band>.34?mid:base;c*=cloudShape.y;
 gl_FragColor=vec4(mix(c,fogColor,smoothstep(fogNear,fogFar,cloudFog)),1.);}`;
const discFragment=`uniform vec3 color;uniform vec3 glow;uniform float moon;uniform float strength;varying vec2 discUv;${BAYER}
void main(){vec2 p=(discUv-.5)*2.;float r=length(p),t=skyBayer(gl_FragCoord.xy);if(r>1.)discard;
 vec3 c=color;float a;if(r<.42){a=1.;if(moon>.5){float crater=step(length(p-vec2(.12,.1)),.12)+step(length(p-vec2(-.14,-.12)),.08)+step(length(p-vec2(.05,-.22)),.05);c*=1.-.14*min(1.,crater);c=mix(c,glow,step(.36,length(p+vec2(.1,-.06)))*.35);}}
 else{a=pow(1.-(r-.42)/.58,2.)*.75;c=glow;if(r<.5)c=mix(color,glow,.5);}
 if(a*strength<=t)discard;gl_FragColor=vec4(c,1.);}`;
function rgb(c){return new T.Vector3(c[0]/255,c[1]/255,c[2]/255);}
export function createSkyLayers(scene,{seed=1}={}){
 const group=new T.Group();group.name='Sky layers (cloud sea, far band, sky disc)';group.userData.visualEffect=true;scene.add(group);
 const DAY=[[255,255,250],[230,240,252],[176,194,234]],colors={top:{value:rgb(DAY[0])},mid:{value:rgb(DAY[1])},base:{value:rgb(DAY[2])}};
 const forward=new T.Vector3();
 function bank(name,items,fade){const zoomFade={value:0};
  const plane=new T.PlaneGeometry(1,1);plane.translate(0,.5,0);const g=new T.InstancedBufferGeometry();g.index=plane.index;g.setAttribute('position',plane.attributes.position);g.setAttribute('uv',plane.attributes.uv);
  const offset=new Float32Array(items.length*3),shape=new Float32Array(items.length*4);items.forEach((c,i)=>{offset.set([c.x,c.y,c.z],i*3);shape.set([c.w,c.w/2.4,c.seed,c.tone],i*4);});
  g.setAttribute('offset',new T.InstancedBufferAttribute(offset,3));g.setAttribute('shape',new T.InstancedBufferAttribute(shape,4));g.instanceCount=items.length;
  const material=new T.ShaderMaterial({uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{}]),vertexShader:cloudVertex,fragmentShader:cloudFragment,fog:true});
  Object.assign(material.uniforms,colors,{zoomFade});
  const mesh=new T.Mesh(g,material);mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=-2;mesh.userData.visualEffect=true;
  if(fade)mesh.onBeforeRender=(renderer,s,camera)=>{zoomFade.value=camera.isOrthographicCamera?T.MathUtils.smoothstep(240-(camera.top-camera.bottom),0,90):0;};
  group.add(mesh);return mesh;
 }
 // Deterministic layout: golden-angle spirals, no Math.random so every boot looks the same.
 const sea=[],far=[];
 for(let i=0;i<64;i++){const a=i*2.399+seed,r=135+(i*53)%420,w=74+(i%5)*17+(i%3)*6;sea.push({x:Math.cos(a)*r,y:-96-(i%4)*15-(i%7)*2,z:Math.sin(a)*r,w,seed:i*1.37+seed,tone:.97-(i%4)*.035});}
 for(let i=0;i<30;i++){const a=i*2.399+.7+seed,r=560+(i*31)%150,w=120+(i%4)*26;far.push({x:Math.cos(a)*r,y:-44+(i%3)*24,z:Math.sin(a)*r,w,seed:40+i*2.11,tone:1-(i%3)*.03});}
 const seaMesh=bank('Cloud sea below the islands',sea,true),farMesh=bank('Far horizon cloud band',far,false);
 // Pixel sun / moon: positioned in camera space each frame (onBeforeRender) so Q/E rotation
 // slides it across the screen-locked sky. Hidden for the default day preset.
 const discUniforms={color:{value:new T.Vector3(1,1,1)},glow:{value:new T.Vector3(1,1,1)},moon:{value:0},strength:{value:1}};
 const disc=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({uniforms:discUniforms,depthWrite:false,vertexShader:'varying vec2 discUv;void main(){discUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:discFragment}));
 disc.name='Pixel sky disc';disc.frustumCulled=false;disc.renderOrder=-3;disc.visible=false;disc.userData.visualEffect=true;group.add(disc);
 let discInfo=null;const right=new T.Vector3(),up=new T.Vector3();
 disc.onBeforeRender=(renderer,s,camera)=>{if(!discInfo||!camera.isOrthographicCamera)return;camera.getWorldDirection(forward);const yaw=Math.atan2(-forward.x,-forward.z),rel=discInfo.azimuth*Math.PI/180-yaw,show=Math.cos(rel);discUniforms.strength.value=T.MathUtils.clamp(show*3,0,1);
  right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);const hw=(camera.right-camera.left)/2/camera.zoom,hh=(camera.top-camera.bottom)/2/camera.zoom,cx=(camera.right+camera.left)/2,cy=(camera.top+camera.bottom)/2;
  disc.position.copy(camera.position).addScaledVector(right,cx+Math.sin(rel)*.8*hw).addScaledVector(up,cy+discInfo.height*hh).addScaledVector(forward,camera.far*.97);disc.quaternion.copy(camera.quaternion);disc.scale.setScalar(discInfo.size*hh*2.4);disc.updateMatrixWorld();};
 function tint(preset){const c=preset?.clouds||DAY;colors.top.value.copy(rgb(c[0]));colors.mid.value.copy(rgb(c[1]));colors.base.value.copy(rgb(c[2]));
  discInfo=preset?.disc||null;disc.visible=!!discInfo;if(discInfo){discUniforms.color.value.copy(rgb(discInfo.color));discUniforms.glow.value.copy(rgb(discInfo.glow));discUniforms.moon.value=discInfo.kind==='moon'?1:0;}}
 (scene.userData.skyTint||(scene.userData.skyTint=[])).push(tint);
 function update(time){seaMesh.rotation.y=time*.0016;farMesh.rotation.y=-time*.0009;}
 return {group,sea:seaMesh,far:farMesh,disc,update,tint,counts:{sea:sea.length,far:far.length}};
}
