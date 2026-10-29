import {colorStudySVG,PALETTES,TREATMENTS} from './color-studies.js';
import {DIRECTIONS} from './chibi8.js';
const $=id=>document.getElementById(id);
$('palette').innerHTML=Object.entries(PALETTES).map(([key,v])=>`<option value="${key}">${v.name}</option>`).join('');
$('direction').innerHTML=DIRECTIONS.map((v,i)=>`<option value="${i}">${v}</option>`).join('');
$('finish').innerHTML=Object.entries(TREATMENTS).map(([key,v])=>`<option value="${key}">${v.name}</option>`).join('');
const frame=(svg,h)=>svg.replace('width="160" height="294"',`width="${160*h/294}" height="${h}"`);
const drawing=(kind,palette=$('palette').value,direction=Number($('direction').value))=>colorStudySVG({outfit:$('outfit').value},direction,kind,palette);
function refresh(){
 $('studies').innerHTML=Object.entries(TREATMENTS).map(([key,v])=>`<article class="paint-card"><h2>${v.name}</h2><p>${v.note}</p><div class="paint-sample">${drawing(key)}</div><div class="tiny-samples">${[32,48,64].map(size=>`<figure>${frame(drawing(key),size)}<figcaption>${size}px</figcaption></figure>`).join('')}</div><button data-save="${key}">Save ${v.name.toLowerCase()} SVG</button></article>`).join('');
 $('turns').innerHTML=DIRECTIONS.map((name,i)=>`<button class="view" data-direction="${i}" aria-label="Inspect ${name}">${drawing($('finish').value,$('palette').value,i)}<span>${name}</span></button>`).join('');
 $('palettes').innerHTML=Object.entries(PALETTES).map(([key,v])=>`<button class="palette-option" data-palette="${key}" aria-pressed="${$('palette').value===key}">${drawing('flat',key)}<span>${v.name}<span class="swatches">${['hair','skin','cloth','collar','legs'].map(k=>`<i style="background:${v[k]}"></i>`).join('')}</span></span></button>`).join('');
 for(const b of document.querySelectorAll('[data-save]'))b.onclick=()=>{const url=URL.createObjectURL(new Blob([drawing(b.dataset.save)],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download=`maria-${$('palette').value}-${b.dataset.save}-${$('direction').value}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 for(const b of document.querySelectorAll('[data-direction]'))b.onclick=()=>{$('direction').value=b.dataset.direction;refresh();};
 for(const b of document.querySelectorAll('[data-palette]'))b.onclick=()=>{$('palette').value=b.dataset.palette;refresh();};
}
for(const id of ['palette','outfit','direction','finish'])$(id).onchange=refresh;
$('paper').onchange=()=>document.body.classList.toggle('dark',$('paper').value==='dark');refresh();
