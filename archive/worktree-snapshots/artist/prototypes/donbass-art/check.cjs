const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/src/chibi8.js','utf8')+'\nglobalThis.api={chibi8SVG,STUDY_CHARS,BROWN_MARIA_GEOMETRY,TEAL_MARIA_GEOMETRY};',ctx);
const {chibi8SVG,STUDY_CHARS,BROWN_MARIA_GEOMETRY,TEAL_MARIA_GEOMETRY}=ctx.api;
const norm=s=>s.replace(/study\d+/g,'studyID');let count=0;
for(const g of [BROWN_MARIA_GEOMETRY,TEAL_MARIA_GEOMETRY]){assert.equal(g.views.length,8);for(const k of Object.keys(g.views[0]))for(const v of g.views)assert.equal(JSON.stringify(v[k]).match(/-?\d+(?:\.\d+)?/g).length,JSON.stringify(g.views[0][k]).match(/-?\d+(?:\.\d+)?/g).length,'Landmark topology '+k);}
for(const key of ['mariaBrown','mariaTeal'])for(const expression of ['neutral','happy','stare','shocked','confused','delusional'])for(const pose of ['relaxed','crossed','explain']){
 const c={...STUDY_CHARS[key],expression,pose};
 for(let i=0;i<720;i++){const svg=chibi8SVG(c,i/90);assert(!/NaN|Infinity|undefined|Gradient|opacity=|scale\(-|<image|<filter/.test(svg));assert(!/,[MLQZ]/.test(svg),'No comma before path command');for(const m of svg.matchAll(/ d="([^"]*)"/g))assert(!/[QqCcSsTt]/.test(m[1]),'No Bezier drawing commands');assert(svg.indexOf('data-piece="white-border"')<svg.indexOf('data-piece="colour-art"'),'White underlay precedes colour');const ids=[...svg.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const m of svg.matchAll(/url\(#([^)]*)\)/g))assert(ids.includes(m[1]));for(const m of svg.matchAll(/(?:rx|ry)="([^"]+)"/g))assert(Number(m[1])>=0);count++;}
 assert.equal(norm(chibi8SVG(c,0)),norm(chibi8SVG(c,8)));assert.equal(norm(chibi8SVG(c,-1)),norm(chibi8SVG(c,7)));assert.notEqual(norm(chibi8SVG(c,2)),norm(chibi8SVG(c,6)));
 for(let i=0;i<8;i++){const svg=chibi8SVG(c,i);assert.equal([...svg.matchAll(/data-hand="resting"/g)].length,pose==='relaxed'?2:pose==='explain'?1:0,'No extra resting hands in '+pose);if(pose==='crossed'&&[3,4,5].includes(i))assert(!svg.includes('data-pose-layer="front"'),'No front crossed arms through rear costume');}
 for(const i of [3,4,5])assert(!chibi8SVG(c,i).includes('data-piece="face"'));for(const i of [0,1,2,6,7])assert(chibi8SVG(c,i).includes('data-piece="face"'));
}
assert(chibi8SVG(STUDY_CHARS.mariaBrown,2).includes('right-ear'));assert(!chibi8SVG(STUDY_CHARS.mariaBrown,6).includes('right-ear'));
// Simplification keeps two front folds; their ink contracts continuously at rear.
// Earlier four-fold renderer assertions are preserved in research/.
for(const angle of [112,112.5,113]){
 const folds=[...chibi8SVG(STUDY_CHARS.mariaBrown,angle/45).matchAll(/<path[^>]*stroke-width="([^"]+)"[^>]*data-piece="skirt-fold"/g)];
 assert.equal(folds.length,2);assert(Math.abs(Number(folds[0][1])-2.8*.6*.45*(135-angle)/45)<.001);
}
assert.equal([...chibi8SVG(STUDY_CHARS.mariaBrown,3).matchAll(/data-piece="skirt-fold"/g)].length,2);
assert.throws(()=>chibi8SVG(STUDY_CHARS.mariaBrown,NaN));assert.throws(()=>chibi8SVG({...STUDY_CHARS.mariaBrown,geometry:{schema:'old'}},0));
console.log('Primitive sticker checks passed: '+count+' frames; no Bezier commands, flat materials, white border, wrap, independent sides, rear ownership and topology.');
