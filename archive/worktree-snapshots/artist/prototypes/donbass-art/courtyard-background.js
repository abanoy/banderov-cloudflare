// Contrast-only inspection: keep character material, texture and geometry fixed.
export const COURTYARD_BACKGROUNDS={
 courtyard:{sky:'#bcc9c2',floor:'#c6ccb9',grid:'#ffffff'},
 paper:{sky:'#f5f1e7',floor:'#ece7dc',grid:'#737373'},
 night:{sky:'#101622',floor:'#171e2b',grid:'#546079'}
};
export function applyCourtyardBackground(key,scene,floor,grid){
 const colours=COURTYARD_BACKGROUNDS[key]||COURTYARD_BACKGROUNDS.courtyard;
 scene.background.set(colours.sky);floor.material.color.set(colours.floor);
 for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.color.set(colours.grid);
}
