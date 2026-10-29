import {chibi8SVG,MARIA} from './chibi8.js';
export const PALETTES={
 original:{name:'Maria · warm original',hair:'#815022',skin:'#f3dfc5',cloth:'#fffdf4',collar:'#195e73',tie:'#d95947',legs:'#303d4d',shoes:'#302a3c',iris:'#3889bd',ink:'#282324'},
 pastel:{name:'Soft peach & blue',hair:'#a56c50',skin:'#f9d5c5',cloth:'#f7eee6',collar:'#657eaa',tie:'#cf737d',legs:'#596477',shoes:'#554d65',iris:'#5d93b0',ink:'#453d49'},
 dusk:{name:'Rose & midnight',hair:'#744650',skin:'#efcabb',cloth:'#eee5df',collar:'#495e7e',tie:'#ce8765',legs:'#35384d',shoes:'#342f45',iris:'#73a1b5',ink:'#292336'}
};
export const TREATMENTS={flat:{name:'Flat colour',note:'Clean colour blocks. Leaves the lighting to the game.'},cel:{name:'Two-tone cel',note:'Crisp shadow shapes with a warm upper light.'},soft:{name:'Soft painted light',note:'Rounded highlights and cooler shadow edges.'},paper:{name:'Ink & paper',note:'Muted colour with fine printed grain and hatching.'}};
const blend=(hex,target,amount)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-amount)+parseInt(target.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
let sequence=0;
// Recolour the actual editable geometry, without changing its shape or ordering.
// Deliberate baked paint studies; the main character renderer stays flat.
export function colorStudySVG(character={},direction=0,treatment='flat',palette='original'){
 const colors=PALETTES[palette]??PALETTES.original,kind=TREATMENTS[treatment]?treatment:'flat';
 let svg=chibi8SVG({...MARIA,...character,...colors},direction);
 if(kind==='flat')return svg;
 const id='paint'+(++sequence);let defs='';
 for(const key of ['hair','skin','cloth','collar','tie','legs','shoes']){
  const base=colors[key],dark=blend(base,key==='skin'?'#b36b70':key==='cloth'?'#76849c':'#332944',key==='skin'?.22:key==='cloth'?.28:.32),light=blend(base,'#fff1cb',.25),ref=id+'-'+key;
  if(kind==='cel')defs+=`<linearGradient id="${ref}" x1="0" y1="0" x2="1" y2=".65"><stop offset="0" stop-color="${base}"/><stop offset=".63" stop-color="${base}"/><stop offset=".63" stop-color="${dark}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
  if(kind==='soft')defs+=`<radialGradient id="${ref}" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`;
  if(kind==='paper')defs+=`<pattern id="${ref}" patternUnits="userSpaceOnUse" width="5" height="5"><rect width="5" height="5" fill="${blend(base,'#cab995',.12)}"/><path d="M0 4L2 2M4 6L6 4" stroke="${dark}" stroke-width=".55" opacity=".4"/><circle cx="3.7" cy=".8" r=".45" fill="${light}" opacity=".7"/></pattern>`;
  svg=svg.replaceAll(`fill="${base}"`,`fill="url(#${ref})"`);
 }
 return svg.replace('<defs>','<defs>'+defs).replace('data-renderer="','data-color-study="'+kind+'" data-renderer="');
}
