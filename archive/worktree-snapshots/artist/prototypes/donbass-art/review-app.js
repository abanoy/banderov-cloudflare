'use strict';
// Focused review uses canonical geometry; the optional neckline helper is explicit.
const byId=id=>document.getElementById(id),directionLabels=['Front','Front-right','Right','Back-right','Back','Back-left','Left','Front-left'];
const originalDrawings={
 sailor:{file:'research/newcanvas3-construction-crop.png',headAnchor:{left:36,right:2230,cropWidth:2260},note:'Your unchanged NewCanvas3 construction crop. Its original head is flatter; the draft uses your chosen round circle. Its colours remain untouched.'},
 twoMarias:{file:'references/TheTwoMarias.png',note:'Your complete The Two Marias artwork. Brown chibi and teal Maria are separate characters here; the teal turnaround remains provisional.'},
 blouse:{file:'references/Teaser.png',note:'Your complete Teaser artwork supplies the white blouse and an acting expression. It is not a neutral or rear turnaround.'}
};
let reviewAngle=0;
function reviewCharacter(){const key=byId('reviewCharacter').value,c={...STUDY_CHARS[key],pose:byId('reviewPose').value,expression:byId('reviewExpression').value,paint:'flat',headScaleX:1,headScaleY:1};if(key==='mariaBrown'){c.outfit=byId('reviewOutfit').value;c.bodyScaleX=1;}return chibiBodyConstructionStudy(chibiBlouseNeckStudy(c,byId('reviewNeckline').value),byId('bodyConstruction').value);}
function reviewSVG(angle){return chibi8SVG(reviewCharacter(),angle/45);}
function frameOriginal(){const ref=originalDrawings[byId('reviewReference').value],image=byId('reviewOriginal'),rim=byId('reviewLarge').querySelector('[data-piece="circle-edge"]'),toggle=byId('reviewMatchHead');
 const eligible=byId('reviewCharacter').value==='mariaBrown'&&ref.headAnchor&&rim;
 toggle.disabled=!eligible;image.style.removeProperty('width');image.style.removeProperty('height');let matched=false;
 if(eligible&&toggle.checked&&image.naturalWidth===ref.headAnchor.cropWidth){const panel=image.parentElement,headWidth=rim.getBoundingClientRect().width,anchorWidth=ref.headAnchor.right-ref.headAnchor.left;
  const availableWidth=Math.min(panel.clientWidth-24,(panel.clientHeight-24)*image.naturalWidth/image.naturalHeight),desiredWidth=headWidth*image.naturalWidth/anchorWidth;
  image.style.width=Math.min(desiredWidth,availableWidth)+'px';image.style.height='auto';matched=true;
 }
 byId('reviewReferenceNote').textContent=(matched?'Approximate colour-head-width match. ':'')+ref.note;
}
function showOriginal(){const ref=originalDrawings[byId('reviewReference').value];byId('reviewOriginal').src=ref.file;frameOriginal();}
function updateView(){byId('reviewLarge').innerHTML=reviewSVG(reviewAngle);byId('reviewFacing').textContent=(reviewAngle%45===0?directionLabels[reviewAngle/45]:'Between views')+' · '+reviewAngle+'°';byId('reviewAngle').value=String(reviewAngle);for(const button of byId('reviewDirections').children)button.setAttribute('aria-pressed',String(Number(button.dataset.degrees)===reviewAngle));byId('reviewSizes').innerHTML=[32,48,64,96].map(height=>'<div class="sample">'+reviewSVG(reviewAngle).replace('<svg ','<svg style="height:'+height+'px" ')+'<span>'+height+' px</span></div>').join('');frameOriginal();}
function updateCharacter(){const teal=byId('reviewCharacter').value==='mariaTeal';byId('bodyConstruction').disabled=teal;byId('reviewOutfit').disabled=teal;byId('reviewPose').querySelector('option[value="alarmed"]').disabled=teal;if(teal&&byId('reviewPose').value==='alarmed')byId('reviewPose').value='relaxed';byId('reviewNeckline').disabled=teal||byId('reviewOutfit').value!=='whiteBlouse';byId('reviewDraftNote').textContent=teal?'Teal Maria is a separate, provisional study.':'2018 brown Maria · round circle head at 100% · flat colours. Side and rear details are inferred.'+(byId('reviewPose').value==='alarmed'?' Tilted pose adapted from Teaser; the circle head changes its proportions.':'')+(!byId('reviewNeckline').disabled&&byId('reviewNeckline').value!=='current'?' Optional angled neckline; previous remains the default.':'');if(!teal&&byId('bodyConstruction').value!=='current')byId('reviewDraftNote').textContent+=' Optional '+byId('bodyConstruction').selectedOptions[0].textContent.toLowerCase()+' body; current remains selectable.';byId('reviewDirections').replaceChildren();for(let i=0;i<8;i++){const button=document.createElement('button');button.dataset.degrees=String(i*45);button.setAttribute('aria-label','Face '+directionLabels[i]);button.innerHTML=reviewSVG(i*45)+'<span>'+directionLabels[i]+'</span>';button.onclick=()=>{reviewAngle=i*45;updateView();};byId('reviewDirections').append(button);}updateView();}
byId('reviewCharacter').onchange=()=>{reviewAngle=0;byId('reviewReference').value=byId('reviewCharacter').value==='mariaTeal'?'twoMarias':byId('reviewOutfit').value==='sailor'?'sailor':'blouse';showOriginal();updateCharacter();};
byId('reviewOutfit').onchange=()=>{byId('reviewReference').value=byId('reviewOutfit').value==='sailor'?'sailor':'blouse';showOriginal();updateCharacter();};byId('reviewExpression').onchange=updateCharacter;byId('reviewReference').onchange=showOriginal;
byId('bodyConstruction').onchange=updateCharacter;byId('reviewPose').onchange=updateCharacter;byId('reviewNeckline').onchange=updateCharacter;
byId('reviewAngle').oninput=()=>{reviewAngle=Number(byId('reviewAngle').value);updateView();};
byId('reviewPrevious').onclick=()=>{reviewAngle=(Math.ceil(reviewAngle/45)*45+315)%360;updateView();};byId('reviewNext').onclick=()=>{reviewAngle=(Math.floor(reviewAngle/45)*45+45)%360;updateView();};byId('reviewFront').onclick=()=>{reviewAngle=0;updateView();};
byId('reviewMatchHead').onchange=frameOriginal;byId('reviewOriginal').onload=frameOriginal;window.addEventListener('resize',frameOriginal);
showOriginal();updateCharacter();
