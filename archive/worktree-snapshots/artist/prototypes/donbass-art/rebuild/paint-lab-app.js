import {paintLabSVG,LOOKS,MATERIALS,referenceSwatches} from './paint-lab.js';
import {DIRECTIONS} from './chibi8.js';
const $=id=>document.getElementById(id);let look='lacquer',direction=0,overrides={},loadSerial=0;
const labels={hair:'Hair',skin:'Skin',cloth:'Top',collar:'Collar',tie:'Tie',legs:'Legwear',shoes:'Shoes',iris:'Eyes'};
const options=()=>({look,direction,outfit:$('clothes').value,expression:$('face').value,strength:Number($('strength').value)/100,lightAngle:Number($('light').value),overrides});
const frame=(svg,h)=>svg.replace('width="160" height="294"',`width="${h*160/294}" height="${h}"`);
$('targetMaterial').innerHTML=MATERIALS.map(k=>`<option value="${k}">${labels[k]}</option>`).join('');
$('materialColors').innerHTML=MATERIALS.map(k=>`<label>${labels[k]}<input type="color" data-material="${k}" aria-label="${labels[k]} colour"></label>`).join('');
function render(){
 const o=options(),style=LOOKS[look];$('lookName').textContent=style.name;$('lookTag').textContent=style.tag;
 $('looks').innerHTML=Object.entries(LOOKS).map(([key,v])=>`<button class="look-card" data-look="${key}" aria-pressed="${look===key}" style="background:${v.paper}">${paintLabSVG({look:key,outfit:o.outfit,expression:o.expression})}<strong>${v.name}</strong><small>${v.tag}</small></button>`).join('');
 for(const b of $('looks').children){if(b.dataset.look==='neon')b.style.color='#f0e9f5';b.onclick=()=>{look=b.dataset.look;render();};}
 $('paintHero').innerHTML=paintLabSVG(o);$('paintHero').style.background=style.paper;
 $('paintNative').innerHTML=[32,48,64].map(h=>`<figure>${frame(paintLabSVG(o),h)}<figcaption>${h}px</figcaption></figure>`).join('');
 $('paintTurns').innerHTML=DIRECTIONS.map((name,i)=>`<button class="view" data-direction="${i}" aria-label="Face ${name}" aria-pressed="${i===direction}">${paintLabSVG({...o,direction:i})}<span>${name}</span></button>`).join('');
 for(const b of $('paintTurns').children)b.onclick=()=>{direction=Number(b.dataset.direction);render();};
 for(const e of $('materialColors').querySelectorAll('input'))e.value=overrides[e.dataset.material]??style.colors[e.dataset.material];
 $('strengthValue').value=$('strength').value+'%';$('lightValue').value=$('light').value+'°';
 const textured=['print','gouache'].includes(style.mode);$('light').disabled=textured;$('lightNote').textContent=textured?'This finish uses patterned ink; light direction does not affect it.':'Light is painted into these studies.';
 $('paintStatus').textContent=Object.keys(overrides).length?`Your colours applied to ${Object.keys(overrides).map(k=>labels[k].toLowerCase()).join(', ')}`:'Preset palette';
}
for(const id of ['clothes','face'])$(id).onchange=render;
for(const id of ['strength','light'])$(id).oninput=render;
for(const e of $('materialColors').querySelectorAll('input'))e.oninput=()=>{overrides[e.dataset.material]=e.value;render();};
$('resetColors').onclick=()=>{overrides={};render();};
function save(data,type,name){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('saveSvg').onclick=()=>save(paintLabSVG(options()),'image/svg+xml',`maria-${look}-${direction}.svg`);
$('savePng').onclick=async()=>{const selected=options(),url=URL.createObjectURL(new Blob([paintLabSVG(selected)],{type:'image/svg+xml'}));$('savePng').disabled=true;try{const image=new Image();image.src=url;await image.decode();const output=document.createElement('canvas');output.width=480;output.height=882;output.getContext('2d').drawImage(image,0,0,480,882);const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG unavailable');save(blob,'image/png',`maria-${selected.look}-${selected.direction}.png`);}catch{$('paintStatus').textContent='Could not export PNG; the SVG remains available.';}finally{URL.revokeObjectURL(url);$('savePng').disabled=false;}};
$('saveRecipe').onclick=()=>save(JSON.stringify({schema:'donbass-paint-lab-v1',...options(),resolvedColors:{...LOOKS[look].colors,...overrides}},null,2),'application/json',`maria-${look}-colours.json`);
function choose(hex){overrides[$('targetMaterial').value]=hex;render();}
const canvas=$('referenceCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),x=Math.min(canvas.width-1,Math.max(0,Math.floor((e.clientX-r.left)*canvas.width/r.width))),y=Math.min(canvas.height-1,Math.max(0,Math.floor((e.clientY-r.top)*canvas.height/r.height)));const pixel=ctx.getImageData(x,y,1,1).data;if(pixel[3]<180)return;choose('#'+[...pixel].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join(''));};
async function loadReference(url,label){const token=++loadSerial,image=new Image();image.src=url;await image.decode();if(token!==loadSerial)return;const scale=Math.min(1,500/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const swatches=referenceSwatches(ctx.getImageData(0,0,canvas.width,canvas.height).data);$('referenceSwatches').innerHTML=swatches.map(v=>`<button style="background:${v.hex}" data-color="${v.hex}" aria-label="Use ${v.hex}"><span>${v.hex}</span></button>`).join('');for(const b of $('referenceSwatches').children)b.onclick=()=>choose(b.dataset.color);$('referenceStatus').textContent=label+' · click the image to pick a colour';}
$('referenceFile').onchange=async()=>{const file=$('referenceFile').files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12000000){$('referenceStatus').textContent='Choose a PNG, JPEG or WebP under 12 MB.';return;}const url=URL.createObjectURL(file);try{await loadReference(url,file.name);}catch{$('referenceStatus').textContent='Could not read that image.';}finally{URL.revokeObjectURL(url);}};
render();loadReference('../references/Teaser.png','Maria · your Teaser reference').catch(()=>{$('referenceStatus').textContent='Choose a reference image to begin.';});
