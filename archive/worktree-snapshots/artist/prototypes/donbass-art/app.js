'use strict';
const $=id=>document.getElementById(id);
const labels=['Front','Front-R','Right','Back-R','Back','Back-L','Left','Front-L'];
let yaw=0, playing=false, lastTime=0;
function selectedDrawing(){const key=$('character').value, archived=$('version').value==='archive',projected=$('version').value==='projected';
 const chars=projected?PROJECTED_STUDY.STUDY_CHARS:STUDY_CHARS;
 const c={...(archived?CHARS8R[key==='unimpressed'?'unimpressed':'maria']:chars[key]),expression:$('expression').value,pose:$('pose').value,paint:$('paint').value};
 if(!archived&&key!=='unimpressed')c.cos=$('costume').value==='wizard'?'wizard':STUDY_CHARS[key].cos;
 if(!archived&&!projected&&key==='mariaBrown')c.outfit=$('costume').value;
 if(!archived&&!projected&&key==='mariaBrown')c.bodyScaleX=Number($('bodyWidth').value);
 if(!archived&&!projected&&key==='mariaBrown'&&c.outfit==='sailor'&&$('collarPlacement').value!=='14'){c.geometry=JSON.parse(JSON.stringify(BROWN_MARIA_GEOMETRY));c.geometry.outfits.sailor.bodyOffset=Number($('collarPlacement').value);}
 if(!archived&&!projected)c.headForm=$('headForm').value;
 // Frozen paper steps use the same cycle fractions as the courtyard cache.
 if(!archived&&!projected&&['mariaBrown','mariaTeal'].includes(key))c.walkPhase=Number($('paperStep').value);
 if(!archived&&!projected&&key==='mariaBrown')c.faceForm=$('faceForm').value;
 if(!archived&&!projected&&key==='mariaBrown')c.circleSleepyLids=$('lidShape').value==='curved';
 if(!archived&&key==='mariaBrown'){
  c.lineWeight=Number($('inkStudy').value);
  if($('headStudy').value==='wide'){c.headScaleX=1.08;c.headScaleY=.90;}
  if($('headStudy').value==='tall'){c.headScaleX=1;c.headScaleY=1.02;}
  if($('headStudy').value==='custom'){c.headScaleX=Number($('headWidth').value);c.headScaleY=Number($('headHeight').value);}
 }
 return {c:!archived&&!projected&&key==='mariaBrown'?chibiBodyConstructionStudy(chibiBlouseNeckStudy(chibiEyeStudy(c,$('eyeOpeningStudy').value),$('blouseNeckline').value),$('bodyConstruction').value):c,archived,projected};}
function svg(angle){const {c,archived,projected}=selectedDrawing();return (archived?chibi8rSVG:projected?PROJECTED_STUDY.chibi8SVG:chibi8SVG)(c,angle/45);}
// Inspection framing changes only the large comparison views. Gameplay samples
// and full-body direction sheets retain the character's original bounds.
function constructionGuide(drawing){
 if(!$('headGuide').checked||$('headGuide').disabled)return drawing;
 const geometry=$('character').value==='mariaTeal'?TEAL_MARIA_GEOMETRY:BROWN_MARIA_GEOMETRY;
 const outfit=$('character').value==='mariaBrown'?$('costume').value:undefined;
 const basis=chibiHeadBasis(geometry,outfit,$('headForm').value);
 const front={...geometry.views[0],...geometry.outfits?.[outfit]?.headViews?.[0]};
 const [cx,cy,rx,ry]=front.crownEllipse,top=143+(cy-ry-143)*basis.scaleY;
 const sx=$('character').value==='mariaBrown'?Number($('headWidth').value):1;
 const sy=$('character').value==='mariaBrown'?Number($('headHeight').value):1;
 const x=100+(cx-100)*sx,y=143+(top+basis.diameter/2-143)*sy;
 const r=basis.diameter/2,w=r*sx,h=r*sy;
 // Inspection-only frontal construction, kept out of renderer output and exports.
 const guide=`<g data-inspection-guide="frontal-circle" fill="none" stroke="#168b96" stroke-width="1.3" stroke-dasharray="4 3" pointer-events="none"><ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}"/><path d="M${x-w},${y}H${x+w}M${x},${y-h}V${y+h}"/><circle cx="100" cy="143" r="2" fill="#168b96" stroke-dasharray="none"/></g>`;
 const poseTransform=drawing.match(/<g transform="(.*?)translate\(100 143\) scale/)?.[1]||'';
 return drawing.replace('</svg>',(poseTransform?'<g transform="'+poseTransform+'">'+guide+'</g>':guide)+'</svg>');
}
function inspectionSVG(){const drawing=constructionGuide(svg(yaw));
 if($('bodyFocus').checked&&!$('bodyFocus').disabled){
  const [left,top,width,height]=drawing.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  // Resting/folded-arm bodies fit a closer frame; outstretched acting arms
  // keep the renderer's full horizontal bounds. Lower padding stays intact.
  // Retain head overlap: the close-up never reveals a hidden layer artificially.
  const close=['relaxed','crossed'].includes($('pose').value);
  return drawing.replace(/viewBox="[^"]+"/,`viewBox="${close?45:left} 132 ${close?110:width} ${top+height-132}"`);
 }
 if(!$('headFocus').checked||$('headFocus').disabled)return drawing;
 const top=Math.min(-25,Number(drawing.match(/viewBox="([^\"]+)"/)[1].split(' ')[1]));
 const halfWidth=94*Math.max(1,Number($('headWidth').value));
 return drawing.replace(/viewBox="[^"]+"/,`viewBox="${100-halfWidth} ${top} ${halfWidth*2} ${160-top}"`);}
function drawTurn(){ $('hero').innerHTML=inspectionSVG();if($('referenceDetail').open)$('detailHero').innerHTML=inspectionSVG();$('angle').value=yaw;$('angleLabel').textContent=yaw.toFixed(1)+'°';
 document.querySelectorAll('#sheet button').forEach((e,i)=>e.classList.toggle('active',Math.abs(yaw-i*45)<.5));
 $('sizes').innerHTML=[12,32,48,64,96,124].map(h=>`<div>${svg(yaw).replace('<svg ',`<svg style="height:${h}px" `)}<b>${h} px</b></div>`).join('');}
function drawAll(){$('blouseNeckline').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown'||$('costume').value!=='whiteBlouse';$('collarPlacement').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown'||$('costume').value!=='sailor';$('bodyFocus').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown';$('paperStep').disabled=$('version').value!=='study'||!['mariaBrown','mariaTeal'].includes($('character').value);$('faceForm').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown'||$('headForm').value!=='round-circle';$('headGuide').disabled=$('version').value!=='study'||!['mariaBrown','mariaTeal'].includes($('character').value)||!['round-o','round-circle'].includes($('headForm').value);$('headForm').disabled=$('version').value!=='study';const alarmOption=$("pose").querySelector("option[value=alarmed]");alarmOption.disabled=$("version").value!=="study"||$("character").value!=="mariaBrown";if(alarmOption.disabled&&$("pose").value==="alarmed")$("pose").value="relaxed";$('headFocus').disabled=$('version').value==='archive'||$('character').value!=='mariaBrown';$('inkStudy').disabled=$('version').value==='archive'||$('character').value!=='mariaBrown';$('headStudy').disabled=$('version').value==='archive'||$('character').value!=='mariaBrown';const archived=$('version').value==='archive';$('expression').disabled=archived;$('paint').disabled=archived||$('version').value==='study';$('pose').disabled=archived||$('character').value==='unimpressed';$('costume').disabled=archived||$('character').value==='unimpressed'||$('version').value==='study'&&$('character').value!=='mariaBrown';drawTurn();$('sheet').innerHTML=labels.map((label,i)=>`<button class="view" data-yaw="${i*45}">${svg(i*45)}<b>${label} · ${i*45}°</b></button>`).join('');
 $('continuity').innerHTML=Array.from({length:16},(_,i)=>`<div class="view">${svg(i*22.5)}<b>${i*22.5}°</b></div>`).join('');
 updateHeadControls();drawTurn();}
function updateHeadControls(){
 $('eyeOpeningStudy').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown'||$('expression').value!=='neutral'||$('headForm').value!=='round-circle'||$('faceForm').value==='previous';
 $('lidShape').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown'||$('expression').value!=='neutral'||$('headForm').value!=='round-circle'||$('faceForm').value==='previous';
 $('saveStudy').disabled=$('version').value!=='study'||!['mariaBrown','mariaTeal'].includes($('character').value)||$('character').value==='mariaBrown'&&!['sailor','whiteBlouse','sketch'].includes($('costume').value);
 $('bodyConstruction').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown'||!['sailor','whiteBlouse'].includes($('costume').value);
 $('bodyWidth').disabled=$('version').value!=='study'||$('character').value!=='mariaBrown';
 $('bodyWidthValue').textContent=Math.round(Number($('bodyWidth').value)*100)+'%';
 const disabled=$('headStudy').disabled,mode=$('headStudy').value;
 $('headWidth').disabled=disabled;$('headHeight').disabled=disabled;
 if(mode!=='custom'){
  const sizes=mode==='wide'?[1.08,.90]:mode==='tall'?[1,1.02]:[STUDY_CHARS.mariaBrown.headScaleX??1,STUDY_CHARS.mariaBrown.headScaleY??1];
  $('headWidth').value=sizes[0];$('headHeight').value=sizes[1];
 }
 $('headWidthValue').textContent=Math.round(Number($('headWidth').value)*100)+'%';
 $('headHeightValue').textContent=Math.round(Number($('headHeight').value)*100)+'%';
}
function turn(delta){yaw=(yaw+delta+360)%360;drawTurn();}
$('sheet').onclick=e=>{const card=e.target.closest('button[data-yaw]');if(card){yaw=Number(card.dataset.yaw);drawTurn();}};
$('previous').onclick=()=>turn(-45);$('next').onclick=()=>turn(45);
$('angle').oninput=e=>{yaw=Number(e.target.value);drawTurn();};
$('headFocus').onchange=()=>{if($('headFocus').checked)$('bodyFocus').checked=false;drawTurn();};
$('bodyFocus').onchange=()=>{if($('bodyFocus').checked)$('headFocus').checked=false;drawTurn();};
$('headGuide').onchange=drawTurn;
$('saveStudy').onclick=()=>{
 if($('saveStudy').disabled)return;
 const key=$('character').value,{c}=selectedDrawing(),angle=yaw;
 const character=JSON.parse(JSON.stringify({...c,geometry:c.geometry||(key==='mariaTeal'?TEAL_MARIA_GEOMETRY:BROWN_MARIA_GEOMETRY)}));
 const selectedSVG=chibi8SVG(character,angle/45);
 const record={format:'donbass-chibi-study-v1',createdAtUTC:new Date().toISOString(),reviewOnly:true,
  sourceRequired:'src/chibi8.js',renderer:selectedSVG.match(/data-renderer="([^"]+)"/)[1],
  characterKey:key,character,selected:{degrees:angle,svg:selectedSVG},
  views:labels.map((label,index)=>({label,degrees:index*45,svg:chibi8SVG(character,index)}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=key+'-'+(c.outfit||'default')+'-'+Math.round((c.bodyScaleX??1)*100)+'pct-study.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
for(const id of ['headWidth','headHeight'])$(id).oninput=()=>{$('headStudy').value='custom';drawAll();};
 $('bodyWidth').oninput=drawAll;
for(const id of ['version','expression','costume','pose','paint','headStudy','inkStudy','headForm','faceForm','paperStep','lidShape','eyeOpeningStudy','collarPlacement','blouseNeckline','bodyConstruction'])$(id).onchange=drawAll;
$('character').onchange=()=>{if($('character').value==='mariaBrown')outfitReference();else if($('character').value==='mariaTeal'){$('reference').value='references/TheTwoMarias.png';$('reference').onchange();}drawAll();};
function outfitReference(){if($('character').value!=='mariaBrown')return;
 $('reference').value=$('costume').value==='sailor'?'research/newcanvas3-construction-crop.png':$('costume').value==='whiteBlouse'?'references/Teaser.png':'references/TheTwoMarias.png';$('reference').onchange();}
$('costume').onchange=()=>{outfitReference();drawAll();};
$('background').onchange=()=>document.body.classList.toggle('night',$('background').value==='night');
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Auto rotate';};
function frame(t){if(playing&&lastTime)turn(Math.min(t-lastTime,100)*.025);lastTime=t;requestAnimationFrame(frame);}
$('reference').onchange=()=>{const value=$('reference').value;$('referenceImage').src=value;
 $('refnote').textContent=value.startsWith('blob:')?'Your drawing stays in this browser session. It is not uploaded or converted into a character asset.'
 :value.startsWith('review/whole-body-')?'Whole-body alternatives for both outfits: wider shoulders and collar, with more vertical room under the unchanged round head. The compact trial is 116% body width; the taller trial is 128%. Original drawing colours and proportions stay untouched. These remain editable comparison studies; current defaults retained and unseen sides inferred.'
 :value.startsWith('review/neutral-depth-')?'Current own left-front far neutral eye uses squared emergence depth, with upper-lid sag capped inside the shallow opening. Eight main drawings, right-side turn and other expressions retained. Previous linear and stronger cubic depth are comparisons.12 new previous/current-study32/64 scenes: four principal pairs pixel-identical, only292.5 eye pixels change17/7; six additional current-default scenes match trial pixels exactly. Current character needs no saved-study import. No mirrored image or AI pixels; hidden quarter anatomy and overall resemblance remain provisional.'
 :value.startsWith('review/sleepy-opening-')?'Optional coordinated neutral face: deeper white opening, greater own lid droop, deeper iris and lighter lower rim. Middle full editable study is sleepy-opening-balance-study.json. Same round head, hair, anchors, tapered body, brows and pout; body art exact1024 draws, five other expressions exact1280. Sixteen NEW study scenes compare sixteen PRIOR current scenes at32/64; source exact, changed pixels confined to the eye region, rear pixels unchanged.32 fractional code turns inspect overlap; residual far-eye shape needs review. Current face retained; hidden anatomy and likeness remain provisional. No AI pixels.'
 :value.startsWith('review/sailor-taper-')?'Current sailor uses a straighter tapered shirt in its own eight views and .74 vertical body scale. Earlier .60 and taller .82 remain comparisons. Circle, hair and face artwork preserved; the alarmed head placement follows the taller-body lean.16 newly captured current-study scenes at32/64 compare16 earlier current captures; source exact, scenery unchanged outside the figure. White blouse and teal unchanged. Hidden cloth and anatomy remain inferred; likeness is still your call. Full saved geometry sailor-taper-construction-study.json can be imported locally. No AI pixels.'
 :value.startsWith('review/fringe-half-turn-')?'Optional longer-fringe study with its own sailor6.5 headInbetweens record. Sampled left-front hook lifts above the near eyelid; eight principal SVGs and white blouse preserved.12 newly captured scenes compare270/292.5/315 at32/64; source exact, four principal pairs pixel-identical, scenery unchanged. Full editable fringe-half-turn-study.json imports locally. Both courtyard pages now expose sixteen selectable views when chosen. Current defaults remain; hidden anatomy and resemblance are provisional.'
 :value.startsWith('review/reference-sweep-')?'Longer central fringe in three own sailor front/quarter records. Original finished brown hair supports a long sweep; NewCanvas3 is shorter. Internal AI suggested the hypothesis, but all displayed study art is editable code with no AI pixels. Round head, eyes, mouth, body and principal profiles/rear fixed; own left-quarter tip revised to reduce eye crowding.16 new trial scene captures compare16 preceding current captures at32/64; all source-exact. Full longer geometry in review/reference-sweep-study.json. Default retained; resemblance and residual intermediate eye/hair tangencies need judgment.'
 :value==='review/lower-eye-ink-study.png'||value==='review/lower-eye-ink-courtyard.png'?'Optional lower-eye outline comparison: current.70, moderate.45, light.30. Upper heavy eyelids, blue iris, opening, brow, mouth, circle, hair and body fixed.32 actual scene SVGs and16 current/trial pairs verified at32/64; scenery unchanged outside character region. Moderate full geometry in review/lower-eye-ink-study.json imports locally. Defaults retained; finer face ink is not aesthetic approval or a whole-face reconstruction.'
 :value==='review/sailor-sleeve-span.png'||value==='review/sailor-sleeve-span-courtyard.png'?'Optional sleeve-span study: current,20% and40% widening about each own shoulder, preserving root/height, collar, round head and feet. Far profile sleeve remains tucked.20% full geometry is saved in review/sailor-sleeve-span-study.json for local movement import; default unchanged.16 actual eight-direction32/64 scene SVGs verified, not live walking or aesthetic approval. Original frontal body supplies evidence; rear views remain inferred.'
 :value==='review/current-sailor-expressions.png'||value==='review/current-whiteBlouse-expressions.png'?'Current code study: six expressions across eight separately authored directions, with32/64-pixel sprites. Expression ideas use your drawings; their adaptation and unseen views remain provisional. This is rendered code, not original artwork or an approved character sheet.'
 :value==='review/current-sailor-body-poses.png'?'Current code body review: four poses in eight directions, retaining actual head overlap, with native32/64-pixel full sprites. Pose and hidden-view anatomy are adaptations, not original drawings or approved assets.'
 :value==='review/current-finished-maria-review.png'?'Finished original brown head beside current flat sailor/scarf faces and exact32/64/96-pixel code sprites. Original paint and tilted pose are preserved. This is a comparison, not a fitted turnaround or approved character sheet.'
 :value==='review/sailor-profile-sleeve-right.png'||value==='review/sailor-profile-sleeve-left.png'?'Earlier sleeves versus the current tucked-profile draft through relaxed and speaking turns, with native32/64-pixel samples. Far sleeves sit behind their own torso; near sleeves, head, collar and feet stay fixed. Side/rear ownership is inferred, not traced from an original turnaround.'
 :value==='review/sailor-fold-readability.png'?'Same collar, sleeves and body with current folds, lighter folds or a plain shirt. Enlarged crops and native32/48/64-pixel sprites use editable code; the unchanged frontal drawing supplies clothing evidence. Current folds remain the default; unseen sides are inferred.'
 :value==='review/sailor-sleeve-depth-study.png'?'Earlier sleeve-depth comparison, before the later profile tuck: previous, deeper wedges and an extra-depth trial beside your unchanged frontal drawing. Shoulder roots, collar, torso, head and feet stay fixed within this comparison. The front keeps its own lower viewer-left wedge; other views are inferred.'
 :value==='review/sleepy-eye-opening-study.png'?'Three editable-code alternatives beside unchanged original crops, with native32/64/96-pixel samples. Upper lid, round head, hair and body stay fixed within this earlier comparison. Current sleepy eyes remain the default; use Eye opening study to inspect alternatives with the latest sleeve draft. This is a provisional comparison, not approved artwork.'
 :value==='review/iris-palette-study.png'?'Original painted iris detail beside previous, retained brighter-blue and cyan trial colours. All code alternatives use solid fills. Painted pixel samples include shading and do not establish an exact flat base colour; you decide resemblance.'
 :value.startsWith('review/teal-costume-')?'Current Teal construction: own calm face/swept pony, off-shoulder tunic/cream edges, exposed thighs/stockings and boot shafts. Front art supports the costume; hidden drape and acting are inferred.16 actual64/32 scene captures,32 selected step captures and8 held walks verified. Background exact outside figure during standing phase changes. Owner aesthetic approval pending; no AI pixels. Older studies remain preserved.'
 :value==='review/teal-rebuild-study.png'||value==='review/teal-rebuild-turns.png'||value==='review/teal-rebuild-courtyard.png'?'Earlier Teal head reconstruction before the current costume: clearer cheek, two swept fringe lobes, own calm face and softened ponytail. Separate left-front lock placement avoids crossing the face; fringe-edge ink is clipped to skin.32 fractional inspection views and16 actual64/32 courtyard captures. Head construction is now included in the current Teal character; this saved study retains the earlier generic body. Hidden turns and aesthetic approval remain provisional.'
 :value==='review/teal-pony-study.png'?'Current Teal Maria and optional high-ponytail trial. Pink band and raised hair mass are supported by TheTwoMarias; hidden turns remain inferred.16 enlarged views/32 trimmed32/64 sprites. Flat colours and round head retained. The trial makes the detail visible, but its shape still looks stiff in assistant judgment. Current character defaults unchanged; no AI pixels. Load teal-pony-study.json in the courtyard to inspect editable geometry.'
 :value==='review/teal-pony-courtyard.png'?'Sixteen actual browser scene captures of the optional Teal ponytail: all eight directions at64/32 visible-envelope sizes. Crops enlarged2x. Actual facing SVGs match saved editable geometry; scene frame retained. No new walking/device or aesthetic approval claim. Band remains very subtle at32px; current defaults unchanged.'
 :value==='review/fringe-slope-study.png'?'Previous, current gentle and full fringe slopes. Six own Y landmarks in three sailor front/quarter views; circle, eye geometry, locks, palette and body unchanged.27 face crops/54 trimmed32/64 sprites. Current gentle slope is an assistant prototype refinement toward the original finished drawing. An internal AI experiment prompted the hypothesis; no AI pixels, shading or traced contours enter this renderer.'
 :value==='review/iris-scene-comparison.png'?'Current .65 and lighter .35 iris outlines in20 actual courtyard captures: five own front/profile views at32/64 visible envelopes. Native80x90 crops beside2x enlargement.10 paired scenes differ only inside figure region; source geometry and saved trial SVGs verified. Assistant inspection finds only a modest colour benefit; current outline retained. Separate iris-035-study.json is loadable into the courtyard.'
 :value==='review/iris-small-size.png'?'Current, lighter and colour-only iris outlines.48 face crops/144 per-view trimmed12/32/64 sprites across two costumes. Iris outline only changes; heavy lids, gaze and palette fixed. Original finished brown Maria supports outlined blue irises. Colour-only rejected; lighter remains an optional editable study. No default change or owner aesthetic approval.'
 :value==='review/orbit-walks.png'?'32 actual held-pad walks: eight directions with four camera orientations. Side cameras use64px visible envelopes; front/rear cameras use32px.200x190 native-pixel scene crops after release. Saved shallow blouse geometry. Displacement directions and retained facings verified; no exact speed, live step-cycle, device or aesthetic claim. Sizes and camera orientations were not fully crossed.'
 :value==='review/blouse-arm-study.png'?'Current, tapered and shorter white-blouse acting arms.24 full views/body crops and48 per-view trimmed32/64 sprites. Each anatomical side is separately authored. Assistant inspection keeps current rounded arms: thinner or shorter trials reduce their weight and small-size readability. Rejected trials stay separate; no default geometry changed. Hidden directions are inferred.'
 :value==='review/blouse-acting-opening.png'?'Alarmed pose with standing, pose-placed and lower opening landmarks.24 body crops and48 trimmed32/64 sprites. Only neckline content changes. Assistant inspection rejects the shifted/lower trials: they exaggerate the opening. Current shallow opening is visible in enlarged acting views; it remains subtle at gameplay sizes. No default change.'
 :value==='review/blouse-neckline-study.png'?'Previous neckline and two angled trials in standing and alarmed poses. Independently authored opening landmarks are clipped inside the shirt; hidden directions and standing shape remain inferred.48 body crops and96 per-view trimmed32/64 sprites. Assistant inspection favors the shallow standing opening; acting opening is subtle at small sizes but visible in enlarged views. Previous stays default; save your chosen trial as editable geometry.'
 :value==='review/blouse-visible-acting.png'?'White-blouse standing and alarmed acting geometry in all eight directions, with32/64 per-view trimmed sprites and enlarged fronts beside your unchanged Teaser. Hidden rear details and standing pose are inferred. Assistant inspection finds the neckline mostly hidden by the round head; angled opening needs further study. No blouse geometry changed or aesthetic approval assumed.'
 :value==='review/cloth-corners-study.png'?'Previous rounded shirt beside the current moderate corners and a flatter trial. Head, collar placement, body landmarks and stroke widths stay fixed; shirt contour, white underlay and sewn-detail clip change.24 body crops and48 per-view trimmed32/64 sprites. Assistant judgment favors the middle cloth shape; owner aesthetic approval pending.'
 :value==='review/collar-placement-study.png'?'Original frontal drawing beside current and two lower body placements. Round head and short body size stay fixed; collar and sleeves move with the body. Twenty-four native64px principal sprites. Lower trials are optional live studies, not an approved default; unseen sides remain inferred. Save this study keeps the full geometry and its own foot anchor.'
 :value==='review/tie-area-study.png'?'Current sailor tie beside15% and30% wider trials around each own view anchor. Twenty-four body crops and72 native32/48/64 sprites. Only red-tie geometry and its matching underlay change; head, collar, sleeves, proportions and stroke widths remain fixed. Assistant inspection keeps current tie: wider trials fill the collar gap with little32px benefit. Internal comparison; live renderer unchanged.'
 :value==='review/garment-ink-study.png'?'Current clothing ink beside1.2x and1.4x trial weight in both outfits and all eight directions. Forty-eight enlarged body crops and144 native32/48/64 sprites. Only selected garment stroke widths change; white border, head, bare limbs, feet and body proportions stay fixed. Assistant inspection favored keeping current ink because heavier collar/tie lines crowd their small colours. Trials remain internal; live renderer unchanged.'
 :value==='review/blouse-contrast-board.png'?'Thirty-two actual white-blouse scenes: all eight idle directions at64/32px on light/dark floors. Corrected fixed camera keeps scenery identical across outfits while preserving each requested padded sprite height and aspect. Pixels outside the character crop match the sailor captures exactly. No character geometry change or canvas sprite pixel-equality claim. White torso details remain subtle at32px.'
 :value==='review/courtyard-contrast-board.png'?'Thirty-two actual fixed-camera scene PNGs: eight sailor facings at64/32px padded sprite heights, each on Light paper and Dark night. Scene crops enlarge2x with nearest pixels; Maria is idle. Character SVGs and geometry stay exact across backgrounds, but canvas sprite pixel equality is not asserted. Body detail remains hard to judge at32px. Courtyard background controls change the floor and surroundings only.'
 :value==='review/stare-ink-study.png'?'Previous and proportional Stare far-eye ink at six independently authored quarter turns. Only narrow iris, lid and brow stroke weight changes; shapes and anchors stay fixed. Trial is now the live draft after assistant inspection. All principal views and sleepy faces remain exact; your aesthetic approval is pending. Twelve crops and thirty-six native32/64/96 sprites; unseen turns inferred.'
 :value==='review/face-hair-ownership.png'?'Current sleepy, Stare and shocked faces through independently authored quarter turns, beside your unchanged frontal head crop. Eighteen enlarged crops plus native32/64 samples. Raster comparison covers six expressions and both outfits every five degrees at128px; no facial changes inside solid hair interiors after excluding one-pixel boundary neighbours. This does not verify shared-ink edges, all poses, motion or resemblance. The narrow Stare far eye remains an inspection point.'
 :value==='review/caret-size-study.png'?'Previous neutral caret beside moderate1.35 and large1.65 sizes, each growing around its own authored anchor. Eyes, head, hair, body, collar and sleeves stay fixed. Moderate is now the live draft after assistant inspection; your aesthetic approval remains pending. Fifteen face crops and forty-five native32/64/96 sprites beside unchanged original. Side and rear anatomy remains inferred.'
 :value==='review/face-spacing-study.png'?'Earlier cloned face layouts: previous, twelve-percent broader eyes with a larger caret, and that trial lowered three units. Circle head, hair, lids, eye opening, collar and sleeves stay fixed. Fifteen enlarged faces and forty-five native32/64/96 samples. No live default changed; quarter/profile details are inferred. Original head crop is unchanged.'
 :value==='review/cover-orbit-browser-board.png'?'Real fixed-camera courtyard PNGs: sixteen camera-relative facings at32/64-pixel padded texture heights. Each96-by120 scene crop is enlarged2x with nearest pixels for inspection. Camera positions use supported15-degree increments; sprite facings quantize to22.5 degrees. Maria is stationary with resting feet. This is a browser comparison, not a walking recording or original drawing.'
 :value==='review/profile-cheek-continuity.png'||value==='review/profile-cheek-continuity-dense.png'?'Current hair-cover movement through independently authored right retreat and left reveal, at fixed crop scale and native32/64-pixel samples. One-degree rows inspect the newly gradual cheek emergence. Coverage counts describe visible flat skin pixels, not resemblance or a recorded walking test. Principal drawings stay fixed; hidden-view anatomy is inferred.'
 :value==='review/profile-cheek-before.png'?'Earlier cover timing: the left face stays hidden until it appears abruptly near260 degrees. This is a preserved code comparison, not the current live draft.'
 :value==='review/far-eye-ink-study.png'?'Previous outlines beside the retained draft: narrow far eyes use thinner ink during intermediate turns. Principal views and eye coordinates stay fixed. Native32/64/96-pixel samples; unseen anatomy is inferred and resemblance is your call.'
 :value==='review/eye-corner-study.png'?'Current eye-corner arcs beside shorter and omitted trials, with native32/64-pixel samples and your original head crop. Current corner arcs were retained; this earlier comparison holds all other face shapes fixed.'
 :value==='review/brow-taper-study.png'?'Earlier curved brows beside two flat tapered trials and your original head crop. The thicker taper is now the live draft; eyelids, eye opening, head, mouth and body were held fixed. Left/right glyphs have their own fractions and follow their authored views; unseen turn anatomy remains inferred. Aesthetic approval is yours.'
 :value==='review/sailor-body-height-study.png'?'Your original beside three body heights under the same round head, aligned at approximate equal colour-head width. Current0.60 is unchanged;0.66/0.72 are comparison trials with their own foot anchors. Native64-pixel views cover all eight directions. The original head is flatter; the circle is your chosen shared base.'
 :value==='review/sailor-body-width-study.png'?'Code-rendered body-width trials beside unchanged original pixels, with equal head width and native64 views. Approximate anchors; default100% is retained. This is a comparison study, not another original drawing.'
 :value==='research/newcanvas3-construction-crop.png'?'Whole-chibi crop of your original NewCanvas3. Only blank margins are removed; colours and proportions are unchanged. The full original remains selectable. Unseen rear details are inferred.'
 :value==='research/newcanvas3-head-crop.png'?'Head crop of your original NewCanvas3. Original pixels, colours and proportions are preserved; comparison reference only.'
 :value==='research/original-brown-head-detail.png'?'Inspection crop of your original The Two Marias drawing. Perspective and painted colours are preserved; this is a comparison reference only.'
 :'Original drawings and archived studies are labelled separately. Unseen back details remain provisional. Ovi canon and tentative discussion notes have been located and reviewed separately.';};
window.addEventListener('resize',()=>{if($('referenceDetail').open)zoomReference();});
const localUrls=[];
const inspectButton=document.createElement('button');inspectButton.textContent='Inspect drawing at larger size';$('referenceImage').after(inspectButton);
let referenceZoomTouched=false;
function zoomReference(){const zoom=Number($('referenceZoom').value),base=Math.min(400,$('referenceScroll').clientWidth||400);$('detailImage').style.width=(base*zoom)+'px';$('zoomLabel').textContent=zoom+'×';}
inspectButton.onclick=()=>{
 $('detailImage').alt=$('reference').value.startsWith('review/')?'Enlarged code comparison study':'Enlarged selected drawing or reference';$('detailImage').src=$('referenceImage').src;$('detailHero').innerHTML=inspectionSVG();$('referenceDetail').showModal();if(!referenceZoomTouched)$('referenceZoom').value=matchMedia('(max-width:650px)').matches?'1':'2';zoomReference();};
$('referenceZoom').oninput=()=>{referenceZoomTouched=true;zoomReference();};$('closeReference').onclick=()=>$('referenceDetail').close();
$('uploads').onchange=e=>{for(const file of e.target.files){const url=URL.createObjectURL(file);localUrls.push(url);const option=document.createElement('option');option.value=url;option.textContent='Your drawing • '+file.name;$('reference').append(option);$('reference').value=url;}
 $('reference').onchange();$('refnote').textContent='Your drawing stays in this browser session. It is not uploaded or converted into a character asset.';};
window.addEventListener('pagehide',()=>localUrls.forEach(u=>URL.revokeObjectURL(u)));
if(['mariaBrown','mariaTeal'].includes($('character').value))$('reference').value='references/TheTwoMarias.png';
outfitReference();
$('reference').onchange();drawAll();requestAnimationFrame(frame);
