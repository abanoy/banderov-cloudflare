import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {potcoChestRefinedSVG} from './potco-study-refined.mjs';
import {potcoChestSVG} from './potco-study.mjs';
const out=new URL('./exports/potco-study/',import.meta.url);
await mkdir(out,{recursive:true});
for(const size of [32,44,64,256]) await writeFile(new URL(`refined-${size}.svg`,out),potcoChestRefinedSVG({size}));
// PNG previews are optional. Supply an existing Sharp module path; no installation.
if(process.env.POTCO_SHARP){
 const {createRequire}=await import('node:module');
 const sharp=createRequire(import.meta.url)(process.env.POTCO_SHARP);
 for(const size of [64,256]) await sharp(Buffer.from(potcoChestRefinedSVG({size}))).png().toFile(fileURLToPath(new URL(`refined-${size}.png`,out)));
 const board=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="430" viewBox="0 0 720 430"><rect width="720" height="430" fill="#eee9dc"/><g fill="#344338" font-family="sans-serif"><text x="48" y="38" font-size="13" letter-spacing="2">FIRST CONSTRUCTION</text><text x="400" y="38" font-size="13" letter-spacing="2">REBUILT FROM REFERENCE</text></g><svg x="48" y="60">${potcoChestSVG({size:256})}</svg><svg x="400" y="60">${potcoChestRefinedSVG({size:256,id:'board'})}</svg><svg x="120" y="343">${potcoChestSVG({size:44})}</svg><svg x="472" y="343">${potcoChestRefinedSVG({size:44,id:'native'})}</svg><g fill="#626853" font-family="sans-serif" font-size="12"><text x="176" y="370">44 px</text><text x="528" y="370">44 px</text></g></svg>`;
 await sharp(Buffer.from(board)).png().toFile(fileURLToPath(new URL('comparison.png',out)));
}
console.log('POTCO study exports written.');
