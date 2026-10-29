// Local review vectors only. Does not copy into the game or publish anything.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const rendererPath=path.join(__dirname,'src','chibi8.js'),source=fs.readFileSync(rendererPath,'utf8');
const context=vm.createContext({});
vm.runInContext(source+'\nglobalThis.reviewAPI={chibi8SVG,STUDY_CHARS,BROWN_MARIA_GEOMETRY,TEAL_MARIA_GEOMETRY};',context);
const {chibi8SVG,STUDY_CHARS,BROWN_MARIA_GEOMETRY,TEAL_MARIA_GEOMETRY}=context.reviewAPI;
const directions=['front','front-right','right','back-right','back','back-left','left','front-left'];
const out=path.join(__dirname,'review-svg'),entries=[];
const sourceSHA256=crypto.createHash('sha256').update(source).digest('hex');
const parameters={schemaVersion:1,geometrySchema:'paper-xy-v1',rendererStyle:'primitive-sticker-v3',status:'local review; resemblance not approved',sourceSHA256,
 note:'Generated snapshot, not a second source of truth. Regenerate from src/chibi8.js after edits. Trusted local parameters only.',
 characters:{mariaBrown:{...STUDY_CHARS.mariaBrown,geometry:BROWN_MARIA_GEOMETRY},
 mariaTeal:{...STUDY_CHARS.mariaTeal,geometry:TEAL_MARIA_GEOMETRY}}};
for(const key of ['mariaBrown','mariaTeal']){
 const directory=path.join(out,key);fs.mkdirSync(directory,{recursive:true});
 const character={...STUDY_CHARS[key],paint:'flat',pose:'relaxed',expression:'neutral'};
 for(const [yawIndex,direction] of directions.entries()){
  const svg=chibi8SVG(character,yawIndex),relative=key+'/'+direction+'.svg';
  fs.writeFileSync(path.join(out,relative),svg+'\n');
  const viewBox=svg.match(/viewBox="([^"]+)"/)?.[1];
  if(!viewBox)throw new Error('Missing rendered viewBox: '+relative);
  entries.push({character:key,direction,yawIndex,yawDegrees:yawIndex*45,path:relative,viewBox});
 }
}
const manifest={status:'local review; resemblance not approved',generatedAtUTC:new Date().toISOString(),
 source:'../src/chibi8.js',sourceSHA256,parameters:'character-parameters.json',
 paint:'flat',pose:'relaxed',expression:'neutral',nominalBodyFrame:[200,244],alignmentAnchor:[100,234],
 alignmentNote:'Nominal foot baseline in renderer units; ink extends slightly below it. Brown bounds include extra tuft space. Preserve a common world-unit scale when comparing bodies.',
 axes:{x:'screen right in each authored view',y:'screen down'},geometrySchema:'paper-xy-v1',rendererStyle:'primitive-sticker-v3',
 yaw:'0 front; 90 screen-right profile; 180 back; 270 screen-left profile; signed/fractional indices supported by source API',
 reference:'TheTwoMarias: owner confirmed separate Marias; hidden rear details remain inferred',entries};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(out,'character-parameters.json'),JSON.stringify(parameters,null,2)+'\n');
// Explicit reference outfits: keep the older default-character exports intact.
const outfitEntries=[];
for(const outfit of ['sailor','whiteBlouse']){
 const directory=path.join(out,'outfits',outfit);fs.mkdirSync(directory,{recursive:true});
 for(const [yawIndex,direction] of directions.entries()){
  const settings={outfit,paint:'flat',pose:'relaxed',expression:'neutral',walkPhase:0};
  const svg=chibi8SVG({...STUDY_CHARS.mariaBrown,...settings},yawIndex);
  const relative='outfits/'+outfit+'/'+direction+'.svg';
  const viewBox=svg.match(/viewBox="([^"]+)"/)?.[1];
  const footY=Number(svg.match(/data-foot-y="([^"]+)"/)?.[1]);
  if(!viewBox||!Number.isFinite(footY))throw new Error('Missing outfit bounds/anchor: '+relative);
  fs.writeFileSync(path.join(out,relative),svg+'\n');
  outfitEntries.push({character:'mariaBrown',...settings,direction,yawIndex,yawDegrees:yawIndex*45,path:relative,viewBox,alignmentAnchor:[100,footY]});
 }
}
fs.writeFileSync(path.join(out,'outfit-manifest.json'),JSON.stringify({
 status:'local review; resemblance not approved',generatedAtUTC:new Date().toISOString(),
 source:'../src/chibi8.js',sourceSHA256,parameters:'character-parameters.json',
 note:'Explicit reference outfits. Read each entry bounds and nominal foot anchor; do not reuse the earlier default-costume anchor. Ink extends below the anchor.',
 entries:outfitEntries},null,2)+'\n');
console.log('Exported '+entries.length+' default and '+outfitEntries.length+' explicit-outfit local review SVGs to '+out+'; no game files touched.');
