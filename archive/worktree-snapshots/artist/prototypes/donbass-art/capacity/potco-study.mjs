// Authored reconstruction study from a viewed46x44 inventory icon.
// No embedded image, traced raster or external font. Wear is deterministic geometry.
export function potcoChestSVG({size=64,wear=true,key=true}={}){
 const scratches=Array.from({length:22},(_,i)=>{const x=5+(i*17%52),y=5+(i*23%52);return '<path d="M'+x+' '+y+'l'+(i%3+1)+' -1"/>';}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="Pirate inventory chest study"><title>Authored POTCO inventory chest study</title><defs>
 <linearGradient id="frame" x2=".8" y2="1"><stop stop-color="#aaa27b"/><stop offset=".48" stop-color="#716f51"/><stop offset="1" stop-color="#aaa383"/></linearGradient>
 <linearGradient id="paper" x2="1" y2="1"><stop stop-color="#9b9273"/><stop offset="1" stop-color="#747458"/></linearGradient>
 <linearGradient id="lid" x2=".35" y2="1"><stop stop-color="#514a31"/><stop offset=".5" stop-color="#343327"/><stop offset="1" stop-color="#242921"/></linearGradient>
 <linearGradient id="metal" x2="1" y2=".7"><stop stop-color="#aba893"/><stop offset=".35" stop-color="#868676"/><stop offset=".7" stop-color="#51574f"/><stop offset="1" stop-color="#9fa18e"/></linearGradient>
 </defs>
 <path d="M3 3L59 2L62 5L61 60L57 62L3 61L2 57Z" fill="url(#frame)" stroke="#343a31" stroke-width="1.6"/>
 <path d="M6 6L57 5L58 57L6 58Z" fill="url(#paper)" stroke="#c3b996" stroke-width=".7"/>
 <path d="M7 8H56M8 7V55M56 9V56M8 56H55" fill="none" stroke="#4b503c" stroke-width="1"/>
 <g transform="matrix(1.07 0 0 .78 -2 8)">
 <ellipse cx="32" cy="47" rx="22" ry="6" fill="#333b2b" opacity=".45"/>
 <path d="M15 34L48 25L50 43L20 53L13 46Z" fill="#36382b" stroke="#1d241e" stroke-width="1.7"/>
 <path d="M28 32L50 25L50 43L28 50Z" fill="#252b23"/>
 <path d="M12 33A11 11 0 0 1 28 25L28 48L18 53L12 46Z" fill="#454437" stroke="#222920" stroke-width="1.4"/>
 <path d="M12 33A11 11 0 0 1 28 25L50 18A12 10 0 0 0 35 16L17 22A11 11 0 0 0 12 33Z" fill="url(#lid)" stroke="#252b21" stroke-width="1.6"/>
 <path d="M13 32L29 27L50 20M15 40L27 36M30 39L48 33M30 45L48 39" fill="none" stroke="#66634b" stroke-width=".8"/>
 <path d="M18 23A10 10 0 0 1 23 30L25 50L21 51L19 32A10 10 0 0 0 15 25Z" fill="url(#metal)" stroke="#3f473e" stroke-width=".7"/>
 <path d="M34 17A11 10 0 0 1 40 24L41 46L36 48L35 27A12 11 0 0 0 29 19Z" fill="url(#metal)" stroke="#3f473e" stroke-width=".7"/>
 <path d="M46 17A10 10 0 0 1 50 22L51 43L47 44L46 25A9 9 0 0 0 42 18Z" fill="url(#metal)" stroke="#3f473e" stroke-width=".7"/>
 <path d="M13 34L29 29L50 22M13 46L19 51L49 41" fill="none" stroke="#9c9d85" stroke-width="1.2"/>
 <path d="M15 34L22 32L23 40L17 42Z" fill="#b5b7a3" stroke="#353f36" stroke-width=".8"/><path d="M18 36L20 35L20 39L18 40Z" fill="#283429"/>
 <g fill="#b4b39b">${[ [20,31],[22,45],[38,27],[39,41],[48,24],[49,37] ].map(([x,y])=>`<circle cx="${x}" cy="${y}" r=".6"/>`).join('')}</g></g>
 ${wear?'<g fill="none" stroke="#d6ce9c" stroke-width=".6" opacity=".26">'+scratches+'</g><path d="M4 16L6 13M58 6L61 9M4 54L7 57M49 60L52 57" stroke="#424b36" fill="none"/>':''}
 ${key?'<path d="M53 49H59V50H57V58H59V59H53V58H55V50H53Z" fill="#e2ddc1" stroke="#363d30" stroke-width=".8"/>':''}
 </svg>`;
}
