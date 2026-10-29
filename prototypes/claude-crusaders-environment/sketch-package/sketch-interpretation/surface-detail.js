import * as T from '../vendor/three.module.js';
// Seeded, code-drawn tiles. World projection gives consistent physical scale
// across extruded cliffs, curved roofs and differently sized instances.
export function surface(material,kind,scale=1){
 let seed=kind.split('').reduce((n,c)=>n+c.charCodeAt(0),17);const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
 c.fillStyle='#cbc8bd';c.fillRect(0,0,256,256);
 if(kind==='stone'||kind==='paving'){
  const h=kind==='stone'?32:64,w=kind==='stone'?64:64;
  c.fillStyle='#727773';c.fillRect(0,0,256,256);
  for(let row=0;row<256/h;row++)for(let col=-1;col<256/w+1;col++){
   const x=col*w+(row%2)*w/2,y=row*h,k=165+Math.floor(random()*35);
   c.fillStyle=`rgb(${k+12},${k+9},${k})`;c.fillRect(x+2,y+2,w-4,h-4);
   c.strokeStyle='rgba(255,250,225,.25)';c.strokeRect(x+3,y+3,w-6,h-6);
   if(random()<.3){c.strokeStyle='rgba(70,76,70,.4)';c.beginPath();c.moveTo(x+w*.35,y+2);c.lineTo(x+w*.44,y+h*.35);c.lineTo(x+w*.39,y+h*.62);c.stroke();}
  }
 }else if(kind==='rock'){
  c.fillStyle='#b5b3a0';c.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=16){c.strokeStyle=y%32?'#a09f92':'#858b80';c.lineWidth=y%32?2:4;c.beginPath();for(let x=0;x<=256;x+=8){const yy=y+Math.sin(x/256*Math.PI*4+y)*3;x?c.lineTo(x,yy):c.moveTo(x,yy);}c.stroke();}
 }else if(kind==='wood'){
  c.fillStyle='#c6b499';c.fillRect(0,0,256,256);
  for(let x=0;x<256;x+=32){c.fillStyle='#6f7063';c.fillRect(x,0,2,256);for(let j=0;j<5;j++){c.strokeStyle='rgba(80,73,61,.32)';c.beginPath();for(let y=0;y<=256;y+=8){const xx=x+6+j*4+Math.sin(y/256*Math.PI*2+j)*2;y?c.lineTo(xx,y):c.moveTo(xx,y);}c.stroke();}}
 }else if(kind==='roof'){
  c.fillStyle='#a4bdbd';c.fillRect(0,0,256,256);for(let y=-16;y<256;y+=32)for(let x=-32;x<288;x+=32){c.strokeStyle='#607f81';c.lineWidth=2;c.beginPath();c.arc(x+(Math.round(y/32)%2)*16,y,16,0,Math.PI);c.stroke();}
 }else{c.fillStyle='#aab8a0';c.fillRect(0,0,256,256);}
 for(let i=0;i<2000;i++){const a=.04+random()*.1;c.fillStyle=`rgba(${random()<.5?'40,50,42':'255,250,230'},${a})`;c.fillRect(random()*256,random()*256,1+random()*2,1+random()*2);}
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;
 const strength={value:.72};texture.userData={strength};
 material.onBeforeCompile=shader=>{
  shader.uniforms.authoredTile={value:texture};shader.uniforms.tileScale={value:scale};shader.uniforms.tileStrength=strength;
  shader.vertexShader='varying vec3 tileWorld; varying vec3 tileNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 tilePosition=vec4(transformed,1.0);
   vec3 tileN=objectNormal;
   #ifdef USE_INSTANCING
    tilePosition=instanceMatrix*tilePosition;tileN=mat3(instanceMatrix)*tileN;
   #endif
   tileWorld=(modelMatrix*tilePosition).xyz;tileNormal=normalize(mat3(modelMatrix)*tileN);
   #include <project_vertex>`);
  shader.fragmentShader='uniform sampler2D authoredTile; uniform float tileScale; uniform float tileStrength; varying vec3 tileWorld; varying vec3 tileNormal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 weights=pow(abs(normalize(tileNormal)),vec3(8.0));weights/=max(dot(weights,vec3(1.0)),.0001);
   vec3 tx=texture2D(authoredTile,tileWorld.zy*tileScale).rgb;
   vec3 ty=texture2D(authoredTile,tileWorld.xz*tileScale).rgb;
   vec3 tz=texture2D(authoredTile,tileWorld.xy*tileScale).rgb;
   diffuseColor.rgb*=mix(vec3(1.0),tx*weights.x+ty*weights.y+tz*weights.z,tileStrength);`);
 };
 material.customProgramCacheKey=()=>`authored-world-tile-${kind}`;return texture;
}
