// Owner sketch recreation. Coordinates are local to the 256 x 350 reference crop
// (original photograph x703, y950). One authored pose; no invented reverse views.
// Smooth interpolation of editable contour landmarks is sampled into straight
// SVG segments. No Bezier path, embedded image, font or external asset is used.
export const FRAME={width:256,height:350,referenceX:703,referenceY:950};
export const INK='#303030';
export const contours={
  leftEar:[[34,114],[27,112],[26,108],[38,92],[43,69],[48,53],[58,45],[66,49],[76,66],[91,91],[83,103],[69,88],[59,71],[53,88],[44,106]],
  leftEarInside:[[44,107],[54,74],[60,63],[67,76],[78,94]],
  rightEar:[[155,81],[174,58],[194,31],[207,16],[215,11],[227,14],[235,20],[236,35],[233,54],[227,71],[217,70],[213,51],[213,32],[201,44],[186,68],[178,88]],
  rightEarInside:[[165,83],[180,63],[193,47],[211,35]],
  rightEarFold:[[211,23],[214,36],[216,51]],
  hairBack:[[47,160],[49,139],[58,117],[78,95],[104,82],[128,78],[151,80],[177,85],[198,95],[215,119],[229,150],[230,178],[224,205],[226,216],[240,226],[227,234],[210,240],[192,244],[177,240],[158,232],[127,229],[103,238],[82,243],[59,243],[43,237],[30,229],[42,220],[54,207],[55,196],[47,182]],
  legs:[[103,300],[107,320],[115,336],[126,342],[137,343],[147,338],[154,323],[162,297],[150,303],[129,309]],
  legDivide:[[132,307],[132,322],[134,341]],
  leftArm:[[103,246],[93,251],[81,263],[77,270],[83,272],[93,269],[103,261],[111,255]],
  rightArm:[[158,229],[164,235],[171,245],[180,254],[179,258],[172,259],[162,254],[154,249]],
  outfit:[[106,224],[118,227],[143,227],[154,224],[157,240],[156,255],[152,268],[151,274],[158,281],[164,286],[160,295],[151,303],[137,309],[121,309],[108,305],[101,300],[99,291],[109,278],[109,269],[105,259],[101,244]],
  neckline:[[118,230],[122,240],[126,246],[131,243],[136,230]],
  necklineMiddle:[[127,232],[126,241]],
  face:[[75,132],[94,116],[127,104],[161,99],[174,111],[178,130],[182,153],[183,173],[177,196],[163,215],[144,224],[124,226],[103,224],[87,220],[78,212],[73,198],[69,179],[69,156]],
  longTemple:[[178,103],[194,114],[205,137],[211,160],[206,183],[190,205],[167,219]],
  leftTemple:[[69,149],[63,167],[66,189],[73,210],[87,220],[105,224]],
  eyeLeft:[[89,161],[93,155],[98,154],[103,158],[104,165],[100,170],[95,171],[90,168]],
  eyeRight:[[145,154],[149,148],[156,144],[161,145],[162,152],[159,159],[154,163],[148,161]],
  pupilLeft:[[96,163],[98,165],[102,163],[101,167],[98,169],[96,167]],
  pupilRight:[[149,155],[152,158],[157,157],[160,153],[159,160],[154,162],[150,160]],
  lidLeft:[[85,161],[89,155],[95,153],[102,154],[110,160],[115,168]],
  lidRight:[[140,162],[143,155],[149,149],[155,146],[163,145],[166,150],[169,159]],
  lashLeft:[[88,157],[84,162],[85,168]],
  lashRight:[[163,146],[165,154],[166,161],[164,164]],
  eyeTailRight:[[167,149],[171,156],[174,158]],
  browLeft:[[107,145],[111,147],[114,151]],
  browRight:[[142,145],[146,141],[150,140]],
  nose:[[128,166],[129,170],[132,174],[132,178]],
  smile:[[110,192],[113,198],[120,202],[129,203],[137,201],[143,198],[146,194]],
  tongue:[[123,203],[125,213],[128,217],[132,217],[136,214],[136,202]],
  tongueCentre:[[130,204],[131,211]],
  sideSweep:[[113,92],[92,101],[72,115],[59,135],[48,156],[44,172],[28,181],[8,188],[34,183],[52,177],[66,167],[71,151],[75,137],[92,113]],
  fringe:[[70,144],[72,136],[84,118],[103,101],[124,91],[145,90],[162,94],[181,101],[176,109],[163,119],[148,128],[131,136],[114,143],[99,149],[87,154],[77,153],[71,149]],
  fringeSweep:[[73,145],[86,127],[98,115]],
  fringePart:[[96,148],[108,135],[120,117],[135,103]],
  hairRim:[[58,127],[74,108],[101,91],[130,84],[153,86],[179,93],[201,111],[215,139],[220,168],[216,196]],
  hairTipLeft:[[33,230],[48,239],[65,244],[82,242],[104,232]],
  hairTipRight:[[168,231],[187,238],[207,238],[233,228]]
};

// Cardinal interpolation: each hand-placed point remains on the final contour.
// Low tension and short segments retain the sketch's uneven silhouette.
export function contourPath(points,closed=false,tension=.65){
  const pts=points, total=closed?pts.length:pts.length-1, out=[];
  for(let i=0;i<total;i++){
    const at=j=>pts[closed?(j+pts.length)%pts.length:Math.max(0,Math.min(j,pts.length-1))];
    const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);
    const count=Math.max(3,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/1.5));
    for(let k=0;k<count;k++){
      const t=k/count,t2=t*t,t3=t2*t;
      const xy=[0,1].map(a=>(2*t3-3*t2+1)*p1[a]+(t3-2*t2+t)*tension*(p2[a]-p0[a])/2+(-2*t3+3*t2)*p2[a]+(t3-t2)*tension*(p3[a]-p1[a])/2);
      out.push(xy.map(v=>v.toFixed(2)).join(','));
    }
  }
  if(!closed)out.push(pts.at(-1).join(','));
  return 'M'+out.join('L')+(closed?'Z':'');
}

export function bunnywomanSVG({guides=false,finish='ink'}={}){
 const shape=(name,{closed=false,fill=closed?'white':'none',weight=1.65,tension=.65}={})=>`<path data-part="${name}" d="${contourPath(contours[name],closed,tension)}" fill="${fill}" stroke="${INK}" stroke-width="${weight}"/>`;
 let body='';
 for(const name of ['leftEar','rightEar'])body+=shape(name,{closed:true});
 for(const name of ['leftEarInside','rightEarInside','rightEarFold'])body+=shape(name,{weight:1.15});
 body+=shape('hairBack',{closed:true,weight:1.9});
 body+=shape('legs',{closed:true});body+=shape('legDivide',{weight:1.5});
 for(const name of ['leftArm','rightArm','outfit'])body+=shape(name,{closed:true});
 body+=shape('neckline',{weight:1.8})+shape('necklineMiddle',{weight:1.2});
 body+=shape('face',{closed:true,weight:1.8});
 for(const name of ['longTemple','leftTemple'])body+=shape(name,{weight:1.35});
 for(const name of ['eyeLeft','eyeRight'])body+=shape(name,{closed:true,weight:1.3});
 for(const name of ['pupilLeft','pupilRight'])body+=shape(name,{closed:true,fill:INK,weight:.5});
 for(const name of ['lidLeft','lidRight'])body+=shape(name,{weight:2});
 for(const name of ['lashLeft','lashRight','eyeTailRight','browLeft','browRight'])body+=shape(name,{weight:1.5});
 body+=shape('nose',{weight:1.25});
 body+=shape('tongue',{closed:true,weight:1.65})+shape('tongueCentre',{weight:1.0})+shape('smile',{weight:2.1});
 // Faint cheek marks are actual pencil marks in the supplied drawing.
 body+='<g stroke="'+INK+'" stroke-width=".65" opacity=".48"><path d="M88 170l3 4m2-5 3 4m50-7 3 4m2-5 3 4m2-4 3 3"/></g>';
 body+=shape('sideSweep',{closed:true,weight:1.15,tension:.45});
 body+=shape('fringe',{closed:true,weight:1.8,tension:.45});
 for(const name of ['fringeSweep','fringePart','hairRim','hairTipLeft','hairTipRight'])body+=shape(name,{weight:name==='fringePart'?1.1:.9});
 if(guides)body+='<g stroke="#777" fill="none" stroke-width=".4" stroke-dasharray="3 3"><path d="M18 79H246M18 226H246M18 343H246M132 72V345"/></g>';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="350" viewBox="0 0 256 350" role="img" aria-label="Bunnywoman, monochrome recreation of the supplied sketch"><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
 return finish==='colour'?colourBunnywoman(svg):svg;
}

// Owner-selected colour-study palette (2026-10-14). Paint changes do not move
// silhouette or facial landmarks. Shared user-space hair gradient avoids seams.
export const PALETTE={hairLight:'#b07858',hair:'#81503f',hairDark:'#523540',skinLight:'#ffe6cc',skin:'#f3c6b2',skinShade:'#d99592',cream:'#fff1d8',earShade:'#c9a9a1',earInner:'#d9979b',plum:'#654569',plumLight:'#94688b',plumDark:'#3d2c47',iris:'#639d8c',tongue:'#e58998',ink:'#372a36'};
function colourBunnywoman(svg){
 const p=PALETTE;
 const closed=(name)=>contourPath(contours[name],true,name==='fringe'||name==='sideSweep'?.45:.65);
 const path=(points,fill,opacity=1)=>`<path d="${contourPath(points,true,.6)}" fill="${fill}" opacity="${opacity}" stroke="none"/>`;
 const clip=(name,content)=>`<g clip-path="url(#bw-${name})">${content}</g>`;
 const linear=(id,x1,y1,x2,y2,stops)=>`<linearGradient id="bw-${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`;
 let defs=linear('hair',72,85,177,225,[['0%',p.hairLight],['38%',p.hair],['100%',p.hairDark]])
 +linear('skin',90,134,155,231,[['0%',p.skinLight],['70%',p.skin],['100%','#eeb6a7']])
 +linear('ear',160,15,180,100,[['0%','#fffaf0'],['65%',p.cream],['100%',p.earShade]])
 +linear('cloth',109,225,151,311,[['0%',p.plumLight],['36%',p.plum],['100%',p.plumDark]])
 +linear('stocking',113,306,148,341,[['0%','#766077'],['100%','#403345']]);
 defs+='<radialGradient id="bw-blush"><stop stop-color="#e9828d" stop-opacity=".55"/><stop offset="1" stop-color="#e9828d" stop-opacity="0"/></radialGradient>';
 for(const name of ['hairBack','leftEar','rightEar','face','leftArm','rightArm','outfit','legs','fringe','sideSweep'])defs+=`<clipPath id="bw-${name}"><path d="${closed(name)}"/></clipPath>`;
 const url=id=>`url(#bw-${id})`;
 const fills={leftEar:url('ear'),rightEar:url('ear'),hairBack:url('hair'),legs:url('stocking'),leftArm:url('skin'),rightArm:url('skin'),outfit:url('cloth'),face:url('skin'),eyeLeft:'#fff9ec',eyeRight:'#fff9ec',pupilLeft:p.iris,pupilRight:p.iris,tongue:p.tongue,sideSweep:url('hair'),fringe:url('hair')};
 const inserts={
  leftEar:clip('leftEar',path([[45,105],[51,79],[59,59],[72,80],[84,98],[78,101],[62,76],[56,91]],p.earInner,.8)),
  rightEar:clip('rightEar',path([[163,83],[179,61],[195,40],[212,26],[213,43],[199,55],[181,86]],p.earInner,.78)+path([[213,13],[215,33],[217,53],[224,67],[234,42],[235,71],[211,76],[205,32]],'#ae8290',.24)),
  hairBack:clip('hairBack',path([[177,85],[207,111],[219,159],[208,207],[181,228],[212,232],[237,222],[244,250],[30,251],[31,230],[62,235],[97,224],[93,212],[172,170]],p.hairDark,.34)),
  legs:clip('legs',path([[102,300],[115,309],[153,311],[160,298],[164,308],[152,318],[119,317],[106,312]],p.plumDark,.5)+path([[114,319],[117,329],[125,338],[121,329]],'#bba0b1',.36)),
  leftArm:clip('leftArm',path([[77,267],[84,268],[106,253],[109,260],[89,274],[77,273]],p.skinShade,.5)),
  rightArm:clip('rightArm',path([[154,240],[166,254],[181,253],[185,264],[170,263],[153,252]],p.skinShade,.45)),
  outfit:clip('outfit',path([[104,223],[149,223],[157,228],[147,236],[122,235],[107,240]],p.plumDark,.45)+path([[145,237],[146,258],[138,281],[143,296],[160,290],[171,297],[153,313],[122,314],[116,304],[123,286],[129,262]],p.plumDark,.32)+path([[109,239],[112,256],[117,269],[116,282],[110,292],[121,285],[122,263],[117,246]],'#cf9fba',.24)),
  face:clip('face',path([[67,142],[89,150],[111,141],[145,124],[172,103],[177,114],[147,136],[111,152],[90,159],[71,160]],p.skinShade,.43)+path([[171,109],[182,144],[181,181],[170,209],[144,223],[172,222],[191,193],[194,134]],p.skinShade,.4)+'<ellipse cx="91" cy="178" rx="14" ry="9" fill="url(#bw-blush)"/><ellipse cx="162" cy="172" rx="14" ry="9" fill="url(#bw-blush)"/>'),
  pupilLeft:'<ellipse cx="99" cy="167" rx="1.45" ry="1.7" fill="'+p.ink+'"/>',
  pupilRight:'<ellipse cx="155" cy="159" rx="1.8" ry="2.2" fill="'+p.ink+'"/>',
  tongue:clip('face',path([[125,204],[135,203],[135,207],[126,208]],'#ad596e',.42)),
  fringe:clip('fringe',path([[76,133],[91,112],[111,99],[136,94],[153,98],[128,100],[108,109],[91,124]],'#e6b887',.32)+path([[75,146],[87,150],[114,140],[154,122],[176,103],[184,107],[161,128],[111,148],[82,158],[71,153]],p.hairDark,.22)),
  sideSweep:clip('sideSweep',path([[56,146],[68,121],[84,108],[76,124],[64,148],[60,166],[46,177]],'#c9976f',.25))
 };
 svg=svg.replace(/<path data-part="([^"]+)"[^>]*\/>/g,(tag,name)=>{
   tag=tag.replace(`stroke="${INK}"`,`stroke="${p.ink}"`);
   if(fills[name])tag=tag.replace(/fill="[^"]*"/,`fill="${fills[name]}"`);
   if(['hairRim','hairTipLeft','hairTipRight','fringePart','fringeSweep'].includes(name))tag=tag.replace(`stroke="${p.ink}"`,'stroke="#4f3540"');
   if(['nose','tongueCentre'].includes(name))tag=tag.replace(`stroke="${p.ink}"`,'stroke="#9e6267"');
   if(name==='neckline'||name==='necklineMiddle')tag=tag.replace(`stroke="${p.ink}"`,'stroke="#f6dabb"');
   return tag+(inserts[name]||'');
 });
 return svg.replace('monochrome recreation','coloured recreation').replace('<g stroke-linecap=',`<defs>${defs}</defs><g stroke-linecap=`);
}
