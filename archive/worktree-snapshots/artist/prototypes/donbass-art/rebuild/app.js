import {coatChibiSVG,COAT_LAD} from './coat-chibi.js';
import {proportionComparison} from './proportion-comparison.js';
import {chibi8SVG as beforeCover} from './review/before-compact-oval/chibi8.js';
import {chibi8SVG,MARIA,DIRECTIONS} from './chibi8.js';
import {visiblePixelBounds} from '../visible-figure.js';
const $=id=>document.getElementById(id);let angle=0,spin=false,last=0;
let inspectionToken=0,brownOutfit='whiteBlouse';
const frame=(svg,height)=>{const bounds=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);return svg.replace(/^<svg\b[^>]*>/,root=>root.replace(/\swidth="[\d.]+"|\sheight="[\d.]+"/g,'').replace('<svg ',`<svg width="${height*bounds[2]/bounds[3]}" height="${height}" `));};
async function fitInspection(svg){
 const bounds=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number),height=384,width=Math.round(height*bounds[2]/bounds[3]);
 const url=URL.createObjectURL(new Blob([frame(svg,height)],{type:'image/svg+xml'}));
 try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,width,height);const box=visiblePixelBounds(ctx.getImageData(0,0,width,height).data,width,height);const k=bounds[3]/height;
 return svg.replace(/viewBox="[^"]+"/,`viewBox="${bounds[0]+box.left*k-1} ${bounds[1]+box.top*k-1} ${box.width*k+2} ${box.height*k+2}"`);
 }finally{URL.revokeObjectURL(url);}
}
export const character=()=>({...MARIA,outfit:$('outfit').value,expression:$('expression').value,pose:$('pose').value});
export function draw(index,walkPhase=0,walking=false,construction=false){return $('character').value==='coat'?coatChibiSVG({...COAT_LAD,expression:$('expression').value,walkPhase,walking,construction},index):$('character').value==='teal'?window.previousChibi8SVG({...window.previousChibiCharacters.mariaTeal,expression:$('expression').value,walkPhase},index):chibi8SVG({...character(),walkPhase,walking,construction},index);}
function previous(index){if($('character').value==='coat')return chibi8SVG({...MARIA,outfit:'whiteBlouse'},index);if($('character').value==='brown')return beforeCover(character(),index);return window.previousChibi8SVG({...window.previousChibiCharacters[$('character').value==='teal'?'mariaTeal':'mariaBrown'],outfit:$('outfit').value,expression:$('expression').value},index);}
function display(){let index=$('intermediate').checked?angle/45:Math.round(angle/45)%8;const current=draw(index,0,false,$('guides').checked),old=previous(index),token=++inspectionToken;$('hero').innerHTML=current;$('previous').innerHTML=old;Promise.all([fitInspection(current),fitInspection(old)]).then(([a,b])=>{if(token===inspectionToken){$('hero').innerHTML=a;$('previous').innerHTML=b;}}).catch(console.error);$('degrees').value=Math.round(angle)+'°';$('direction').textContent=DIRECTIONS[Math.round(index)%8];$('angle').value=angle;
 for(const b of $('views').children)b.setAttribute('aria-pressed',String(Number(b.dataset.index)===Math.round(index)%8));
 $('native').innerHTML=['light','dark'].map(theme=>'<div class="'+theme+'">'+[32,48,64].map(size=>'<figure>'+frame(draw(index),size)+`<figcaption>${size} px</figcaption></figure>`).join('')+'</div>').join('');
}
function refresh(){
 const isCoat=$('character').value==='coat';
 if(isCoat){if($('outfit').value!=='coat')brownOutfit=$('outfit').value;$('outfit').value='coat';$('referenceChoice').value='coat';}else{if($('outfit').value==='coat')$('outfit').value=brownOutfit;if($('referenceChoice').value==='coat')$('referenceChoice').value='costume';}
 $('outfit').disabled=$('pose').disabled=$('character').value!=='brown';
 $('guides').disabled=$('character').value==='teal';
 $('referenceChoice').disabled=isCoat;
 $('previousTitle').textContent=isCoat?'Maria · scale reference':'Previous fuller construction';
 $('previousCaption').textContent=isCoat?'Existing Maria, shown at matched visible height.':'Matched visible height; original geometry preserved.';
 $('studyNote').textContent=isCoat?'Eyepatch and long coat: based on the lower-left pencil drawing. Patch is on anatomical right. Brown hair, dark coat and patch follow your colour direction; exact shades, trim and unseen details are provisional.':'Flat colours, white outline and individually authored views. Brown Maria remains the current compact oval-head study.';
 $('measurement').hidden=$('character').value!=='brown';
 $('measurementFigures').innerHTML=proportionComparison(character());
 $('currentTitle').textContent=isCoat?'Eyepatch & long coat':$('character').value==='teal'?'Preserved teal study':'New construction';
 const guideFiles={target:'proportion-target.png',turnaround:'construction-turnaround.png',poses:'construction-poses.png',balance:'construction-balance.png'};
 const file=isCoat?'20260928_232429.jpg':guideFiles[$('referenceChoice').value]??($('referenceChoice').value==='cover'?'DonBassIdols_cover_800x800.png':$('character').value==='teal'?'TheTwoMarias.png':$('outfit').value==='sailor'?'NewCanvas3.png':$('outfit').value==='whiteBlouse'?'Teaser.png':'TheTwoMarias.png');
 $('reference').parentElement.classList.toggle('coat-reference',isCoat);
 $('reference').src='../references/'+file;$('referenceLink').href='../references/'+file;
 $('reference').parentElement.classList.toggle('full',file!=='NewCanvas3.png');
 $('reference').parentElement.classList.toggle('cover',file==='DonBassIdols_cover_800x800.png');
 $('views').innerHTML=DIRECTIONS.map((name,i)=>`<button class="view" data-index="${i}" aria-label="Face ${name}" aria-pressed="false">${draw(i,0,false,$('guides').checked)}<span>${name}</span></button>`).join('');
 for(const b of $('views').children)b.onclick=()=>{spin=false;$('spin').setAttribute('aria-pressed','false');$('spin').textContent='Rotate slowly';angle=Number(b.dataset.index)*45;display();};
 display();window.dispatchEvent(new Event('character-rebuilt'));
}
for(const id of ['character','outfit','expression','pose','referenceChoice','guides'])$(id).onchange=refresh;
$('angle').oninput=()=>{angle=Number($('angle').value);display();};$('intermediate').onchange=display;
$('prev').onclick=()=>{angle=(Math.round(angle/45)*45+315)%360;display();};$('next').onclick=()=>{angle=(Math.round(angle/45)*45+45)%360;display();};
$('spin').onclick=()=>{spin=!spin;$('spin').setAttribute('aria-pressed',String(spin));$('spin').textContent=spin?'Stop rotating':'Rotate slowly';};
$('download').onclick=()=>{const svg=draw($('intermediate').checked?angle/45:Math.round(angle/45)%8),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download=($('character').value==='coat'?'coat-study':'maria-rebuilt')+'-'+$('outfit').value+'-'+Math.round(angle)+'deg.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function tick(now){if(spin&&now-last>80){angle=(angle+2)%360;display();last=now;}requestAnimationFrame(tick);}refresh();requestAnimationFrame(tick);
import('./movement.js').catch(error=>{$('movementStatus').textContent='Movement preview unavailable: '+error.message;console.error(error);});
