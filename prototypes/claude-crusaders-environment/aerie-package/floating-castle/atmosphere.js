import * as T from '../vendor/three.module.js';

// Time-of-day sky presets. 'day' is the SA1 / Dreamcast-style day (2026-10-18): saturated azure sky over a pale
// horizon, sky-blue fog and clouds with lavender bases (the earlier day was navy -> teal -> cream with grey-teal fog).
// pair = suggested palette-pair ramps (lit/shade/add) for main.js adjust(); clouds = top/mid/base cloud tones.
// light = palette-pair PAIR_LIGHT per preset (linear: sky ambient fill, side and ground hemisphere tints, exposure,
// rim/back light; wall/top = the baked key's share of the sun on vertical faces and the sky share on tops, view = the
// camera-relative wall term, chroma = how much of the ramp's shade colour the shade keeps, bounce = warm ground bounce
// on walls and undersides), applied by world.js's sky listener; haze = sRGB colour the post pass layers below the islands.
export const SKY_PRESETS={
 day:{sky:[[30,84,186],[86,158,228],[214,236,250]],strips:['#d8eaf8','#bcd9f2'],fog:0x9ec9ee,hemi:[0xbfe0ff,0xb3907c],clouds:[[255,255,250],[230,240,252],[176,194,234]],lanterns:.35,smoke:0xf2f0ea,disc:null,pair:null,
  light:{ambient:[.12,.16,.32],side:[.8,.82,.95],ground:[.86,.7,.66],exposure:1.1,rim:[.1,.13,.22],wall:.45,top:.3,view:[-.15,-.2],chroma:.4,bounce:[.1,.07,.05]},haze:[150,168,226]},
 sunset:{sky:[[58,52,104],[214,128,112],[255,214,150]],strips:['#ffd2a8','#f0a99a'],fog:0xe8b49a,hemi:[0xffd2ad,0x6a4f86],clouds:[[255,228,184],[242,168,146],[150,112,158]],lanterns:.8,smoke:0xf2d2bc,disc:{kind:'sun',azimuth:-42,height:-.42,size:.13,color:[255,236,170],glow:[255,170,110]},pair:{lit:'#ffc58a',shade:'#7a5a9a',add:'#3a160a'},
  light:{ambient:[.2,.12,.16],side:[.94,.84,.94],ground:[.92,.68,.58],exposure:1.12,rim:[.3,.17,.15],wall:.45,top:.3,view:[-.15,-.2],chroma:.8,bounce:[.12,.06,.04]},haze:[196,140,170]},
 moon:{sky:[[14,20,48],[46,62,112],[120,132,170]],strips:['#5d6c9a','#4a5884'],fog:0x46557e,hemi:[0xa9b9e6,0x272d55],clouds:[[198,208,238],[122,138,184],[64,74,120]],lanterns:1,smoke:0x8d93b0,stars:true,disc:{kind:'moon',azimuth:36,height:.5,size:.11,color:[236,240,255],glow:[120,140,210]},pair:{lit:'#c9d6ff',shade:'#2e3a73',add:'#0a0d1f'},
  light:{ambient:[.04,.06,.14],side:[.84,.88,1],ground:[.62,.62,.82],exposure:1.08,rim:[.1,.14,.3],wall:.45,top:.3,view:[-.15,-.2],chroma:1,bounce:[.02,.02,.04]},haze:[52,62,112]}
};
function paintSky(c,preset){
 const ctx=c.getContext('2d'),data=ctx.createImageData(256,256),bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
 const stops=preset.sky;
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const t=y/255,seg=t<.6?0:1,u=seg?t/.4-1.5:t/.6;for(let k=0;k<3;k++){const v=stops[seg][k]*(1-u)+stops[seg+1][k]*u;data.data[(y*256+x)*4+k]=Math.round(v/8+(bayer[(y%4)*4+x%4]/16-.5)*.7)*8;}data.data[(y*256+x)*4+3]=255;}
 if(preset.stars)for(let i=0;i<70;i++){const x=(i*97+i*i*13)%256,y=(i*61+i*i*7)%150,o=(y*256+x)*4,v=i%5?150+i%3*30:235;data.data[o]=data.data[o+1]=v;data.data[o+2]=Math.min(255,v+20);}
 ctx.putImageData(data,0,0);
 for(let i=0;i<16;i++){const x=(i*83)%290-20,y=74+(i*29)%160,w=28+(i*7)%40;ctx.fillStyle=i%2?preset.strips[0]:preset.strips[1];ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.lineTo(x-w*.22,y-3);ctx.lineTo(x-w*.12,y-6);ctx.lineTo(x+w*.19,y-6);ctx.lineTo(x+w*.29,y-3);ctx.lineTo(x+w*.45,y-2);ctx.lineTo(x+w*.6,y+2);ctx.lineTo(x-w*.5,y+2);ctx.fill();}
}
export function sky(){
 const c=document.createElement('canvas');c.width=256;c.height=256;paintSky(c,SKY_PRESETS.day);
 const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.minFilter=t.magFilter=T.NearestFilter;t.generateMipmaps=false;t.userData={skyCanvas:c,skyPreset:'day'};return t;
}
// Repaints the same background canvas, fog colour and hemisphere colours, then notifies
// scene.userData.skyTint listeners (sky-layers.js cloud banks, lanterns, sun/moon disc).
// Lighting sliders are untouched; pass {pairs} (world.pairs) AFTER main.js adjust() to also apply preset.pair.
// The scene passed with {pairs} is the main game scene: activeSky() reports its preset name and live fog so other
// views (the Castle Workshop preview) can mirror the match sky/fog instead of always showing day.
let mainSky=null;
// Post-pass haze shared by every retroRenderer (the match and the Castle Workshop preview show the same preset).
const HAZE={color:{value:new T.Vector3(150/255,168/255,226/255)},amount:{value:.55}};
// Post grade level shared by every retroRenderer: 1 = the Dreamcast-style grade, 0 skips it (quality.js Performance).
export const POST_LOOK={grade:{value:1}};
export function activeSky(){return {name:mainSky?.userData.skyPreset||'day',fog:mainSky?.fog||null};}
export function applySkyPreset(name,{scene,hemi,pairs}={}){
 const preset=SKY_PRESETS[name]||SKY_PRESETS.day,key=SKY_PRESETS[name]?name:'day';if(!scene)return preset;if(pairs)mainSky=scene;
 const bg=scene.background;if(bg?.userData?.skyCanvas&&bg.userData.skyPreset!==key){paintSky(bg.userData.skyCanvas,preset);bg.userData.skyPreset=key;bg.needsUpdate=true;}
 scene.fog?.color.setHex(preset.fog);if(preset.haze)HAZE.color.value.set(preset.haze[0]/255,preset.haze[1]/255,preset.haze[2]/255);
 const light=hemi||scene.children.find(o=>o.isHemisphereLight);if(light){light.color.setHex(preset.hemi[0]);light.groundColor.setHex(preset.hemi[1]);}
 if(pairs&&preset.pair)for(const p of pairs)p.update(preset.pair.lit,preset.pair.shade,preset.pair.add);
 for(const listener of scene.userData.skyTint||[])try{listener(preset,key);}catch(e){console.warn('Sky tint listener failed:',e);}
 scene.userData.skyPreset=key;return preset;
}

export function retroRenderer(renderer,{measure=false}={}){
 const target=new T.WebGLRenderTarget(1,1,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});target.texture.encoding=T.sRGBEncoding;target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 const passScene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const logicalSize=new T.Vector2(),stats=measure?{}:null,screenToWorld=new T.Matrix4();
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,extensions:{derivatives:true},uniforms:{frame:{value:target.texture},dither:{value:.55},hazeRow:{value:new T.Vector4()},hazeW:{value:new T.Vector4(0,0,0,1)},hazeColor:HAZE.color,hazeAmount:HAZE.amount,grade:POST_LOOK.grade,depth:{value:target.depthTexture},resolution:{value:new T.Vector2(1,1)},inverseProjection:{value:new T.Matrix4()},contact:{value:.2},sunShadow:{value:0},shadowReach:{value:28},sunDirection:{value:new T.Vector3(-.45,.8,.6)},sunView:{value:new T.Vector3()},projection:{value:new T.Matrix4()}},vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D frame;uniform float dither;uniform sampler2D depth;uniform vec2 resolution;uniform mat4 inverseProjection;uniform float contact;uniform vec4 hazeRow;uniform vec4 hazeW;uniform vec3 hazeColor;uniform float hazeAmount;uniform float grade;varying vec2 uvScreen;
 // Reconstruct view space from the same low-resolution world depth. No geometry pass.
 vec3 viewPoint(vec2 uv,float z){vec4 p=inverseProjection*vec4(uv*2.-1.,z*2.-1.,1.);return p.xyz/p.w;}
 // A tap occludes when the visible surface there stands a little above this one (along its normal) and close by. The
 // height cap and the short reach keep tree crowns, fountain rims and awnings from darkening floor far from the contact.
 float occlusion(vec3 p,vec3 normal,vec2 offset){vec2 uv=uvScreen+offset/resolution;float z=texture2D(depth,uv).x;if(z>=.99999||any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;vec3 delta=viewPoint(uv,z)-p;float h=dot(delta,normal);return smoothstep(.18,.9,h)*(1.-smoothstep(2.5,6.,h))*(1.-smoothstep(1.,6.,length(delta)));}
 float bayer(vec2 p){p=mod(floor(p),4.);float a=mod(p.x,2.)*2.+mod(p.y,2.)*3.;a=mod(a,4.);vec2 q=floor(p/2.);float b=mod(q.x*2.+q.y*3.,4.);return (a*4.+b+.5)/16.;}
 // SA1-style contact: a soft warm-violet darkening where walls meet floors and under overhangs/props (visible depth
 // only, no cast shadows). Eight taps about 3 world units out, turned per pixel by the Bayer value so the 5-bit dither
 // hides the sampling instead of drawing rings. The Contact depth slider scales it linearly: the owner default 20
 // darkens a wall foot by about 12% (capped at 17%), 100 by about 40% (capped at 45%), before the grade (its contrast
 // takes the darkest wall feet to about 15% and 50% on screen); 0 skips the samples entirely.
 float contactShade(vec3 p,vec3 normal,float z,float turn){float pixelWorld=length(viewPoint(uvScreen+vec2(1./resolution.x,0.),z)-p);vec2 a=vec2(cos(turn),sin(turn))*clamp(3./max(.001,pixelWorld),1.5,10.),b=vec2(-a.y,a.x),c=(a+b)*1.2,d=(a-b)*1.2;
  float ao=occlusion(p,normal,a)+occlusion(p,normal,-a)+occlusion(p,normal,b)+occlusion(p,normal,-b)+occlusion(p,normal,c)+occlusion(p,normal,-c)+occlusion(p,normal,d)+occlusion(p,normal,-d);return min(.1+.35*contact,ao*.225*contact);}
 void main(){vec3 c=texture2D(frame,uvScreen).rgb;float z=texture2D(depth,uvScreen).x,n=bayer(gl_FragCoord.xy);
  // derivatives stay in uniform control flow (contact is a uniform); sky pixels then skip the taps
  if(contact>0.){vec3 p=viewPoint(uvScreen,z),normal=normalize(cross(dFdx(p),dFdy(p))+vec3(0.,0.,1e-6));if(normal.z<0.)normal=-normal;if(z<.99999)c*=1.-contactShade(p,normal,z,n*1.5708)*vec3(.96,1.04,.72);}
  // Height haze: everything below the ring (keel, hanging island rock, the cloud sea) recedes into the sky's blue-violet.
  // World height comes straight from screen position and depth (rows set per frame on the CPU), no per-pixel matrices.
  vec4 s=vec4(uvScreen,z,1.);if(z<.99999)c=mix(c,hazeColor,(1.-smoothstep(-130.,-4.,dot(s,hazeRow)/dot(s,hazeW)))*hazeAmount);
  // Dreamcast-style grade before the 5-bit dither: richer saturation, a gentle S-curve, cool shadows, warm highlights.
  if(grade>0.){float l=dot(c,vec3(.299,.587,.114));c=clamp(mix(vec3(l),c,1.+.18*grade),0.,1.);c=mix(c,c*c*(3.-2.*c),.26*grade);c=clamp(c+grade*(vec3(-.008,-.003,.014)*(1.-smoothstep(.12,.5,l))+vec3(.018,.01,-.015)*smoothstep(.62,1.,l)),0.,1.);}
  vec3 low=floor(clamp(c+(n-.5)*dither/31.,0.,1.)*31.+.5)/31.;gl_FragColor=vec4(mix(c,low,dither),1.);}`});
 passScene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
 // World height of a screen point (u,v,depth) = dot(row,(u,v,z,1))/dot(w,(u,v,z,1)): rows 1 and 3 of
 // cameraWorld * inverseProjection, folded with the uv/depth to NDC mapping (exact for orthographic and perspective).
 const fold=(out,e,i)=>out.set(2*e[i],2*e[4+i],2*e[8+i],e[12+i]-e[i]-e[4+i]-e[8+i]);
 return {material,stats,render(scene,cam,width,height,ratio){renderer.getSize(logicalSize);if(renderer.getPixelRatio()!==ratio||logicalSize.x!==width||logicalSize.y!==height||renderer.domElement.width!==Math.floor(width*ratio)||renderer.domElement.height!==Math.floor(height*ratio))renderer.setDrawingBufferSize(width,height,ratio);if(target.width!==renderer.domElement.width||target.height!==renderer.domElement.height)target.setSize(renderer.domElement.width,renderer.domElement.height);const u=material.uniforms;u.resolution.value.set(target.width,target.height);u.inverseProjection.value.copy(cam.projectionMatrixInverse);u.projection.value.copy(cam.projectionMatrix);screenToWorld.multiplyMatrices(cam.matrixWorld,cam.projectionMatrixInverse);fold(u.hazeRow.value,screenToWorld.elements,1);fold(u.hazeW.value,screenToWorld.elements,3);u.sunView.value.copy(u.sunDirection.value).transformDirection(cam.matrixWorldInverse);renderer.setRenderTarget(target);renderer.render(scene,cam);if(stats){stats.worldCalls=renderer.info.render.calls;stats.worldTriangles=renderer.info.render.triangles;stats.width=target.width;stats.height=target.height;}renderer.setRenderTarget(null);renderer.render(passScene,camera);if(stats)stats.postCalls=renderer.info.render.calls;}};
}
