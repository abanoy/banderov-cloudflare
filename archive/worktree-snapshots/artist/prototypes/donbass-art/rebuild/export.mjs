import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {chibi8SVG,MARIA,DIRECTIONS} from './chibi8.js';
const out=new URL('./exports/',import.meta.url);await mkdir(out,{recursive:true});
const sharp=process.env.ART_SHARP?createRequire(import.meta.url)(process.env.ART_SHARP):null;
for(const outfit of ['sailor','whiteBlouse']){
 let cells='';
 for(let i=0;i<8;i++){
  const svg=chibi8SVG({...MARIA,outfit},i);
  await writeFile(new URL(`${outfit}-${i}.svg`,out),svg);
  cells+=`<svg x="${24+(i%4)*208}" y="${50+Math.floor(i/4)*385}">${svg}</svg><text x="${104+(i%4)*208}" y="${402+Math.floor(i/4)*385}" text-anchor="middle">${DIRECTIONS[i]}</text>`;
 }
 const board=`<svg xmlns="http://www.w3.org/2000/svg" width="860" height="825"><rect width="860" height="825" fill="#e4e9e0"/><g font-family="sans-serif" font-size="13" fill="#35413a"><text x="24" y="27">BROWN MARIA / ${outfit.toUpperCase()} / EIGHT AUTHORED VIEWS</text>${cells}</g></svg>`;
 await writeFile(new URL(`${outfit}-eight.svg`,out),board);
 if(sharp)await sharp(Buffer.from(board)).png().toFile(fileURLToPath(new URL(`${outfit}-eight.png`,out)));
}
console.log('16 editable principal views and two review sheets exported.');
let raisedCells='';
for(let i=0;i<8;i++)raisedCells+=`<g transform="translate(${24+i%4*208} ${50+Math.floor(i/4)*385})">${chibi8SVG({...MARIA,pose:'raised',expression:'happy'},i)}</g><text x="${104+i%4*208}" y="${402+Math.floor(i/4)*385}" text-anchor="middle">${DIRECTIONS[i]}</text>`;
const raisedBoard=`<svg xmlns="http://www.w3.org/2000/svg" width="860" height="825"><rect width="860" height="825" fill="#e4e9e0"/><g font-family="sans-serif" font-size="13" fill="#35413a"><text x="24" y="27">BROWN MARIA / COVER CONSTRUCTION / RAISED ARMS</text>${raisedCells}</g></svg>`;
await writeFile(new URL('cover-pose-eight.svg',out),raisedBoard);
if(sharp)await sharp(Buffer.from(raisedBoard)).png().toFile(fileURLToPath(new URL('cover-pose-eight.png',out)));
if(sharp){let cells='';for(let i=0;i<32;i++)cells+=`<g transform="translate(${12+i%8*130} ${28+Math.floor(i/8)*285}) scale(.75)">${chibi8SVG(MARIA,i/4)}</g><text x="${72+i%8*130}" y="${290+Math.floor(i/8)*285}" text-anchor="middle">${i*11.25}°</text>`;const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="1170"><rect width="1050" height="1170" fill="#e4e9e0"/><g font-family="sans-serif" font-size="11" fill="#35413a">${cells}</g></svg>`;await sharp(Buffer.from(sheet)).png().toFile(fileURLToPath(new URL('intermediate-turns.png',out)));}

if(sharp){
 let cells='';
 for(let row=0;row<4;row++)for(let phase=0;phase<4;phase++)cells+=`<g transform="translate(${30+phase*185} ${35+row*375})">${chibi8SVG({...MARIA,walking:true,walkPhase:phase/4,construction:true},row*2)}</g><text x="${105+phase*185}" y="${395+row*375}" text-anchor="middle">${DIRECTIONS[row*2]} / step ${phase+1}</text>`;
 const board=`<svg xmlns="http://www.w3.org/2000/svg" width="770" height="1530"><rect width="770" height="1530" fill="#e4e9e0"/><g font-family="sans-serif" font-size="12" fill="#35413a">${cells}</g></svg>`;
 await sharp(Buffer.from(board)).png().toFile(fileURLToPath(new URL('construction-walk.png',out)));
}
