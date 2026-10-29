import {chibi8SVG,MARIA,PROPORTIONS,referenceY} from './chibi8.js';

// The raster is a separately labelled reference only. The character is pure SVG.
export function proportionComparison(character=MARIA){
 const scale=108/PROPORTIONS.headHeight;
 const levels=[['Crown','crown'],['Chin','chin'],['Waist','waist'],['Hips','hips'],['Crotch','crotch'],['Knee','knee'],['Sole','sole']];
 const rules=levels.map(([label,key])=>`<path d="M2 ${referenceY(PROPORTIONS[key])}H196" stroke="#477c87" stroke-width=".6" stroke-dasharray="3 3" opacity=".6"/>`).join('');
 const root=inner=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 198 342" width="198" height="342">${inner}${rules}</svg>`;
 const original=root(`<image href="../references/proportion-target.png" width="1439" height="554" transform="matrix(${scale} 0 0 ${scale} ${99-462*scale} ${20-39*scale})"/>`);
 const current=chibi8SVG({...character,pose:'relaxed',construction:true},0).replace(/^<svg[^>]*>/,'<g transform="translate(19 0)">').replace(/<\/svg>$/,'</g>');
 const widths=[['Head width','headWidth'],['Waist width','waistWidth'],['Hip width','hipWidth'],['Knee width','kneeWidth']].map(([label,key])=>`<tr><th>${label}</th><td>${(PROPORTIONS[key]/PROPORTIONS.headHeight).toFixed(2)}</td></tr>`).join('');
 const rows=levels.map(([label,key])=>`<tr><th>${label}</th><td>${((PROPORTIONS[key]-PROPORTIONS.crown)/PROPORTIONS.headHeight).toFixed(2)}</td></tr>`).join('');
 return `<div class="measure-figure"><h3>Reference · figure #2</h3>${original}</div><div class="measure-figure"><h3>Maria · latest adjustments</h3>${root(current)}</div><div class="measure-table"><h3>Reference head units</h3><table>${rows}</table><h3>Reference widths</h3><table>${widths}</table><p>One head = crown to chin.<br>Hair tuft and white border are excluded.</p><p>Your latest direction shortens the legs and widens the waist. Dotted levels show the earlier reference, not required targets.</p></div>`;
}
