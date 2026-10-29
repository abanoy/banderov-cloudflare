// Import editable parameters only. Saved raster/SVG fields never become textures.
export function readSavedStudy(text, render) {
 if(text.length>2_000_000)throw new Error('Choose a workshop study smaller than 2 MB.');
 const record=JSON.parse(text),c=record.character;
 if(record.format!=='donbass-chibi-study-v1'||!['mariaBrown','mariaTeal'].includes(record.characterKey)||!c||c.geometry?.schema!=='paper-xy-v1'||c.geometry.views?.length!==8)throw new Error('Choose a Maria study saved by the drawing workshop.');
 const inspect=value=>{if(typeof value==='number'&&!Number.isFinite(value))throw new Error('The study contains an invalid number.');if(typeof value==='string'&&/[<>"'&]/.test(value))throw new Error('The study contains unsupported text.');if(value&&typeof value==='object')Object.values(value).forEach(inspect);};
 inspect(c);
 for(let angle=0;angle<8;angle+=.5){const svg=render({...c,walkPhase:0},angle);if(/NaN|Infinity|undefined/.test(svg))throw new Error('The study cannot render all its turns.');}
 return {characterKey:record.characterKey,character:c};
}
