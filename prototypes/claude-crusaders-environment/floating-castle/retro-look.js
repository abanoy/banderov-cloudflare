import * as T from '../vendor/three.module.js';
import {ownerChibi,ownerChibiClass} from './owner-billboard-art.js?v=aerie-20261018';
export function paletteLook(materials){
 const enabled={value:1},direction={value:new T.Vector3(-.45,.8,.6)},brightness={value:1},data=new Uint8Array(256*4);for(let i=0;i<256;i++){const t=i/255,c=new T.Color().setRGB(1*(1-t)+.36*t,.97*(1-t)+.4*t,.84*(1-t)+.66*t).convertSRGBToLinear();data.set([c.r*255,c.g*255,c.b*255,255],i*4);}
 const lookup=new T.DataTexture(data,256,1,T.RGBAFormat);lookup.minFilter=lookup.magFilter=T.NearestFilter;lookup.needsUpdate=true;
 for(const m of materials){const previous=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m);const previousKey=cache();m.onBeforeCompile=s=>{previous(s);s.uniforms.retroEnabled=enabled;s.uniforms.paletteDirection=direction;s.uniforms.paletteBrightness=brightness;s.uniforms.retroPalette={value:lookup};s.vertexShader='uniform vec3 paletteDirection; uniform sampler2D retroPalette; varying vec3 paletteTint;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`vec3 paletteKey=normalize((viewMatrix*vec4(paletteDirection,0.0)).xyz);
 float paletteIndex=clamp(.5-.5*dot(normalize(transformedNormal),paletteKey),0.0,1.0);
 paletteTint=texture2D(retroPalette,vec2((floor(paletteIndex*255.0)+.5)/256.0,.5)).rgb;
 #include <project_vertex>`);s.fragmentShader='uniform float paletteBrightness; uniform float retroEnabled; varying vec3 paletteTint;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );','outgoingLight=mix(outgoingLight,diffuseColor.rgb*paletteTint*paletteBrightness,retroEnabled);\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );');};m.customProgramCacheKey=()=>previousKey+'-authored-vertex-palette';}
 enabled.direction=direction;enabled.brightness=brightness;enabled.updatePalette=(warmth,shade)=>{for(let i=0;i<256;i++){const t=i/255,c=new T.Color().setRGB((1-t)+(.65-.29*shade)*t,(1-.03*warmth)*(1-t)+(.65-.25*shade)*t,(1-.16*warmth)*(1-t)+(.65+.01*shade)*t).convertSRGBToLinear();data.set([c.r*255,c.g*255,c.b*255,255],i*4);}lookup.needsUpdate=true;};
 return enabled;
}
async function chibiTexture(source){const node=new DOMParser().parseFromString(source,'text/html').querySelector('svg');node.setAttribute('width','260');node.setAttribute('height','266');const svg=new XMLSerializer().serializeToString(node),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));const img=new Image();img.src=url;try{await img.decode();}finally{URL.revokeObjectURL(url);}const canvas=document.createElement('canvas');canvas.width=260;canvas.height=266;canvas.getContext('2d').drawImage(img,0,0,260,266);const tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;tex.magFilter=T.NearestFilter;return tex;}
// Per-class owner billboards ([front,back], same size/filtering as billboard()); built once per class and shared.
const classMaps=new Map();
export function classBillboardMaps(classId){let p=classMaps.get(classId);if(!p){p=Promise.all([false,true].map(back=>chibiTexture(ownerChibiClass(classId,back))));p.catch(()=>classMaps.delete(classId));classMaps.set(classId,p);}return p;}
export async function billboard(){
 const maps=[];for(const back of [false,true])maps.push(await chibiTexture(ownerChibi(back)));
 const material=new T.SpriteMaterial({map:maps[0],alphaTest:.4,transparent:false,depthTest:true,depthWrite:true}),sprite=new T.Sprite(material);sprite.center.set(.5,0);sprite.scale.set(2.1*260/266,2.1,1);sprite.userData.maps=maps;return sprite;
}
