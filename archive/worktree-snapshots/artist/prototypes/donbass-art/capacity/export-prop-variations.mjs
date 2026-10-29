import fs from 'node:fs/promises';
import {propStudies,propVariationSVG} from './prop-variations.mjs';
const folder=new URL('./exports/prop-variations/',import.meta.url);await fs.mkdir(folder,{recursive:true});
for(const p of propStudies)for(const v of p.variants)for(const treatment of ['colour','silhouette'])for(const size of [48,96])await fs.writeFile(new URL(p.id+'-'+v.id+'-'+treatment+'-'+size+'.svg',folder),propVariationSVG(p.id,v.id,{size,treatment}));
console.log('Nine authored constructions exported at48/96 in colour and monochrome.');
