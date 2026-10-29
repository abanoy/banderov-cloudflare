import * as T from '../vendor/three.module.js';

// Visible and collision meshes use the same closed procedural surfaces. The
// 48-sided circle is deliberately faceted to retain the castle's tile style.
export const CURVE_SEGMENTS=48,ROUND_RADIUS=4,BANK_HEIGHT=3.7;
export const roundFootprint=p=>p.type==='roundTerrace'||p.type==='curvedWall'||p.footprint==='round';

function extrusion(points,height){
 const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
 const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);return g;
}
// Clip the actual circle polygon to the rectangular pieces left by a stair
// aperture. This retains empty corners AND the existing rotated floor opening.
export function roundSlab(depth,rectangle=[-4,4,-4,4]){
 let points=Array.from({length:CURVE_SEGMENTS},(_,i)=>{const a=i*Math.PI*2/CURVE_SEGMENTS;return [Math.cos(a)*ROUND_RADIUS,Math.sin(a)*ROUND_RADIUS];});
 const [x0,x1,z0,z1]=rectangle;
 for(const [axis,bound,sign] of [[0,x0,1],[0,x1,-1],[1,z0,1],[1,z1,-1]]){
  const output=[];for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],insideA=sign*(a[axis]-bound)>=-1e-9,insideB=sign*(b[axis]-bound)>=-1e-9;
   if(insideA)output.push(a);if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);output.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }points=output;if(points.length<3)return null;
 }
 const area=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
 if(area<1e-6)return null;const g=extrusion(points,depth);g.translate(0,-depth,0);g.userData.footprintArea=area;return g;
}
export function curvedWallGeometry(height=7.4,outer=4,inner=1){
 const points=[],segments=CURVE_SEGMENTS/4;
 for(let i=0;i<=segments;i++){const a=i*Math.PI/2/segments;points.push([Math.cos(a)*outer,Math.sin(a)*outer]);}
 for(let i=segments;i>=0;i--){const a=i*Math.PI/2/segments;points.push([Math.cos(a)*inner,Math.sin(a)*inner]);}
 return extrusion(points,height);
}
export function embankmentGeometry(variant=0){
 // A rough retaining toe stands above the walking step height; the rising face
 // behind it is a closed earth/stone bank, not a traversable stair substitute.
 const xs=[-4,-2.5,-.8,.9,2.6,4],zs=[4,2.8,.3,-2.6,-4],rows=zs.length,cols=xs.length,points=[];
 const heights=[1.02,1.45,2.45,3.48,BANK_HEIGHT];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const rough=row===rows-1?0:((col*7+row*11)%5-2)*.055;
  points.push([xs[col],heights[row]+rough,zs[row]]);
 }
 const positions=[],colors=[];let patch=0;
 function tri(a,b,c,tone){positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(...tone);}
 function quad(a,b,c,d,material){
  // Eight cached palettes change color attributes only. Every collision vertex
  // stays identical, while neighboring cells lose the repeated cream banding.
  const seed=(Math.imul(++patch,1103515245)^Math.imul(variant+1,12345))>>>0,t=(seed%101)/100,stone=material?t>.35:t>.83;
  const tone=(stone?[.77,.75,.68]:[.65,.51,.35]).map(value=>value*(.82+t*.22+(variant%3)*.025));
  tri(a,b,c,tone);tri(a,c,d,tone);
 }
 const at=(row,col)=>points[row*cols+col],down=p=>[p[0],0,p[2]];
 for(let row=0;row<rows-1;row++)for(let col=0;col<cols-1;col++)quad(at(row,col),at(row,col+1),at(row+1,col+1),at(row+1,col),(row+col)%4===0?1:0);
 for(let col=0;col<cols-1;col++){
  const a=at(0,col),b=at(0,col+1);quad(down(a),down(b),b,a,1);
  const c=at(rows-1,col),d=at(rows-1,col+1);quad(down(d),down(c),c,d,1);
 }
 for(let row=0;row<rows-1;row++){
  const a=at(row,0),b=at(row+1,0);quad(down(b),down(a),a,b,1);
  const c=at(row,cols-1),d=at(row+1,cols-1);quad(down(c),down(d),d,c,1);
 }
 quad([-4,0,-4],[4,0,-4],[4,0,4],[-4,0,4],1);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
