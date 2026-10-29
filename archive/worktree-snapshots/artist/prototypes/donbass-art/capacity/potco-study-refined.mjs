// Second reference study. All forms, material marks and lettering are editable SVG.
// Construction grid: 128 square. The barrel end is at left; depth rises to the right.
const END = 'M25 61 A17 18 -28 0 1 57 65 L57 103 L26 85Z';
const LID = 'M25 61 A17 18 -28 0 1 57 65 L105 40 A17 18 -28 0 0 73 36Z';
const SIDE = 'M57 65 L105 40 L104 78 L57 103Z';
const n = v => Number(v.toFixed(2));

function random(seed) {
  return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
}
function flecks(count, seed, colours, bounds, scale=1) {
  const rand=random(seed), [x,y,w,h]=bounds;
  return Array.from({length:count},()=>{
    const px=n(x+rand()*w), py=n(y+rand()*h), r=n((.18+rand()*.65)*scale);
    const fill=colours[Math.floor(rand()*colours.length)];
    return `<path d="M${px} ${py}l${r} ${n(-r*.25)} ${n(r*.9)} ${n(r*.55)} ${n(-r*.5)} ${n(r*.8)} ${n(-r*1.2)} ${n(-r*.2)}Z" fill="${fill}" opacity="${n(.15+rand()*.3)}"/>`;
  }).join('');
}

export function potcoChestRefinedSVG({size=64,wear=true,key=true,id='p2'}={}) {
  if(!Number.isFinite(size)||size<=0) throw new TypeError('size must be positive');
  if(!/^[a-zA-Z][\w-]*$/.test(id)) throw new TypeError('id must be an SVG-safe unique prefix');
  const url=name=>`url(#${id}-${name})`;
  const grain=wear ? `
    <g clip-path="${url('paperClip')}" opacity=".55">${flecks(1050,19,['#e2dfb0','#c5bea0','#35392b','#5d6147'],[3,3,122,122],.95)}</g>` : '';
  const chestGrain=wear ? `
    <g clip-path="${url('chestClip')}">${flecks(350,86,['#bdb699','#d2cdd0','#130f10','#63594e'],[23,18,84,88],.9)}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128" role="img" aria-label="Weathered pirate inventory chest"><title>Rebuilt inventory chest — editable geometry</title>
  <defs>
    <linearGradient id="${id}-paper" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#8a8564"/><stop offset=".45" stop-color="#9b9676"/><stop offset="1" stop-color="#696e52"/></linearGradient>
    <radialGradient id="${id}-paperLight" cx=".42" cy=".37" r=".75"><stop stop-color="#c9bf91" stop-opacity=".24"/><stop offset="1" stop-color="#272e23" stop-opacity=".28"/></radialGradient>
    <linearGradient id="${id}-lid" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#6b6245"/><stop offset=".3" stop-color="#4d4532"/><stop offset=".7" stop-color="#342d24"/><stop offset="1" stop-color="#221f1b"/></linearGradient>
    <linearGradient id="${id}-side" x1="0" y1="0" x2=".85" y2=".6"><stop stop-color="#28201e"/><stop offset=".5" stop-color="#31291f"/><stop offset="1" stop-color="#161813"/></linearGradient>
    <linearGradient id="${id}-end" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#58525b"/><stop offset=".28" stop-color="#332a38"/><stop offset=".65" stop-color="#55484c"/><stop offset="1" stop-color="#272329"/></linearGradient>
    <linearGradient id="${id}-iron" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#bbb5a1"/><stop offset=".28" stop-color="#70675e"/><stop offset=".65" stop-color="#444039"/><stop offset="1" stop-color="#77705f"/></linearGradient>
    <linearGradient id="${id}-endIron" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#bbb9b0"/><stop offset=".3" stop-color="#8b818d"/><stop offset=".65" stop-color="#5f5664"/><stop offset="1" stop-color="#726c70"/></linearGradient>
    <clipPath id="${id}-paperClip"><path d="M4 5H123V123H4Z"/></clipPath>
    <clipPath id="${id}-chestClip"><path d="${LID}"/><path d="${SIDE}"/><path d="${END}"/></clipPath>
  </defs>
  <!-- A narrow worn frame; the object receives the visual emphasis. -->
  <path d="M2 2L125 1L126 126L2 125Z" fill="#34392b"/>
  <path d="M5 5L121 4L122 121L5 123Z" fill="${url('paper')}"/>
  <path d="M5 5L121 4L122 121L5 123Z" fill="${url('paperLight')}"/>
  <path d="M3 3L123 2L124 124L3 124Z" fill="none" stroke="#d2d0b0" stroke-width=".7"/>
  <path d="M7 7L119 6M7 7L7 119" stroke="#464c38" stroke-width="1.2" fill="none"/>
  <path d="M9 120L120 120L119 8" stroke="#b1ad85" stroke-width=".7" fill="none"/>
  ${grain}
  <!-- Pale worn contour, then coherent end/lid/side planes. -->
  <g fill="none" stroke="#d4cba6" stroke-width="3.8" opacity=".7" stroke-linejoin="round"><path d="${LID}"/><path d="${END}"/><path d="${SIDE}"/></g>
  <path d="${SIDE}" fill="${url('side')}" stroke="#28271d" stroke-width="1.1"/>
  <path d="${END}" fill="${url('end')}" stroke="#4b4542" stroke-width="1"/>
  <path d="${LID}" fill="${url('lid')}" stroke="#655e43" stroke-width="1"/>
  <!-- Broad, irregular tonal patches model the rounded lid without glossy stripes. -->
  <path d="M27 51L76 26L86 24L43 48L35 51Z" fill="#8f8060" opacity=".27"/>
  <path d="M37 45L78 24L83 24L42 46Z" fill="#bbb18b" opacity=".25"/>
  <path d="M45 48L88 26L94 30L50 53Z" fill="#28231e" opacity=".48"/>
  <path d="M54 58L100 34L103 40L57 65Z" fill="#231e18" opacity=".63"/>
  <path d="M61 69L77 60L77 87L62 96Z" fill="#54402a" opacity=".21"/>
  <path d="M83 56L101 46L100 75L84 86Z" fill="#0e100d" opacity=".27"/>
  <!-- Lid seams follow depth; the fine lines remain subordinate at game size. -->
  <path d="M29 49L77 25M39 47L86 23M50 53L96 28M55 60L102 35" fill="none" stroke="#191b15" stroke-width=".65" opacity=".6"/>
  <path d="M60 78L102 56M60 91L102 69" fill="none" stroke="#100f0d" stroke-width=".85" opacity=".65"/>
  <!-- Thin iron hoops wrap over the barrel, then down the long front wall. -->
  <path d="M34 45L38 43 A20 20 -28 0 1 62 63L62 100L58 103L57 65A17 18 -28 0 0 34 45Z" fill="${url('iron')}"/>
  <path d="M60 32L64 30 A20 20 -28 0 1 87 50L87 87L83 89L82 52A17 18 -28 0 0 60 32Z" fill="${url('iron')}"/>
  <path d="M80 22L84 20 A20 20 -28 0 1 105 40L104 78L101 80L101 42A17 18 -28 0 0 80 22Z" fill="${url('iron')}"/>
  <path d="M36 44A20 20 -28 0 1 60 64L60 100M62 31A20 20 -28 0 1 85 51L85 87" fill="none" stroke="#b5ab8e" stroke-width=".65" opacity=".52"/>
  <!-- End cap: cool rubbed metal, irregular dark inset, small latch. -->
  <path d="M25 61L29 64L30 83L55 98L55 103L26 85Z" fill="${url('endIron')}"/>
  <path d="M25 59L29 59L32 66L55 79L55 83L29 68Z" fill="${url('endIron')}"/>
  <path d="M29 50L32 48L35 52L34 57L29 58Z" fill="#aaa3aa"/>
  <path d="M31 56L34 57L34 67L31 65Z" fill="#25202b" stroke="#b7aeb5" stroke-width=".6"/>
  <path d="M35 64L42 68L42 77L36 74Z" fill="#827781" stroke="#332c33" stroke-width=".6"/>
  <path d="M38 68L40 69L40 73L38 72Z" fill="#25222a"/>
  <path d="M28 75L35 80L39 79L47 85L52 84L54 94L45 91L42 92L29 84Z" fill="#8c818b" opacity=".38"/>
  <path d="M29 83L55 99M58 102L103 78M26 62L29 64M76 24L83 22L90 24" fill="none" stroke="#d2c9b6" stroke-width=".8" opacity=".6"/>
  ${chestGrain}
  <g fill="#c7bfb0" opacity=".7">${[[30,65],[32,82],[52,94],[60,71],[60,95],[85,58],[85,82],[103,47],[102,73]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r=".65"/>`).join('')}</g>
  ${wear?'<path d="M2 2L8 3M2 2L3 9M125 1L120 5M126 126L120 123M2 125L7 121" fill="none" stroke="#dddcc8" stroke-width="1.3"/><path d="M5 28L6 40M122 89V100M46 123H53" fill="none" stroke="#2c3529" stroke-width="1.2"/>':''}
  ${key?'<path d="M96 99L111 98V101L107 102V118H111V121H96V118H100V103L96 103Z" fill="#e4e2bc" stroke="#292e22" stroke-width="1.5" stroke-linejoin="round"/><path d="M99 100H109M102 104V118M99 119H109" fill="none" stroke="#fffbe3" stroke-width=".7"/>':''}
  </svg>`;
}
