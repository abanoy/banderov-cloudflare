import * as T from '../vendor/three.module.js';

export function sky(){
 const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d'),data=ctx.createImageData(256,256),bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
 const stops=[[40,75,128],[102,161,183],[221,215,177]];
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const t=y/255,seg=t<.6?0:1,u=seg?t/.4-1.5:t/.6;for(let k=0;k<3;k++){const v=stops[seg][k]*(1-u)+stops[seg+1][k]*u;data.data[(y*256+x)*4+k]=Math.round(v/8+(bayer[(y%4)*4+x%4]/16-.5)*.7)*8;}data.data[(y*256+x)*4+3]=255;}ctx.putImageData(data,0,0);
 for(let i=0;i<16;i++){const x=(i*83)%290-20,y=74+(i*29)%160,w=28+(i*7)%40;ctx.fillStyle=i%2?'#c4d7d3':'#aecdd4';ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.lineTo(x-w*.22,y-3);ctx.lineTo(x-w*.12,y-6);ctx.lineTo(x+w*.19,y-6);ctx.lineTo(x+w*.29,y-3);ctx.lineTo(x+w*.45,y-2);ctx.lineTo(x+w*.6,y+2);ctx.lineTo(x-w*.5,y+2);ctx.fill();}
 const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.minFilter=t.magFilter=T.NearestFilter;t.generateMipmaps=false;return t;
}

export function retroRenderer(renderer){
 const target=new T.WebGLRenderTarget(1,1,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});target.texture.encoding=T.sRGBEncoding;
 const passScene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{frame:{value:target.texture},dither:{value:.55}},vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D frame;uniform float dither;varying vec2 uvScreen;
 float bayer(vec2 p){p=mod(floor(p),4.);float a=mod(p.x,2.)*2.+mod(p.y,2.)*3.;a=mod(a,4.);vec2 q=floor(p/2.);float b=mod(q.x*2.+q.y*3.,4.);return (a*4.+b+.5)/16.;}
 void main(){vec3 c=texture2D(frame,uvScreen).rgb;float n=(bayer(gl_FragCoord.xy)-.5)*dither;vec3 low=floor(clamp(c+n/31.,0.,1.)*31.+.5)/31.;gl_FragColor=vec4(mix(c,low,dither),1.);}`});
 passScene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
 return {material,render(scene,cam,width,height,ratio){renderer.setPixelRatio(ratio);if(renderer.domElement.width!==Math.floor(width*ratio)||renderer.domElement.height!==Math.floor(height*ratio))renderer.setSize(width,height,false);if(target.width!==renderer.domElement.width||target.height!==renderer.domElement.height)target.setSize(renderer.domElement.width,renderer.domElement.height);renderer.setRenderTarget(target);renderer.render(scene,cam);renderer.setRenderTarget(null);renderer.render(passScene,camera);}};
}
