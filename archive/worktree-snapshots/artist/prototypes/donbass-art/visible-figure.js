// Bounds of pixels surviving the courtyard's alphaTest=.15, including white rim.
// Coordinates are in raster pixels; caller converts them back to SVG units.
export function visiblePixelBounds(data,width,height,threshold=255*.15){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=threshold){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<0)throw new Error('The drawing has no visible pixels.');
 return {left,top,right:right+1,bottom:bottom+1,width:right-left+1,height:bottom-top+1};
}
