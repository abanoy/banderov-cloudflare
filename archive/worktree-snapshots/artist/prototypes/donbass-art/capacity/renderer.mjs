// Original authored geometry, shared by the browser and SVG export script.
// Coordinates use a 24-unit icon grid. No external icon library or image assets.
export const icons = [
 {id:'home',name:'Home',group:'Navigation',shape:'<path d="M3 11L12 3L21 11M5 10V21H10V15H14V21H19V10"/>'},
 {id:'back',name:'Back',group:'Navigation',shape:'<path d="M11 5L4 12L11 19M4 12H21"/>'},
 {id:'map',name:'Map',group:'Navigation',shape:'<path d="M3 5L9 3L15 5L21 3V19L15 21L9 19L3 21ZM9 3V19M15 5V21"/>'},
 {id:'bag',name:'Inventory',group:'Navigation',shape:'<rect x="4" y="8" width="16" height="13" rx="3"/><path d="M8 8V6A4 4 0 0 1 16 6V8M4 13H20M10 13V16H14V13"/>'},
 {id:'menu',name:'Menu',group:'Navigation',shape:'<path d="M4 6H20M4 12H20M4 18H20"/>'},
 {id:'play',name:'Play',group:'Actions',shape:'<path d="M7 3L21 12L7 21Z"/>'},
 {id:'plus',name:'Add',group:'Actions',shape:'<path d="M12 4V20M4 12H20"/>'},
 {id:'search',name:'Search',group:'Actions',shape:'<circle cx="10" cy="10" r="6"/><path d="M14.3 14.3L21 21"/>'},
 {id:'edit',name:'Edit',group:'Actions',shape:'<path d="M4 15L15 4L20 9L9 20L3 21ZM12 7L17 12"/>'},
 {id:'rotate',name:'Restart',group:'Actions',shape:'<path d="M19 6A8 8 0 1 0 20 16M19 3V8H14"/>'},
 {id:'heart',name:'Health',group:'Status',shape:'<path d="M12 21L4 13A5.5 5.5 0 0 1 12 5A5.5 5.5 0 0 1 20 13Z"/>'},
 {id:'shield',name:'Guard',group:'Status',shape:'<path d="M12 3L20 6V12C20 17 12 21 12 21C12 21 4 17 4 12V6Z"/>'},
 {id:'check',name:'Ready',group:'Status',shape:'<path d="M3 12L9 18L21 5"/>'},
 {id:'alert',name:'Warning',group:'Status',shape:'<path d="M12 3L22 21H2ZM12 9V14"/><circle cx="12" cy="18" r=".6" fill="currentColor"/>'},
 {id:'close',name:'Close',group:'Status',shape:'<path d="M5 5L19 19M19 5L5 19"/>'},
 {id:'sword',name:'Attack',group:'Game',shape:'<path d="M8 14L17 3H21V7L10 16M5 12L12 19M8 16L3 21M2 19L5 22"/>'},
 {id:'music',name:'Music',group:'Game',shape:'<path d="M9 17V5L20 3V15M9 8L20 6"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/>'},
 {id:'coin',name:'Coin',group:'Game',shape:'<circle cx="12" cy="12" r="9"/><path d="M12 6L16 12L12 18L8 12Z"/>'},
 {id:'star',name:'Reward',group:'Game',shape:'<path d="M12 2L15 9L22 10L17 15L18 22L12 18L6 22L7 15L2 10L9 9Z"/>'},
 {id:'flag',name:'Checkpoint',group:'Game',shape:'<path d="M5 22V3H19L16 7L19 11H5"/>'}
];
// Optical variants keep tiny details from collapsing at16px. The24px drawing is preserved.
const tinyShapes={bag:'<rect x="4" y="8" width="16" height="13" rx="3"/><path d="M8 8V6A4 4 0 0 1 16 6V8M4 13H20"/>',sword:'<path d="M8 14L17 3H21V7L10 16M5 12L12 19M8 16L3 21"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M12 7L15 12L12 17L9 12Z"/>'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function iconSVG(id,{size=24,color='#284544',stroke=1.8,badge=false,detail='auto'}={}){
 const icon=icons.find(i=>i.id===id);if(!icon)throw new Error('Unknown icon '+id);
 const tiny=detail==='tiny'||detail==='auto'&&size<=16;const shape=tiny?(tinyShapes[id]||icon.shape):icon.shape;const weight=tiny?Math.max(2,stroke):stroke;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${esc(icon.name)}" style="color:${esc(color)}"><title>${esc(icon.name)}</title>${badge?'<rect x="0" y="0" width="24" height="24" rx="5" fill="currentColor" opacity=".10"/>':''}<g fill="none" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>`;
}
const ink='#293e3b';
export const props=[
 {id:'chest',name:'Supply chest',note:'Separate lid, front and side planes give a simple depth cue.',shape:'<path d="M18 56L90 43L112 57V97L41 110L18 94Z" fill="#b56f41"/><path d="M41 70L112 57V97L41 110Z" fill="#d79450"/><path d="M18 56V38L89 25L112 38V57L41 70Z" fill="#e5b36d"/><path d="M18 38L41 52L112 38M41 52V70M18 56L41 70M41 70V110" fill="none"/><path d="M32 35L45 33L68 47V65L55 67V49ZM88 42L99 40V98L88 100Z" fill="#f2dca1"/><rect x="70" y="62" width="16" height="20" rx="3" fill="#f2dca1"/><circle cx="78" cy="71" r="2" fill="'+ink+'" stroke="none"/>'},
 {id:'potion',name:'Healing bottle',note:'Round vessel, flat liquid and one bold stopper; no painted gloss.',shape:'<path d="M48 26H80V50L92 62A28 28 0 0 1 80 108H48A28 28 0 0 1 36 62L48 50Z" fill="#edf2dc"/><path d="M36 71H92A27 27 0 0 1 79 108H49A27 27 0 0 1 36 71Z" fill="#d86b58"/><rect x="44" y="22" width="40" height="14" rx="3" fill="#a9794e"/><path d="M60 81V97M52 89H68" fill="none" stroke="#fff3d5" stroke-width="5"/>'},
 {id:'lantern',name:'Lantern',note:'Large silhouettes survive reduction; the handle needs room.',shape:'<path d="M49 35V24A15 15 0 0 1 79 24V35" fill="none"/><path d="M38 42H90L83 91H45Z" fill="#f1c96c"/><path d="M32 41L46 29H82L96 41ZM39 92H89L98 105H30Z" fill="#477970"/><path d="M48 42V91M80 42V91" fill="none"/><path d="M58 78L65 55L72 78Z" fill="#e4864e" stroke="none"/>'},
 {id:'crystal',name:'Mana crystal',note:'Polygon facets are controllable; avoid extra facets at small sizes.',shape:'<path d="M64 15L94 47L83 93L64 115L39 86L32 48Z" fill="#76b6aa"/><path d="M64 15L59 49L64 115L78 52Z" fill="#a4d1b2"/><path d="M32 48L59 49L39 86M59 49L94 47M78 52L83 93" fill="none"/>'},
 {id:'plant',name:'Potted sapling',note:'The clean leaf symbols work; irregular natural growth needs authored variation.',shape:'<path d="M64 87V38M64 61L43 43M64 73L88 54" fill="none"/><path d="M64 43A20 20 0 0 1 64 13A20 20 0 0 1 64 43Z" fill="#83ac75"/><path d="M47 48A25 18 0 0 1 24 29A25 18 0 0 1 47 48ZM81 61A24 16 0 0 1 105 42A24 16 0 0 1 81 61Z" fill="#6e9c73"/><path d="M39 86H89L82 114H46Z" fill="#d49265"/><rect x="34" y="80" width="60" height="12" rx="3" fill="#edb17c"/>'}
];
export function propSVG(id,{size=128,outline=ink}={}){const prop=props.find(p=>p.id===id);if(!prop)throw new Error('Unknown prop '+id);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}" role="img" aria-label="${esc(prop.name)}"><title>${esc(prop.name)}</title><g stroke="${esc(outline)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${prop.shape}</g></svg>`;}
