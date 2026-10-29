import * as T from '../vendor/three.module.js';
// Editable, code-drawn sky. No imported artwork or changes to castle geometry.
export function skyBackdrop(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const c=canvas.getContext('2d');
 const top=new T.Color('#345f86'),bottom=new T.Color('#d9d3b1');for(let band=0;band<32;band++){c.fillStyle='#'+top.clone().lerp(bottom,band/31).getHexString();c.fillRect(0,band*32,1024,32);}
 let seed=1879;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let layer=0;layer<3;layer++)for(let i=0;i<12;i++){const x=random()*1200-100,y=260+layer*210+random()*100,w=80+random()*200,h=14+random()*30;c.fillStyle=['#a8bcc5','#c7d0ca','#e4dfc7'][layer];c.beginPath();c.moveTo(x-w*.55,y+h*.15);c.lineTo(x-w*.3,y-h*.2);c.lineTo(x-w*.14,y-h*.45);c.lineTo(x+w*.12,y-h*.45);c.lineTo(x+w*.23,y-h*.2);c.lineTo(x+w*.42,y-h*.12);c.lineTo(x+w*.6,y+h*.15);c.lineTo(x+w*.3,y+h*.3);c.lineTo(x-w*.3,y+h*.3);c.closePath();c.fill();}
 const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.magFilter=T.NearestFilter;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;return texture;
}
