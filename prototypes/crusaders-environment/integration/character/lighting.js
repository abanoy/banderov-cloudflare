import * as T from '../vendor/three.module.js';
// Original authored colour ramps, modern approximation. No SA1 asset/source copy.
export const KEY=new T.Vector3(-.45,.65,1).normalize();
function palette(kind){const data=new Uint8Array(256*2*4);for(let i=0;i<256;i++){const t=i/255;let lit=kind==='character'?[1,.98,.91]:[.94,.97,1],dark=kind==='character'?[.46,.39,.61]:[.3,.39,.49];for(let c=0;c<3;c++){data[i*4+c]=Math.round(255*(lit[c]*(1-t)+dark[c]*t));data[(256+i)*4+c]=Math.round(255*(1-t)**9*(kind==='character'?.035:.018));}data[i*4+3]=data[(256+i)*4+3]=255;}let tex=new T.DataTexture(data,256,2,T.RGBAFormat);tex.minFilter=tex.magFilter=T.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;return tex;}
export function createLightingBank(kind='character'){
 const lookup=palette(kind),bands=new T.DataTexture(new Uint8Array([90,90,90,145,145,145,200,200,200,255,255,255]),4,1,T.RGBFormat);bands.minFilter=bands.magFilter=T.NearestFilter;bands.generateMipmaps=false;bands.needsUpdate=true;
 const owned=[];function variants(base){const toon=new T.MeshToonMaterial({color:base.color,gradientMap:bands});
 const retro=new T.ShaderMaterial({uniforms:{baseColor:{value:base.color.clone()},palette:{value:lookup},key:{value:KEY.clone()}},vertexShader:`uniform sampler2D palette;uniform vec3 key;varying vec3 diffuseTint;varying vec3 additiveTint;
void main(){vec3 n=normalize(normalMatrix*normal);vec3 l=normalize((viewMatrix*vec4(key,0.0)).xyz);float u=clamp(1.0-(dot(n,l)+1.0)*0.5,0.0,1.0);u=(floor(u*255.0)+0.5)/256.0;diffuseTint=texture2D(palette,vec2(u,.25)).rgb;additiveTint=texture2D(palette,vec2(u,.75)).rgb;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
 fragmentShader:`uniform vec3 baseColor;varying vec3 diffuseTint;varying vec3 additiveTint;void main(){gl_FragColor=vec4(baseColor*diffuseTint+additiveTint,1.0);}`});owned.push(toon,retro);return {flat:base,toon,retro};}
 return {variants,textureBytes:2060,dispose(){owned.forEach(m=>m.dispose());lookup.dispose();bands.dispose();},setLight(direction){owned.forEach(m=>{if(m.uniforms)m.uniforms.key.value.copy(direction).normalize();});}};
}
