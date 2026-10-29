// Optional neckline study, not a canon/default change. Eight authored records.
function chibiBlouseNeckStudy(c,mode){
 if(c.paper!=='brown'||c.outfit!=='whiteBlouse'||!['shallow','deep'].includes(mode))return c;
 const geometry=JSON.parse(JSON.stringify(c.geometry||BROWN_MARIA_GEOMETRY));
 geometry.outfits.whiteBlouse.neckViews=[
  {points:[87,148,101,165,112,150],visibility:1},
  {points:[99,149,113,165,123,150],visibility:1},
  {points:[118,149,123,159,126,149],visibility:.45},
  {points:[115,149,115,149,115,149],visibility:0},
  {points:[100,149,100,149,100,149],visibility:0},
  {points:[88,149,88,149,88,149],visibility:0},
  {points:[76,150,81,160,86,149],visibility:.4},
  {points:[78,150,88,165,101,148],visibility:1}
 ];
 if(mode==='deep')for(const view of geometry.outfits.whiteBlouse.neckViews)if(view.visibility)view.points[3]+=4;
 return {...c,geometry};
}
