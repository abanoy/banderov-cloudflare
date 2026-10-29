/* Crusaders chibi kit: composes a chibi SVG from parts.
   Style: Idols proportions, ink and sticker border, with lineless soft two-tone fills
   and tinted (not inked) detail lines.
   Head space: skull ellipse rx98 ry88 at origin. Body space: origin at the neck, shoes at y~136. */
(function (root) {
'use strict';
// ------------------------------------------------------------ colour
function rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255); }
function hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join(''); }
function toHsl([r, g, b]) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function fromHsl(h, s, l) { if (!s) return [l, l, l]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }
function shade(c, dl, ds = 0) { const [h, s, l] = toHsl(rgb(c)); return hex(...fromHsl(h, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl)))); }

const LINE = '#28223c', LW = 4.8;
const HEAD = { x: 200, y: 272, s: 1.17 }, BODY = { x: 200, y: 370, s: .86 };

// ------------------------------------------------------------ drawing context
function Ctx(scale, defs, pfx) { this.sw = LW / scale; this.defs = defs; this.pfx = pfx; }
Ctx.prototype.F = function (c) {
  if (!c || c[0] !== '#') return c;
  const id = this.pfx + 'g' + c.slice(1);
  if (!this.defs[id]) this.defs[id] = `<linearGradient id="${id}" x1=".1" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${shade(c, .05)}"/><stop offset=".58" stop-color="${c}"/><stop offset=".58" stop-color="${shade(c, -.075, .05)}"/><stop offset="1" stop-color="${shade(c, -.075, .05)}"/></linearGradient>`;
  return `url(#${id})`;
};
const P = (x, d, f, e = '') => `<path d="${d}" fill="${x.F(f)}" ${e}/>`;
const NL = (d, f, e = '') => `<path d="${d}" fill="${f}" stroke="none" ${e}/>`;
const E = (x, cx, cy, rx, ry, f, e = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${x.F(f)}" ${e}/>`;
const C = (x, cx, cy, r, f, e = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${x.F(f)}" ${e}/>`;
const L = (x, d, w, col, e = '') => `<path d="${d}" fill="none" stroke="${col || LINE}" stroke-width="${(w == null ? x.sw : w).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" ${e}/>`;
// tinted detail line (lineless DNA); very dark fills get a lighter line so the detail still reads
const T = (x, d, f, c) => L(x, d, x.sw * .62, toHsl(rgb(f))[2] < .26 ? shade(f, .13) : shade(f, -.24));
const tube = (x, d, w, f) => L(x, d, w) + L(x, d, w - 2 * x.sw, f);
const mirror = s => s ? `<g transform="scale(-1,1)">${s}</g>` : '';
const hl = (x, cx, cy, rx, ry, rot = 0, op = .85) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity="${op}" stroke="none"/>`;
const R = (x, X, Y, w, h, r, f, e = '') => `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="${r}" fill="${x.F(f)}" ${e}/>`;
function star(cx, cy, r, f) { let p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); } return `<polygon points="${p.join(' ')}" fill="${f}" stroke="none"/>`; }

// ------------------------------------------------------------ body kit
function arm(x, side, o) {
  const ang = { down: 26, hold: 18, out: 40 }[o.pose || 'down'];
  const a = side > 0 ? -ang : ang, x0 = side < 0 ? -32 : 32, w = o.w || 20;
  let s = `<g transform="translate(${x0},6) rotate(${a})">`;
  s += R(x, -w / 2, -6, w, 58, w / 2, o.skin);
  if (o.sleeveLen) s += R(x, -w / 2 - 2, -6, w + 4, o.sleeveLen, (w + 4) / 2, o.sleeve);
  if (o.cuff) s += R(x, -w / 2 - 1, 42, w + 2, 9, 4, o.cuff);
  s += C(x, 0, 60, (w * .62).toFixed(1), o.hand || o.skin);
  return s + '</g>';
}
const arms = (x, o) => arm(x, -1, o) + arm(x, 1, Object.assign({}, o, { pose: o.poseR || o.pose }));
function legs(x, o) {
  const top = o.top || 82, w = o.w || 18; let s = '';
  for (const X of [-24, 6]) {
    s += R(x, X, top, w, 132 - top, 8, o.leg);
    if (o.sock) s += R(x, X, o.sockTop || 108, w, 132 - (o.sockTop || 108), 6, o.sock);
  }
  for (const X of [-16, 16]) { s += E(x, X, 135, o.shoeRx || 15, 10, o.shoe); s += `<ellipse cx="${X - 4}" cy="131" rx="5" ry="2.6" fill="#fff" opacity=".55" stroke="none"/>`; }
  return s;
}
const TORSO = 'M-30,-6 Q-38,30 -44,66 Q-45,74 -37,74 L37,74 Q45,74 44,66 Q38,30 30,-6 Z';
const DRESS = 'M-30,-6 Q-42,40 -60,116 Q-62,126 -48,126 L48,126 Q62,126 60,116 Q42,40 30,-6 Z';
const SHORTS = 'M-44,58 L44,58 L46,94 L4,94 L0,84 L-4,94 L-46,94 Z';
const PANTS = 'M-44,58 L44,58 L44,120 L4,120 L0,90 L-4,120 L-44,120 Z';

// ------------------------------------------------------------ faces (Idols DNA)
const EYES = {
  dot: 'Bright', happy: 'Happy', half: 'Unimpressed', sparkle: 'Starry', sharp: 'Determined', wink: 'Wink',
};
const MOUTHS = { smile: 'Smile', cat: 'Cat', grin: 'Grin', open: 'Cheer', frown: 'Frown', tongue: 'Cheeky' };
function face(x, f) {
  const ink = shade(f.eyeColor, -.28, .1);
  let s = '';
  if (f.blush) for (const X of [-60, 60]) {
    s += `<ellipse cx="${X}" cy="50" rx="15" ry="8" fill="#ff9ab8" stroke="none"/>`;
    for (const k of [-6, 0, 6]) s += L(x, `M${X + k - 3},55 L${X + k + 3},45`, 2.2, '#ff5f93');
  }
  const eye = (X, kind, flip) => {
    const y = 24;
    if (kind === 'happy') return L(x, `M${X - 13},${y + 4} Q${X},${y - 14} ${X + 13},${y + 4}`, 6, ink);
    if (kind === 'half') return `<path d="M${X - 11},${y - 2} L${X + 11},${y - 2} Q${X + 11},${y + 14} ${X},${y + 14} Q${X - 11},${y + 14} ${X - 11},${y - 2} Z" fill="${ink}" stroke="none"/>` + L(x, `M${X - 14},${y - 3} L${X + 14},${y - 3}`, 5) + `<circle cx="${X - 4}" cy="${y + 3}" r="2.6" fill="#fff" stroke="none"/>`;
    if (kind === 'sharp') return `<path d="M${X - 11},${y - 6 + (flip ? 6 : 0)} L${X + 11},${y - 6 + (flip ? 0 : 6)} Q${X + 11},${y + 14} ${X},${y + 14} Q${X - 11},${y + 14} ${X - 11},${y - 6 + (flip ? 6 : 0)} Z" fill="${ink}" stroke="none"/>` + L(x, `M${X - 15},${y - 10 + (flip ? 9 : 0)} L${X + 15},${y - 10 + (flip ? 0 : 9)}`, 5) + `<circle cx="${X - 3}" cy="${y + 4}" r="2.6" fill="#fff" stroke="none"/>`;
    const big = kind === 'sparkle' ? 1.3 : 1, rx = 10 * big, ry = 14 * big;
    let e = `<ellipse cx="${X}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}" stroke="none"/>`;
    e += `<ellipse cx="${X}" cy="${y + 5 * big}" rx="${rx * .7}" ry="${ry * .45}" fill="${f.eyeColor}" opacity=".9" stroke="none"/>`;
    e += `<ellipse cx="${X - 3 * big}" cy="${y - 5 * big}" rx="${4 * big}" ry="${5 * big}" fill="#fff" stroke="none"/>`;
    if (big > 1) e += `<circle cx="${X + 4 * big}" cy="${y + 6 * big}" r="${2 * big}" fill="#fff" stroke="none"/>`;
    return e;
  };
  if (f.eyes === 'wink') s += eye(-40, 'happy') + eye(40, 'dot');
  else s += eye(-40, f.eyes, false) + eye(40, f.eyes, true);
  const m = f.mouth;
  if (m === 'smile') s += L(x, 'M-9,57 Q0,64 9,57', 4);
  if (m === 'cat') s += L(x, 'M-10,56 Q-5,62 0,57 Q5,62 10,56', 4);
  if (m === 'frown') s += L(x, 'M-9,63 Q0,56 9,63', 4.2);
  if (m === 'open') { s += `<path d="M-14,50 Q0,53 14,50 Q12,70 0,70 Q-12,70 -14,50 Z" fill="${LINE}"/>`; s += NL('M-7,64 Q0,59 7,64 Q4,68 0,68 Q-4,68 -7,64 Z', '#ff7fa6'); }
  if (m === 'grin') { s += `<path d="M-16,52 Q4,57 18,46 Q14,66 0,66 Q-12,66 -16,52 Z" fill="${LINE}"/>`; s += NL('M-14,53 Q4,57 17,47 L15,52 Q4,59 -12,57 Z', '#fff'); }
  if (m === 'tongue') { s += L(x, 'M-6,56 Q4,62 14,54', 4); s += P(x, 'M0,59 Q2,73 10,72 Q16,66 12,58 Z', '#ff7fa6'); }
  return s;
}

// ------------------------------------------------------------ hair
// back: mass behind the head (front view) / over the skull (back view)
// front: bangs and locks; drape: long hair in body space; lines: back-view strands
function bangShadow(x, d, skin) {
  const id = x.pfx + 'hc'; x.defs[id] = `<clipPath id="${id}"><ellipse cx="0" cy="0" rx="97" ry="87"/></clipPath>`;
  return `<g clip-path="url(#${id})"><path d="${d}" transform="translate(0,9)" fill="${shade(skin, -.08, .1)}" stroke="none"/></g>`;
}
const DOME = 'M-102,-6 C-106,-80 -52,-108 0,-108 C52,-108 106,-80 102,-6';
const HAIRS = {
  bald: { name: 'Shaved', back: null },
  short: { name: 'Short tufts',
    back: DOME + ' C104,22 98,40 90,52 Q0,70 -90,52 C-98,40 -104,22 -102,-6 Z',
    front: 'M-100,8 C-104,-72 -50,-100 0,-100 C50,-100 104,-72 100,8 L90,-16 L80,-2 L70,-26 L54,-10 L40,-34 L24,-14 L8,-40 L-8,-16 L-24,-38 L-40,-12 L-54,-30 L-68,-6 L-82,-22 L-90,-4 Z',
    lines: 'M0,-100 L-4,40 M40,-90 Q52,-20 56,44 M-40,-90 Q-52,-20 -56,44' },
  flip: { name: 'Flipped bob',
    back: DOME + ' C104,34 100,70 112,94 C120,106 134,106 144,98 C136,122 106,128 90,112 C78,100 76,82 72,62 Q0,84 -72,62 C-76,82 -78,100 -90,112 C-106,128 -136,122 -144,98 C-134,106 -120,106 -112,94 C-100,70 -104,34 -102,-6 Z',
    front: 'M-100,10 C-104,-72 -50,-100 0,-100 C50,-100 104,-72 100,10 L90,-14 L84,8 L70,-22 L58,0 L44,-30 L30,-4 L14,-36 L2,-6 L-12,-34 L-26,-2 L-40,-30 L-54,0 L-66,-24 L-80,6 L-88,-12 Z',
    locks: 'M-100,-14 C-110,24 -106,62 -90,86 C-88,56 -84,28 -78,-2 Z',
    lines: 'M0,-100 Q-4,-40 -20,40 M30,-90 Q40,-20 52,50 M-34,-88 Q-50,-20 -60,46' },
  hime: { name: 'Long straight',
    back: DOME + ' L104,96 L-104,96 L-102,-6 Z',
    front: 'M-100,4 C-104,-74 -52,-100 0,-100 C52,-100 104,-74 100,4 L100,8 L-100,8 Z',
    locks: 'M-100,-6 L-100,94 L-76,94 L-76,8 Z',
    drape: 'M-80,-14 L-92,118 Q-78,132 -62,122 Q-46,134 -30,124 Q-15,136 0,126 Q15,136 30,124 Q46,134 62,122 Q78,132 92,118 L80,-14 Z',
    bangLines: 'M-76,8 L-76,-6 M-52,8 L-52,-6 M-28,8 L-28,-6 M-4,8 L-4,-6 M20,8 L20,-6 M44,8 L44,-6 M68,8 L68,-6',
    lines: 'M-50,-80 L-50,96 M0,-100 L0,96 M50,-80 L50,96', drapeLines: 'M-50,-10 L-54,124 M0,-10 L0,128 M50,-10 L54,124' },
  wavy: { name: 'Long waves',
    back: DOME + ' C108,30 112,70 104,104 C112,110 112,120 100,126 Q0,120 -100,126 C-112,120 -112,110 -104,104 C-112,70 -108,30 -102,-6 Z',
    front: 'M-98,2 C-98,-60 -60,-84 0,-84 C60,-84 98,-60 98,2 Q80,-20 60,-24 Q40,-6 18,-30 Q0,-10 -22,-30 Q-44,-6 -62,-26 Q-82,-20 -98,2 Z',
    lines: 'M-60,-40 Q-70,40 -80,110 M0,-40 L0,118 M60,-40 Q70,40 80,110' },
  twin: { name: 'Twin tails',
    back: DOME + ' C104,22 98,40 90,52 Q0,70 -90,52 C-98,40 -104,22 -102,-6 Z',
    tails: true,
    front: 'M-98,6 C-98,-60 -56,-86 0,-86 C56,-86 98,-60 98,6 Q84,-10 74,-16 Q58,4 38,-22 Q20,-4 0,-26 Q-20,-4 -38,-22 Q-58,4 -74,-16 Q-84,-10 -98,6 Z',
    lines: 'M0,-100 L0,50 M-40,-90 Q-50,-20 -54,44 M40,-90 Q50,-20 54,44' },
  pony: { name: 'High ponytail',
    back: DOME + ' C104,22 98,40 90,52 Q0,70 -90,52 C-98,40 -104,22 -102,-6 Z',
    pony: true,
    front: 'M-98,8 C-100,-66 -54,-92 0,-92 C54,-92 100,-66 98,8 Q86,-24 62,-40 Q30,-16 -6,-42 Q-40,-16 -70,-34 Q-90,-20 -98,8 Z',
    lines: 'M0,-100 Q0,-60 0,-30 M-40,-90 Q-50,-20 -54,44 M40,-90 Q50,-20 54,44' },
  side: { name: 'Side-swept bob',
    back: DOME + ' C108,40 114,70 126,86 Q100,100 84,84 Q0,70 -84,84 Q-100,100 -126,86 C-114,70 -108,40 -102,-6 Z',
    front: 'M-96,10 C-102,-70 -50,-98 6,-98 C60,-98 102,-66 98,10 Q90,-20 72,-34 Q40,-20 20,-44 Q-10,0 -40,60 Q-60,80 -76,64 Q-60,40 -58,10 Q-80,20 -96,10 Z',
    frontLines: 'M-6,-80 Q-30,-20 -54,40 M30,-70 Q10,-40 -10,0',
    lines: 'M0,-100 L0,70 M-50,-80 Q-60,0 -80,80 M50,-80 Q60,0 80,80' },
  quiff: { name: 'Tall quiff',
    back: 'M-96,24 C-104,-60 -60,-100 0,-100 C60,-100 104,-60 96,24 Q0,70 -96,24 Z',
    sides: true, lines: 'M-46,-86 Q-62,-30 -66,36 M0,-98 L0,58 M46,-86 Q62,-30 66,36',
    quiff: 'M-86,-30 C-96,-80 -60,-104 -10,-106 C10,-150 40,-196 88,-214 C70,-180 66,-150 72,-120 C96,-100 100,-60 90,-30 Q60,-60 0,-58 Q-50,-60 -86,-30 Z' },
  curls: { name: 'Ringlets',
    back: DOME + ' C112,40 118,80 108,116 Q118,130 104,140 Q86,134 80,116 Q0,96 -80,116 Q-86,134 -104,140 Q-118,130 -108,116 C-118,80 -112,40 -102,-6 Z',
    front: 'M-96,6 C-98,-60 -56,-84 0,-84 C56,-84 98,-60 96,6 Q84,-10 74,-16 Q58,4 38,-22 Q20,-4 0,-26 Q-20,-4 -38,-22 Q-58,4 -74,-16 Q-84,-10 -96,6 Z',
    locks: 'M-100,10 C-116,40 -112,80 -96,104 Q-108,116 -96,128 Q-78,124 -80,106 Q-90,80 -82,30 Z',
    lines: 'M-50,-60 Q-60,40 -70,118 M0,-80 L0,104 M50,-60 Q60,40 70,118' },
};
function tails(x, c) { // twin tails, head space, behind head
  const d = 'M-92,-40 C-140,-40 -150,20 -136,70 C-128,100 -140,120 -150,134 C-120,132 -104,110 -108,80 C-112,40 -104,0 -84,-24 Z';
  return P(x, d, c) + mirror(P(x, d, c)) + T(x, 'M-120,-20 C-138,20 -130,70 -132,110', c) + mirror(T(x, 'M-120,-20 C-138,20 -130,70 -132,110', c)) +
    E(x, -92, -42, 13, 13, '#ff6fae') + mirror(E(x, -92, -42, 13, 13, '#ff6fae'));
}
function pony(x, c, back) {
  const d = 'M-14,-96 C30,-150 96,-120 92,-50 C90,-10 108,20 118,40 C90,40 70,10 66,-30 C62,-70 34,-90 -14,-96 Z';
  return (back ? mirror(P(x, d, c)) : P(x, d, c)) + E(x, back ? 6 : -6, -96, 14, 10, '#ff6fae');
}
function hairBack(x, h, c, view) { // view: 'front' | 'back'
  const H = HAIRS[h]; if (!H.back) return '';
  let s = '';
  if (H.tails && view === 'front') s += tails(x, c);
  if (H.pony && view === 'front') s += pony(x, c, false);
  s += P(x, H.back, c);
  if (view === 'back') {
    if (H.lines) s += T(x, H.lines, c);
    if (H.locks) s += P(x, H.locks, c) + mirror(P(x, H.locks, c));
    if (H.tails) s += tails(x, c);
    if (H.pony) s += pony(x, c, true);
    if (H.quiff) s += mirror(P(x, H.quiff, c) + T(x, 'M-30,-80 C0,-120 30,-170 70,-196 M0,-70 C30,-100 50,-140 76,-150', c));
    s += hl(x, -40, -80, 22, 7, -20) + hl(x, 40, -80, 22, 7, 20);
  }
  return s;
}
function hairFront(x, h, c, skin, noShadow) {
  const H = HAIRS[h]; let s = '';
  if (H.sides) { const d = 'M-98,-4 Q-100,-40 -86,-50 L-80,-6 Z'; s += P(x, d, shade(c, .08)) + mirror(P(x, d, shade(c, .08))); }
  if (H.front) { s += (noShadow ? '' : bangShadow(x, H.front, skin)) + P(x, H.front, c); }
  if (H.bangLines) s += T(x, H.bangLines, c);
  if (H.frontLines) s += T(x, H.frontLines, c);
  if (H.locks) s += P(x, H.locks, c) + mirror(P(x, H.locks, c));
  if (H.quiff) { s += P(x, H.quiff, c) + T(x, 'M-30,-80 C0,-120 30,-170 70,-196 M0,-70 C30,-100 50,-140 76,-150', c) + hl(x, 20, -120, 22, 6, -52); }
  if (H.front) s += hl(x, -50, -70, 20, 7, -28) + hl(x, 44, -74, 14, 5, 24);
  if (!H.back) s += hl(x, -46, -52, 22, 9, -30, .6);
  return s;
}
function hairDrape(x, h, c, view) {
  const H = HAIRS[h]; if (!H.drape) return '';
  return P(x, H.drape, c) + (view === 'back' ? T(x, H.drapeLines, c) : '');
}

// ------------------------------------------------------------ hats  (front, back) in head space
const STEEL = '#c3ccd8', STEEL_D = '#8a95a6', GOLDC = '#f2c14e', LEATHER = '#7a4a2e', WOOD = '#8a5a34';
function hood(x, c, back) {
  if (back) return P(x, 'M-112,10 C-118,-80 -60,-122 0,-122 C60,-122 118,-80 112,10 C116,50 108,80 96,96 L0,150 L-96,96 C-108,80 -116,50 -112,10 Z', c) + T(x, 'M0,-120 L0,140 M-50,-100 Q-70,0 -70,90 M50,-100 Q70,0 70,90', c);
  const outer = 'M-114,40 C-122,-70 -62,-124 0,-124 C62,-124 122,-70 114,40 C112,74 100,96 84,104 Q0,118 -84,104 C-100,96 -112,74 -114,40 Z M-78,40 C-84,-30 -50,-82 0,-82 C50,-82 84,-30 78,40 C72,80 40,94 0,94 C-40,94 -72,80 -78,40 Z';
  return P(x, outer, c, 'fill-rule="evenodd"') + T(x, 'M-86,40 C-92,-40 -54,-92 0,-94 C54,-92 92,-40 86,40', c) + hl(x, -60, -96, 22, 7, -30, .5);
}
const HATS = {
  none: { name: 'No hat', draw: () => '' },
  helm: { name: 'Plumed helm', hides: 'top', draw(x, col, back) {
    let s = back ? P(x, 'M-106,-4 C-110,-86 -52,-114 0,-114 C52,-114 110,-86 106,-4 L102,62 Q0,84 -102,62 Z', STEEL) + T(x, 'M0,-112 L0,70', STEEL)
      : P(x, 'M-106,-4 C-110,-86 -52,-114 0,-114 C52,-114 110,-86 106,-4 L100,48 L80,52 L78,-12 Q0,-30 -78,-12 L-80,52 L-100,48 Z', STEEL) + P(x, 'M-80,-12 Q0,-32 80,-12 L82,-26 Q0,-48 -82,-26 Z', STEEL_D) + P(x, 'M-8,-30 L8,-30 L6,-8 L-6,-8 Z', STEEL_D);
    s += P(x, 'M-6,-112 C0,-164 54,-178 92,-146 C62,-152 34,-138 22,-110 Z', col.p) + T(x, 'M10,-118 C24,-150 50,-160 76,-152', col.p);
    return s + hl(x, -48, -76, 26, 8, -30, .7); } },
  horned: { name: 'Horned helm', hides: 'top', draw(x, col, back) {
    const horn = 'M-90,-56 C-130,-70 -150,-110 -136,-150 C-124,-120 -104,-104 -78,-90 Z';
    let s = P(x, horn, '#f3ead6') + mirror(P(x, horn, '#f3ead6'));
    s += P(x, 'M-104,-20 C-108,-90 -52,-112 0,-112 C52,-112 108,-90 104,-20 Q0,-44 -104,-20 Z', STEEL);
    s += P(x, 'M-106,-24 Q0,-50 106,-24 L104,-8 Q0,-34 -104,-8 Z', GOLDC);
    if (!back) s += P(x, 'M-7,-30 L7,-30 L5,14 L-5,14 Z', STEEL_D);
    return s + hl(x, -46, -80, 24, 7, -26, .7); } },
  headband: { name: 'Headband', band: true, draw(x, col, back) {
    let s = P(x, 'M-100,-26 Q0,-62 100,-26 L98,-8 Q0,-44 -98,-8 Z', col.p);
    if (back) s += P(x, 'M0,-36 L-16,30 L-4,26 Z', col.p) + P(x, 'M6,-36 L24,24 L12,28 Z', col.p) + E(x, 2, -36, 9, 8, shade(col.p, -.05));
    else s += P(x, 'M96,-20 L132,-2 L120,14 L92,-6 Z', col.p) + P(x, 'M96,-16 L136,-24 L132,-6 Z', col.p);
    return s; } },
  cap: { name: 'Feathered cap', hides: 'top', draw(x, col, back) {
    let s = P(x, 'M-108,-30 C-100,-110 40,-130 112,-60 L118,-40 Q0,-70 -108,-30 Z', col.p);
    s += P(x, 'M-108,-34 Q0,-74 116,-44 L118,-34 Q0,-62 -108,-22 Z', shade(col.p, -.1));
    const f = back ? 'M-60,-60 C-110,-120 -150,-150 -170,-150 C-140,-110 -110,-80 -70,-50 Z' : 'M60,-60 C110,-120 150,-150 170,-150 C140,-110 110,-80 70,-50 Z';
    s += P(x, f, col.a) + T(x, back ? 'M-68,-56 C-110,-100 -140,-130 -164,-146' : 'M68,-56 C110,-100 140,-130 164,-146', col.a);
    return s + hl(x, -30, -96, 26, 7, -14, .6); } },
  hood: { name: 'Hood', hides: 'all', draw: (x, col, back) => hood(x, col.p, back) },
  wizard: { name: 'Pointed hat', hides: 'top', draw(x, col, back) {
    let s = E(x, 0, -58, 140, 28, shade(col.p, -.12));
    s += P(x, 'M-76,-64 Q-62,-150 6,-196 Q38,-218 76,-202 Q46,-198 34,-170 Q60,-122 78,-64 Q0,-46 -76,-64 Z', col.p);
    s += P(x, 'M-78,-66 Q0,-48 80,-66 L76,-84 Q0,-68 -74,-84 Z', col.a);
    s += back ? star(26, -112, 11, '#ffe78a') + star(-20, -142, 7, '#ffe78a') : star(-30, -112, 11, '#ffe78a') + star(24, -140, 7, '#ffe78a') + star(-2, -96, 5, '#ffe78a');
    s += C(x, 80, -200, 7, '#ffe78a');
    return s + hl(x, -40, -128, 6, 22, 20, .45); } },
  circlet: { name: 'Gem circlet', band: true, draw(x, col, back) {
    let s = P(x, 'M-100,-34 Q0,-74 100,-34 L98,-24 Q0,-62 -98,-24 Z', GOLDC);
    if (!back) s += P(x, 'M-12,-56 L0,-76 L12,-56 L0,-40 Z', col.a) + hl(x, -3, -62, 3, 6, 0, .9);
    return s; } },
  workcap: { name: 'Work cap', hides: 'top', draw(x, col, back) {
    let s = P(x, 'M-104,-20 C-106,-96 -50,-118 0,-118 C50,-118 106,-96 104,-20 Q0,-44 -104,-20 Z', col.p);
    if (!back) s += P(x, 'M-100,-24 Q0,-50 100,-24 Q120,-10 140,-14 Q120,6 98,-2 Q0,-26 -100,-2 Z', shade(col.p, -.1));
    else s += P(x, 'M-104,-22 Q0,-46 104,-22 L102,-10 Q0,-34 -102,-10 Z', shade(col.p, -.1));
    s += T(x, 'M0,-118 L0,-44 M-50,-108 Q-60,-70 -62,-38 M50,-108 Q60,-70 62,-38', col.p);
    return s + C(x, 0, -116, 7, col.a) + hl(x, -44, -90, 22, 7, -26, .55); } },
  goggles: { name: 'Goggles', band: true, draw(x, col, back) {
    let s = P(x, 'M-102,-30 Q0,-66 102,-30 L100,-14 Q0,-50 -100,-14 Z', LEATHER);
    if (!back) for (const X of [-34, 34]) s += C(x, X, -50, 21, '#b08a4a') + C(x, X, -50, 14, '#8fe3ff') + hl(x, X - 5, -55, 5, 3, -30, .9);
    return s; } },
  bandana: { name: 'Bandana', hides: 'top', draw(x, col, back) {
    let s = P(x, 'M-104,-14 C-106,-94 -50,-114 0,-114 C50,-114 106,-94 104,-14 Q0,-40 -104,-14 Z', col.p);
    for (const [X, Y] of [[-50, -80], [10, -96], [50, -60], [-14, -56]]) s += `<circle cx="${X}" cy="${Y}" r="5" fill="#fff" opacity=".8" stroke="none"/>`;
    if (back) s += P(x, 'M-6,-34 L-30,20 L-12,24 Z', col.p) + P(x, 'M6,-34 L28,22 L12,26 Z', col.p) + E(x, 0, -34, 10, 8, shade(col.p, -.06));
    return s; } },
};

// ------------------------------------------------------------ outfits (body space)
const OUTFITS = {
  plate: { name: 'Plate and tabard', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: STEEL, sleeveLen: 58, w: 22, hand: STEEL_D, cuff: STEEL_D });
    s += legs(x, { leg: STEEL, shoe: STEEL_D, top: 80, shoeRx: 17 });
    s += P(x, TORSO, STEEL) + P(x, 'M-28,26 L28,26 L32,104 L0,112 L-32,104 Z', k.col.p);
    s += L(x, 'M-28,26 L-32,104 L0,112 L32,104 L28,26', 2.6, k.col.a);
    if (!back) s += P(x, 'M-4,46 L4,46 L4,58 L14,58 L14,66 L4,66 L4,88 L-4,88 L-4,66 L-14,66 L-14,58 L-4,58 Z', k.col.a);
    s += P(x, 'M-44,40 L44,40 L44,50 L-44,50 Z', LEATHER) + P(x, 'M-7,38 L7,38 L7,52 L-7,52 Z', GOLDC);
    for (const X of [-36, 36]) s += E(x, X, 6, 19, 14, STEEL) + T(x, `M${X - 14},10 Q${X},18 ${X + 14},10`, STEEL);
    return s; } },
  chain: { name: 'Chainmail and surcoat', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: '#9aa4b2', sleeveLen: 44, w: 21, hand: LEATHER });
    s += legs(x, { leg: '#9aa4b2', shoe: LEATHER, top: 80, shoeRx: 16, sock: LEATHER, sockTop: 112 });
    s += P(x, TORSO, '#9aa4b2');
    s += P(x, 'M-30,0 Q-40,40 -44,108 L-4,108 L0,96 L4,108 L44,108 Q40,40 30,0 Q0,10 -30,0 Z', k.col.p);
    s += L(x, 'M-30,0 Q0,10 30,0', 3, k.col.a);
    if (!back) s += P(x, 'M0,30 L-14,40 L-10,62 L0,70 L10,62 L14,40 Z', k.col.a);
    s += P(x, 'M-44,48 L44,48 L44,58 L-44,58 Z', LEATHER);
    for (let i = -2; i <= 2; i++) s += T(x, `M${i * 10 - 4},-2 Q${i * 10},2 ${i * 10 + 4},-2`, '#9aa4b2');
    return s; } },
  brigandine: { name: 'Studded jerkin', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 30, w: 21, hand: LEATHER, cuff: LEATHER });
    s += legs(x, { leg: '#4a4f5c', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 108 });
    s += P(x, TORSO, LEATHER) + P(x, SHORTS, '#4a4f5c');
    for (const [X, Y] of [[-20, 14], [0, 14], [20, 14], [-24, 34], [-4, 34], [16, 34], [-26, 54], [-6, 54], [14, 54]]) s += C(x, X + (back ? 4 : 0), Y, 3.4, GOLDC);
    s += P(x, 'M-44,62 L44,62 L44,72 L-44,72 Z', k.col.p);
    return s; } },
  tunic: { name: 'Forest tunic', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 50, w: 20, hand: LEATHER, cuff: LEATHER });
    s += legs(x, { leg: '#6b5440', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 104, shoeRx: 16 });
    s += P(x, 'M-30,-6 Q-40,34 -46,92 L-6,92 L0,82 L6,92 L46,92 Q40,34 30,-6 Z', k.col.p);
    s += P(x, 'M-30,-4 Q-36,30 -38,58 L-12,58 L-8,-4 Z', LEATHER) + P(x, 'M30,-4 Q36,30 38,58 L12,58 L8,-4 Z', LEATHER);
    if (back) s += P(x, 'M-34,-4 L34,-4 L38,58 L-38,58 Z', LEATHER);
    s += P(x, 'M-44,54 L44,54 L44,64 L-44,64 Z', shade(LEATHER, -.08)) + P(x, 'M-6,52 L6,52 L6,66 L-6,66 Z', GOLDC);
    if (!back) s += L(x, 'M-6,4 L0,18 L6,4', 2.4, shade(k.col.p, -.3));
    return s; } },
  scout: { name: 'Scout mantle', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: '#e9e1cf', sleeveLen: 40, w: 20, hand: LEATHER });
    s += legs(x, { leg: k.skin, shoe: LEATHER, top: 80, sock: '#e9e1cf', sockTop: 96, shoeRx: 16 });
    s += P(x, TORSO, '#e9e1cf') + P(x, SHORTS, '#6b5440');
    s += P(x, 'M-42,-12 Q0,6 42,-12 Q54,20 46,40 Q0,56 -46,40 Q-54,20 -42,-12 Z', k.col.p);
    if (!back) s += C(x, 0, 14, 6, k.col.a);
    s += P(x, 'M-44,56 L44,56 L44,64 L-44,64 Z', LEATHER);
    return s; } },
  robe: { name: 'Long robe', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 50, w: 24, cuff: k.col.a });
    s += legs(x, { leg: k.skin, shoe: '#3a2a5a', top: 116 });
    s += P(x, 'M-30,-6 Q-44,40 -62,118 Q-64,128 -50,128 L50,128 Q64,128 62,118 Q44,40 30,-6 Z', k.col.p);
    s += P(x, 'M-60,116 Q0,126 60,116 L62,128 L-62,128 Z', k.col.a);
    if (!back) { s += P(x, 'M-10,0 L10,0 L18,124 L-18,124 Z', shade(k.col.p, .1)); s += L(x, 'M-10,0 L-18,124 M10,0 L18,124', 2.4, k.col.a); s += star(0, 72, 7, '#ffe78a') + star(-2, 102, 5, '#ffe78a'); s += P(x, 'M-36,-10 Q0,6 36,-10 L38,8 Q0,22 -38,8 Z', shade(k.col.p, -.12)) + star(0, 12, 7, k.col.a); }
    else { s += P(x, 'M-40,-8 Q0,12 40,-8 L34,44 Q0,62 -34,44 Z', shade(k.col.p, -.12)); s += L(x, 'M-34,44 Q0,62 34,44', 2.4, k.col.a); }
    s += P(x, 'M-40,46 Q0,56 40,46 L42,56 Q0,66 -42,56 Z', '#c43a5c');
    return s; } },
  battlerobe: { name: 'Battle robe', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 36, w: 22, cuff: k.col.a });
    s += legs(x, { leg: '#3a2f4f', shoe: '#3a2f4f', top: 80, sock: k.col.a, sockTop: 104 });
    s += P(x, 'M-30,-6 Q-42,30 -52,96 L-10,96 L0,80 L10,96 L52,96 Q42,30 30,-6 Z', k.col.p);
    s += L(x, 'M-52,96 L-10,96 L0,80 L10,96 L52,96', 2.6, k.col.a);
    if (!back) s += P(x, 'M-22,-8 L0,30 L22,-8 Q0,4 -22,-8 Z', shade(k.col.p, .14)) + star(0, 40, 6, k.col.a);
    s += P(x, 'M-46,52 Q0,62 46,52 L46,62 Q0,72 -46,62 Z', '#c43a5c');
    return s; } },
  apron: { name: 'Forge apron', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: '#6f7a8a', sleeveLen: 18, w: 22, hand: '#7a5232' });
    s += legs(x, { leg: '#4a4f5c', shoe: '#3b2a24', top: 76, shoeRx: 17 });
    s += P(x, TORSO, '#6f7a8a') + P(x, 'M-46,62 L46,62 L46,90 L-46,90 Z', '#4a4f5c');
    if (!back) { s += P(x, 'M-26,10 L26,10 L34,108 Q0,114 -34,108 Z', k.col.p) + P(x, 'M-16,52 L16,52 L16,74 L-16,74 Z', shade(k.col.p, -.08)); s += L(x, 'M-24,10 L-30,-6 M24,10 L30,-6', 4, shade(k.col.p, -.12)); }
    else { s += tube(x, 'M-28,-4 L24,58', 9, k.col.p) + tube(x, 'M28,-4 L-24,58', 9, k.col.p) + tube(x, 'M-40,58 L40,58', 9, k.col.p); }
    return s; } },
  overalls: { name: 'Work overalls', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: '#f1ede4', sleeveLen: 24, w: 21 });
    s += legs(x, { leg: k.col.p, shoe: '#3b2a24', top: 80, shoeRx: 17 });
    s += P(x, TORSO, '#f1ede4');
    s += P(x, 'M-26,14 L26,14 L44,60 L44,100 L4,100 L0,88 L-4,100 L-44,100 L-44,60 Z', k.col.p);
    if (!back) { s += P(x, 'M-14,26 L14,26 L14,44 L-14,44 Z', shade(k.col.p, -.08)); s += C(x, -20, 18, 4, GOLDC) + C(x, 20, 18, 4, GOLDC); s += tube(x, 'M-22,16 L-28,-6', 7, k.col.p) + tube(x, 'M22,16 L28,-6', 7, k.col.p); }
    else s += tube(x, 'M-28,-4 L18,40', 8, k.col.p) + tube(x, 'M28,-4 L-18,40', 8, k.col.p);
    return s; } },
};

// ------------------------------------------------------------ back items (body space)  {under: front view behind body, over: back view}
const BACKS = {
  none: { name: 'Nothing' },
  cape: { name: 'Cape', under: (x, k) => P(x, 'M-34,-8 Q-62,50 -64,124 Q-32,134 0,128 Q32,134 64,124 Q62,50 34,-8 Z', shade(k.col.p, -.12)),
    over: (x, k) => P(x, 'M-34,-8 Q-62,50 -64,124 Q-32,134 0,128 Q32,134 64,124 Q62,50 34,-8 Z', k.col.p) + T(x, 'M-20,10 Q-30,70 -32,126 M20,10 Q30,70 32,126 M0,4 L0,126', k.col.p) + P(x, 'M-38,-10 Q0,6 38,-10 L36,4 Q0,18 -36,4 Z', k.col.a) },
  quiver: { name: 'Quiver', under: x => `<g transform="translate(30,-24) rotate(22)">${R(x, -12, 0, 24, 70, 8, LEATHER)}${L(x, 'M-6,0 L-10,-22 M2,0 L2,-26 M8,0 L12,-20', 3, '#e9e1cf')}</g>`,
    over: x => `<g transform="translate(-24,-20) rotate(-22)">${L(x, 'M-6,0 L-10,-24 M2,0 L2,-28 M8,0 L12,-22', 3)}${P(x, 'M-14,-26 L-6,-20 L-14,-16 Z M0,-32 L6,-26 L-4,-24 Z', '#ff6fae')}${R(x, -12, 0, 24, 74, 8, LEATHER)}${T(x, 'M-12,16 L12,16 M-12,56 L12,56', LEATHER)}</g>` + tube(x, 'M-34,-6 L34,64', 6, shade(LEATHER, -.1)) },
  pack: { name: 'Tool pack', under: x => R(x, -40, -2, 80, 70, 14, shade(LEATHER, -.08)),
    over: x => R(x, -38, 0, 76, 72, 14, LEATHER) + R(x, -30, 26, 60, 30, 8, shade(LEATHER, -.08)) + `<g transform="translate(26,-10) rotate(30)">${R(x, -4, -6, 8, 60, 3, WOOD)}${R(x, -16, -18, 32, 18, 4, STEEL)}</g>` + C(x, 0, 40, 4, GOLDC) },
  tome: { name: 'Spell tome', under: x => '',
    over: (x, k) => `<g transform="translate(0,26)">${R(x, -28, -4, 56, 62, 6, k.col.p)}${R(x, -22, 0, 44, 54, 4, shade(k.col.p, .12))}${star(0, 26, 12, k.col.a)}</g>` + tube(x, 'M-32,-6 L28,30', 6, LEATHER) },
};

// ------------------------------------------------------------ held items (body space, right hand ~ (63,61)) and offhands
const WEAPONS = {
  sword: { name: 'Sword', draw: x => `<g transform="translate(64,62) rotate(-18)">${P(x, 'M-4,10 L4,10 L4,78 L0,88 L-4,78 Z', '#e8eef6')}${L(x, 'M0,14 L0,76', 1.4, STEEL_D)}${P(x, 'M-16,4 L16,4 L16,11 L-16,11 Z', GOLDC)}${P(x, 'M-4,-14 L4,-14 L4,4 L-4,4 Z', LEATHER)}${E(x, 0, -17, 5, 5, GOLDC)}</g>` },
  lance: { name: 'Star lance', draw: (x, k) => tube(x, 'M50,136 L80,-40', 8, WOOD) + `<g transform="translate(82,-50) rotate(10)">${P(x, 'M0,-34 L10,-4 L0,8 L-10,-4 Z', '#e8eef6')}${star(0, -6, 9, k.col.a)}</g>` + P(x, 'M70,30 L88,26 L86,38 L68,42 Z', k.col.p) },
  fan: { name: 'Comet fan', draw: (x, k) => `<g transform="translate(66,58) rotate(-30)">${P(x, 'M0,0 L-40,-56 Q0,-76 40,-56 Z', k.col.p)}${L(x, 'M0,0 L-28,-62 M0,0 L-10,-68 M0,0 L10,-68 M0,0 L28,-62', 2, shade(k.col.p, -.25))}${P(x, 'M-40,-56 Q0,-76 40,-56 L36,-50 Q0,-68 -36,-50 Z', k.col.a)}${star(0, -50, 7, '#ffe78a')}${C(x, 0, 0, 5, GOLDC)}</g>` },
  orbit: { name: 'Orbit burst', draw: (x, k) => tube(x, 'M58,120 L76,-6', 8, WOOD) + `<g transform="translate(78,-22)">${L(x, 'M-22,0 A22,10 0 1 0 22,0 A22,10 0 1 0 -22,0', 3.4, k.col.a)}${C(x, 0, 0, 10, '#8fe3ff')}${C(x, -22, 0, 6, k.col.p)}${C(x, 18, 7, 6, k.col.p)}${C(x, 12, -8, 5, k.col.p)}${hl(x, -3, -3, 3, 2, 0, .9)}</g>` },
  longbow: { name: 'Focus longbow', offhand: true, draw: (x, k) => `<g transform="translate(-64,58)">${tube(x, 'M6,-88 Q-34,0 6,88', 9, WOOD)}${L(x, 'M6,-86 L6,86', 1.6, '#f3ead6')}${R(x, -16, -10, 12, 20, 4, k.col.p)}</g>` },
  firepot: { name: 'Alchemist firepot', draw: (x, k) => `<g transform="translate(66,50)">${E(x, 0, 6, 17, 16, '#c9783a')}${R(x, -8, -16, 16, 10, 3, '#9a5a2c')}${L(x, 'M-11,4 Q0,10 11,4', 2.4, k.col.a)}${L(x, 'M2,-16 Q10,-28 6,-36', 2.6, '#5a3a20')}${NL('M6,-36 Q-2,-46 6,-56 Q16,-46 6,-36 Z', '#ffb43a')}${NL('M6,-38 Q2,-44 6,-50 Q11,-44 6,-38 Z', '#fff2a8')}</g>` },
  reviver: { name: 'Revival scepter', draw: (x, k) => tube(x, 'M58,116 L72,-4', 7, GOLDC) + `<g transform="translate(73,-18)">${P(x, 'M0,10 C-26,-6 -22,-30 -6,-30 C-2,-30 0,-26 0,-22 C0,-26 2,-30 6,-30 C22,-30 26,-6 0,10 Z', '#ff6f9a')}${hl(x, -8, -20, 5, 3, -30, .9)}${hl(x, 9, -14, 3, 2, 0, .7)}</g>` },
  hammer: { name: 'Builder hammer', draw: x => `<g transform="translate(62,64) rotate(28)">${R(x, -5, -62, 10, 78, 4, '#a8743f')}${R(x, -24, -82, 48, 26, 5, STEEL)}${R(x, -24, -82, 10, 26, 3, STEEL_D)}${hl(x, 4, -76, 12, 3, 0, .8)}</g>` },
};
const OFFHANDS = {
  none: { name: 'Empty' },
  heater: { name: 'Heater shield', draw: (x, k, back) => `<g transform="translate(-62,52)">${P(x, 'M-26,-28 L26,-28 L26,4 Q26,30 0,42 Q-26,30 -26,4 Z', back ? STEEL_D : k.col.p)}${back ? L(x, 'M-14,-10 L14,-10 M0,-20 L0,30', 4, LEATHER) : P(x, 'M-26,-28 L26,-28 L26,-20 L-26,-20 Z', STEEL) + L(x, 'M-22,-24 L22,-24 L22,4 Q22,26 0,36 Q-22,26 -22,4 Z', 2.4, k.col.a) + P(x, 'M-3,-14 L3,-14 L3,-2 L12,-2 L12,4 L3,4 L3,24 L-3,24 L-3,4 L-12,4 L-12,-2 L-3,-2 Z', k.col.a)}${hl(x, -12, -14, 8, 3, -20, .55)}</g>` },
  buckler: { name: 'Round buckler', draw: (x, k, back) => `<g transform="translate(-62,56)">${C(x, 0, 0, 28, back ? STEEL_D : STEEL)}${back ? L(x, 'M-16,0 L16,0', 4, LEATHER) : C(x, 0, 0, 20, k.col.p) + C(x, 0, 0, 7, k.col.a)}${hl(x, -10, -12, 8, 3, -30, .6)}</g>` },
};
const EXTRAS = {
  none: { name: 'Nothing' },
  ahoge: { name: 'Ahoge', head: (x, c) => P(x, 'M4,-100 C-2,-142 32,-170 68,-150 C42,-150 24,-134 18,-100 Z', c), back: (x, c) => P(x, 'M4,-100 C-2,-142 32,-170 68,-150 C42,-150 24,-134 18,-100 Z', c) },
  glasses: { name: 'Round glasses', face: x => L(x, 'M-56,24 A16,16 0 1 0 -24,24 A16,16 0 1 0 -56,24 M24,24 A16,16 0 1 0 56,24 A16,16 0 1 0 24,24 M-24,22 Q0,14 24,22 M-56,22 L-94,14 M56,22 L94,14', 3.4) + `<ellipse cx="-44" cy="16" rx="5" ry="3" fill="#fff" opacity=".7" stroke="none"/><ellipse cx="36" cy="16" rx="5" ry="3" fill="#fff" opacity=".7" stroke="none"/>` },
  patch: { name: 'Eyepatch', face: x => L(x, 'M-96,-20 L96,40', 3.4) + P(x, 'M24,8 Q40,2 56,8 Q60,30 40,40 Q20,30 24,8 Z', '#2b2a45') },
  plaster: { name: 'Cheek plaster', face: x => `<g transform="rotate(-18 60 46)">${R(x, 44, 40, 34, 13, 4, '#f6e2c4')}${L(x, 'M54,42 L54,51 M60,42 L60,51 M66,42 L66,51', 1.6, '#d8b88a')}</g>` },
};

// ------------------------------------------------------------ more wardrobe (v5): outfits, headwear and a banner
const LINEN = '#f4f1ea', MAIL = '#9aa4b2';
const mailDots = (x, d) => L(x, d, 2.4, shade(MAIL, -.22), 'stroke-dasharray="0.1 6"');
const ROBE = 'M-30,-6 Q-44,40 -60,124 Q0,132 60,124 Q44,40 30,-6 Z';
Object.assign(OUTFITS, {
  paladin: { name: 'Paladin surcoat', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: STEEL, sleeveLen: 58, w: 22, hand: STEEL_D, cuff: GOLDC });
    s += legs(x, { leg: STEEL, shoe: STEEL_D, top: 80, shoeRx: 17 });
    s += P(x, TORSO, STEEL) + P(x, 'M-30,-4 Q-38,40 -46,118 L-6,118 L0,104 L6,118 L46,118 Q38,40 30,-4 Q0,8 -30,-4 Z', LINEN);
    s += L(x, 'M-46,116 L-6,116 L0,102 L6,116 L46,116', 3, k.col.a);
    s += P(x, 'M-5,12 L5,12 L5,34 L22,34 L22,44 L5,44 L5,94 L-5,94 L-5,44 L-22,44 L-22,34 L-5,34 Z', k.col.p);
    s += P(x, 'M-44,58 Q0,64 44,58 L44,66 Q0,72 -44,66 Z', LEATHER) + (back ? '' : C(x, 0, 64, 6, GOLDC));
    for (const X of [-36, 36]) s += E(x, X, 4, 21, 15, GOLDC) + T(x, `M${X - 15},8 Q${X},16 ${X + 15},8`, GOLDC);
    return s; } },
  gambeson: { name: 'Quilted gambeson', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 52, w: 23, hand: LEATHER, cuff: shade(k.col.p, -.12) });
    s += legs(x, { leg: '#6b5440', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 100, shoeRx: 16 });
    s += P(x, 'M-32,-6 Q-42,34 -46,96 Q0,104 46,96 Q42,34 32,-6 Z', k.col.p);
    s += T(x, 'M-22,4 L-28,96 M-8,2 L-9,100 M8,2 L9,100 M22,4 L28,96 M-38,28 L38,28', k.col.p);
    s += P(x, 'M-26,-8 Q0,6 26,-8 L24,4 Q0,16 -24,4 Z', shade(k.col.p, -.1));
    s += P(x, 'M-44,64 Q0,72 44,64 L45,74 Q0,82 -45,74 Z', LEATHER) + (back ? '' : R(x, -6, 64, 12, 12, 2, GOLDC));
    if (!back) for (const Y of [14, 38]) s += R(x, -7, Y, 14, 6, 3, '#f3ead6');
    return s; } },
  duster: { name: 'Trail coat', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 54, w: 21, hand: LEATHER, cuff: shade(k.col.p, -.14) });
    s += legs(x, { leg: '#4a4f5c', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 100, shoeRx: 16 });
    s += P(x, TORSO, '#e9e1cf');
    if (back) s += P(x, 'M-30,-6 Q-42,40 -52,122 L-4,122 L0,100 L4,122 L52,122 Q42,40 30,-6 Q0,6 -30,-6 Z', k.col.p) + T(x, 'M-26,60 Q0,68 26,60', k.col.p);
    else {
      const panel = 'M-30,-6 Q-40,40 -50,122 L-10,118 L-8,30 L-14,-4 Z', lapel = 'M-14,-4 L-6,26 L-22,14 Z';
      s += P(x, 'M-10,56 L10,56 L10,64 L-10,64 Z', LEATHER) + C(x, 0, 60, 4, GOLDC);
      s += P(x, panel, k.col.p) + mirror(P(x, panel, k.col.p)) + P(x, lapel, shade(k.col.p, -.12)) + mirror(P(x, lapel, shade(k.col.p, -.12)));
      s += T(x, 'M-42,82 L-18,82 M42,82 L18,82', k.col.p);
    }
    return s; } },
  corsair: { name: 'Corsair sash', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: LINEN, sleeveLen: 46, w: 24, cuff: LINEN });
    s += legs(x, { leg: '#3b3550', shoe: '#3b2a24', top: 80, sock: '#3b2a24', sockTop: 96, shoeRx: 17 });
    s += P(x, 'M-44,66 L44,66 L44,96 L4,96 L0,88 L-4,96 L-44,96 Z', '#3b3550') + P(x, TORSO, LINEN);
    const vest = 'M-30,-4 Q-38,30 -40,60 L-14,60 L-12,-4 Z';
    if (back) s += P(x, 'M-32,-4 Q0,4 32,-4 L40,60 L-40,60 Z', k.col.p);
    else s += L(x, 'M-8,-4 L0,14 L8,-4', 2.4, shade(LINEN, -.25)) + P(x, vest, k.col.p) + mirror(P(x, vest, k.col.p));
    s += P(x, 'M-44,54 Q0,64 44,54 L44,70 Q0,80 -44,70 Z', k.col.a);
    s += P(x, back ? 'M-30,66 L-46,104 L-34,106 L-24,70 Z' : 'M30,66 L46,104 L34,106 L24,70 Z', k.col.a);
    return s; } },
  starcloak: { name: 'Starlit mantle', draw(x, k, back) {
    const dark = shade(k.col.p, -.16);
    let s = arms(x, { skin: k.skin, sleeve: dark, sleeveLen: 54, w: 25, cuff: k.col.a });
    s += legs(x, { leg: k.skin, shoe: '#2a2040', top: 116 });
    s += P(x, ROBE, dark) + L(x, 'M-59,120 Q0,128 59,120', 3, k.col.a);
    for (const [X, Y, r] of back ? [[-30, 70, 6], [24, 96, 5], [-8, 110, 4], [34, 60, 4]] : [[-26, 80, 6], [22, 70, 5], [6, 108, 4], [-38, 108, 4]]) s += star(X, Y, r, '#ffe78a');
    s += P(x, 'M-46,-10 Q0,8 46,-10 Q58,20 52,40 Q24,30 0,46 Q-24,30 -52,40 Q-58,20 -46,-10 Z', k.col.p);
    s += L(x, 'M-52,40 Q-24,30 0,46 Q24,30 52,40', 3, k.col.a);
    if (back) s += P(x, 'M-34,-12 Q0,0 34,-12 L38,-30 Q0,-16 -38,-30 Z', k.col.p) + star(0, 20, 9, k.col.a);
    else s += C(x, 0, 2, 7, k.col.a) + hl(x, -2, 0, 2.6, 1.8, 0, .9);
    return s; } },
  acolyte: { name: 'Acolyte vestments', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: LINEN, sleeveLen: 54, w: 24, cuff: k.col.a });
    s += legs(x, { leg: k.skin, shoe: '#7a5232', top: 116 });
    s += P(x, ROBE, LINEN) + P(x, 'M-60,114 Q0,124 60,114 L61,126 Q0,134 -61,126 Z', k.col.a);
    const stole = 'M-15,-6 L-4,-6 L-7,110 L-19,110 Z';
    if (back) s += P(x, 'M-16,-6 L16,-6 L4,40 L-4,40 Z', k.col.p);
    else for (const sx of [1, -1]) { const g = P(x, stole, k.col.p) + P(x, 'M-19,98 L-7,98 L-7,110 L-19,110 Z', k.col.a); s += sx > 0 ? g : mirror(g); }
    s += tube(x, 'M-42,52 Q0,62 42,52', 6, '#d8b88a') + (back ? '' : tube(x, 'M22,58 L26,92', 5, '#d8b88a'));
    return s; } },
  smith: { name: 'Smith vest', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 20, w: 23, hand: '#4a3a2e', cuff: '#4a3a2e' });
    s += legs(x, { leg: '#5a4a3e', shoe: '#3b2a24', top: 78, shoeRx: 17 });
    s += P(x, TORSO, k.col.p) + P(x, 'M-46,70 L46,70 L46,90 L-46,90 Z', '#5a4a3e');
    const panel = 'M-30,-4 Q-38,30 -42,66 L-6,66 L-6,4 Z';
    s += back ? P(x, 'M-30,-4 Q0,6 30,-4 L42,66 L-42,66 Z', LEATHER) : P(x, panel, LEATHER) + mirror(P(x, panel, LEATHER));
    s += P(x, 'M-46,62 L46,62 L46,74 L-46,74 Z', shade(LEATHER, -.14)) + R(x, -42, 66, 17, 22, 4, LEATHER) + R(x, 25, 66, 17, 22, 4, LEATHER);
    if (!back) s += tube(x, 'M-12,72 L-16,96', 5, STEEL) + C(x, -16, 98, 5, STEEL) + R(x, -4, 62, 10, 12, 2, STEEL);
    return s; } },
  engineer: { name: 'Engineer jumpsuit', draw(x, k, back) {
    let s = arms(x, { skin: k.skin, sleeve: k.col.p, sleeveLen: 52, w: 22, hand: '#d8b88a', cuff: shade(k.col.p, -.1) });
    s += legs(x, { leg: k.col.p, shoe: '#3b2a24', top: 76, shoeRx: 17 });
    for (const X of [-15, 15]) s += E(x, X, 110, 11, 8, '#4a4f5c');
    s += P(x, 'M-30,-6 Q-38,30 -44,66 L-44,100 L-4,100 L0,90 L4,100 L44,100 L44,66 Q38,30 30,-6 Z', k.col.p);
    s += P(x, 'M-26,-8 L0,8 L26,-8 L22,4 L0,16 L-22,4 Z', shade(k.col.p, -.12));
    s += P(x, 'M-44,56 L44,56 L44,64 L-44,64 Z', '#4a4f5c');
    if (!back) s += L(x, 'M0,14 L0,54 M0,66 L0,88', 2.4, '#e8eef6') + R(x, -6, 54, 12, 12, 2, STEEL) + R(x, 14, 20, 16, 12, 3, k.col.a) + C(x, -22, 26, 6, k.col.a);
    else s += R(x, -14, 18, 28, 16, 4, k.col.a);
    return s; } },
});
Object.assign(HATS, {
  coif: { name: 'Mail coif', hides: 'all', draw: (x, col, back) => hood(x, MAIL, back) + (back
    ? mailDots(x, 'M-96,-40 Q0,-130 96,-40 M-104,20 Q0,-80 104,20 M-100,70 Q0,0 100,70')
    : mailDots(x, 'M-98,10 C-104,-70 -52,-110 0,-112 C52,-110 104,-70 98,10 M-106,60 C-108,80 -96,96 -80,100')) },
  crown: { name: 'Crown', band: true, draw(x, col, back) {
    let s = P(x, 'M-92,-36 L-88,-86 L-58,-58 L-30,-98 L0,-64 L30,-98 L58,-58 L88,-86 L92,-36 Q0,-66 -92,-36 Z', GOLDC);
    s += P(x, 'M-94,-38 Q0,-72 94,-38 L92,-24 Q0,-58 -92,-24 Z', shade(GOLDC, -.1));
    for (const [X, Y] of [[-88, -86], [-30, -98], [30, -98], [88, -86]]) s += C(x, X, Y, 5, GOLDC);
    s += back ? C(x, 0, -44, 5, col.p) : C(x, 0, -48, 7, col.a) + C(x, -48, -42, 5, col.p) + C(x, 48, -42, 5, col.p) + hl(x, -2, -50, 2.4, 1.6, 0, .9);
    return s + hl(x, -40, -60, 12, 3, -20, .6); } },
  beret: { name: 'Beret', draw(x, col, back) {
    let s = P(x, back ? 'M96,-64 C110,-104 40,-128 -30,-120 C-90,-114 -120,-86 -100,-60 Q0,-40 96,-64 Z' : 'M-96,-64 C-110,-104 -40,-128 30,-120 C90,-114 120,-86 100,-60 Q0,-40 -96,-64 Z', col.p);
    s += P(x, 'M-92,-64 Q0,-46 96,-64 L94,-52 Q0,-34 -90,-52 Z', shade(col.p, -.12)) + C(x, back ? -10 : 10, -124, 6, col.p);
    if (!back) s += star(62, -80, 10, col.a);
    return s + hl(x, back ? 30 : -30, -100, 22, 6, back ? 14 : -14, .5); } },
  hardhat: { name: 'Hard hat', hides: 'top', draw(x, col, back) {
    let s = P(x, 'M-100,-26 C-102,-100 -50,-124 0,-124 C50,-124 102,-100 100,-26 Z', col.a);
    s += P(x, 'M-12,-122 Q0,-126 12,-122 L14,-34 L-14,-34 Z', shade(col.a, .06));
    s += P(x, 'M-118,-30 Q0,-52 118,-30 L116,-14 Q0,-36 -116,-14 Z', shade(col.a, -.1));
    if (!back) s += R(x, -24, -76, 48, 22, 6, col.p) + star(0, -65, 7, col.a);
    return s + hl(x, -50, -92, 22, 7, -28, .6); } },
});
Object.assign(BACKS, {
  banner: { name: 'Crusader banner',
    under: (x, k) => tube(x, 'M-90,110 L-90,-340', 7, WOOD) + C(x, -90, -344, 7, GOLDC) + P(x, 'M-94,-334 L-170,-334 L-170,-274 L-148,-286 L-132,-270 L-94,-278 Z', k.col.p) + P(x, 'M-136,-328 L-128,-328 L-128,-314 L-114,-314 L-114,-306 L-128,-306 L-128,-284 L-136,-284 L-136,-306 L-150,-306 L-150,-314 L-136,-314 Z', k.col.a),
    over: (x, k) => tube(x, 'M90,110 L90,-340', 7, WOOD) + C(x, 90, -344, 7, GOLDC) + P(x, 'M94,-334 L170,-334 L170,-274 L148,-286 L132,-270 L94,-278 Z', k.col.p) + P(x, 'M136,-328 L128,-328 L128,-314 L114,-314 L114,-306 L128,-306 L128,-284 L136,-284 L136,-306 L150,-306 L150,-314 L136,-314 Z', k.col.a) + tube(x, 'M-34,-6 L90,40', 6, shade(LEATHER, -.1)) },
});

// ------------------------------------------------------------ classes (Crusaders: battle-professions.js)
const CLASSES = {
  fighter: { name: 'Fighter', blurb: '1000 HP, sword only', outfits: ['plate', 'chain', 'brigandine', 'paladin', 'gambeson'], hats: ['none', 'helm', 'horned', 'coif', 'crown', 'headband', 'bandana'], weapons: ['sword'], offhands: ['none', 'heater', 'buckler'], backs: ['none', 'cape', 'banner'] },
  ranger: { name: 'Ranger', blurb: '96 ammo, every ranged weapon', outfits: ['tunic', 'scout', 'duster', 'corsair'], hats: ['none', 'cap', 'beret', 'hood', 'bandana', 'headband'], weapons: ['longbow', 'lance', 'fan', 'orbit', 'firepot', 'reviver'], offhands: ['none'], backs: ['none', 'quiver', 'cape'] },
  mage: { name: 'Mage', blurb: 'Mana, 10 s wards, lance or scepter', outfits: ['robe', 'battlerobe', 'starcloak', 'acolyte'], hats: ['none', 'wizard', 'circlet', 'crown', 'beret', 'hood'], weapons: ['lance', 'reviver'], offhands: ['none'], backs: ['none', 'tome', 'cape'] },
  builder: { name: 'Builder', blurb: '125 HP, builds and repairs', outfits: ['apron', 'overalls', 'smith', 'engineer'], hats: ['none', 'workcap', 'hardhat', 'goggles', 'bandana'], weapons: ['hammer', 'lance', 'firepot'], offhands: ['none'], backs: ['none', 'pack'] },
};

// ------------------------------------------------------------ side views (profile, drawn facing right; the left side mirrors it)
// Head space: profile skull HEAD_S, ear at (-8,16), eye near (60,22). Body space as the front view.
const HEAD_S = 'M-90,0 C-90,-56 -46,-90 4,-90 C56,-90 94,-54 94,-2 C94,30 88,56 70,74 C54,88 30,92 4,92 C-50,92 -90,56 -90,0 Z';
function faceSide(x, f, left) {
  const ink = shade(f.eyeColor, -.28, .1), X = 60, y = 24;
  let s = '';
  if (f.blush) { s += `<ellipse cx="52" cy="50" rx="12" ry="7.5" fill="#ff9ab8" stroke="none"/>`; for (const k of [-5, 1, 7]) s += L(x, `M${52 + k - 3},55 L${52 + k + 3},45`, 2.2, '#ff5f93'); }
  let kind = f.eyes;
  if (kind === 'wink') kind = left ? 'dot' : 'happy';
  if (kind === 'happy') s += L(x, `M${X - 9},${y + 4} Q${X + 1},${y - 12} ${X + 10},${y + 2}`, 6, ink);
  else if (kind === 'half') s += `<path d="M${X - 7},${y - 2} L${X + 8},${y - 2} Q${X + 8},${y + 14} ${X},${y + 14} Q${X - 7},${y + 14} ${X - 7},${y - 2} Z" fill="${ink}" stroke="none"/>` + L(x, `M${X - 10},${y - 3} L${X + 11},${y - 3}`, 5) + `<circle cx="${X - 2}" cy="${y + 3}" r="2.4" fill="#fff" stroke="none"/>`;
  else if (kind === 'sharp') s += `<path d="M${X - 7},${y - 6} L${X + 8},${y} Q${X + 8},${y + 14} ${X},${y + 14} Q${X - 7},${y + 14} ${X - 7},${y - 6} Z" fill="${ink}" stroke="none"/>` + L(x, `M${X - 11},${y - 11} L${X + 12},${y - 2}`, 5) + `<circle cx="${X - 2}" cy="${y + 4}" r="2.4" fill="#fff" stroke="none"/>`;
  else {
    const big = kind === 'sparkle' ? 1.25 : 1, rx = 7 * big, ry = 14 * big;
    s += `<ellipse cx="${X}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}" stroke="none"/>`;
    s += `<ellipse cx="${X + 1}" cy="${y + 5 * big}" rx="${rx * .7}" ry="${ry * .45}" fill="${f.eyeColor}" opacity=".9" stroke="none"/>`;
    s += `<ellipse cx="${X - 2}" cy="${y - 5 * big}" rx="${3 * big}" ry="${5 * big}" fill="#fff" stroke="none"/>`;
    if (big > 1) s += `<circle cx="${X + 3}" cy="${y + 7}" r="2.2" fill="#fff" stroke="none"/>`;
  }
  const m = f.mouth;
  const mc = x.pfx + 'mc'; x.defs[mc] = `<clipPath id="${mc}"><path d="${HEAD_S}"/></clipPath>`;
  s += `<g clip-path="url(#${mc})"><g transform="translate(-8,0)">`;
  if (m === 'smile') s += L(x, 'M76,57 Q82,62 87,56', 4);
  if (m === 'cat') s += L(x, 'M74,56 Q79,62 84,57 Q88,62 92,56', 4);
  if (m === 'frown') s += L(x, 'M76,62 Q82,56 87,61', 4.2);
  if (m === 'open') { s += `<path d="M74,52 Q84,54 92,50 Q90,70 82,70 Q74,68 74,52 Z" fill="${LINE}"/>`; s += NL('M77,64 Q83,60 88,64 Q85,68 82,68 Q79,68 77,64 Z', '#ff7fa6'); }
  if (m === 'grin') { s += `<path d="M72,54 Q84,56 94,46 Q92,66 82,66 Q74,64 72,54 Z" fill="${LINE}"/>`; s += NL('M74,55 Q84,57 93,47 L92,52 Q84,59 75,58 Z', '#fff'); }
  if (m === 'tongue') { s += L(x, 'M74,56 Q82,62 90,54', 4); s += P(x, 'M80,59 Q81,72 88,71 Q93,65 89,58 Z', '#ff7fa6'); }
  return s + '</g></g>';
}
// Hair in profile: back = behind the head, cap = over the skull, fringe = in front of the face edge.
const CAP_S = 'M-98,24 C-106,-60 -52,-106 6,-106 C62,-106 104,-68 104,-14 L94,-20 Q66,-48 30,-42 Q2,-36 -8,-8 Q-14,14 -26,24 Q-64,42 -98,24 Z';
const FRINGE_S = 'M30,-44 C64,-58 98,-40 104,-12 L104,0 L94,-14 L92,8 L80,-14 L74,6 L64,-22 L56,-6 L46,-32 Z';
const HAIRS_S = {
  short: { cap: 'M-90,32 L-104,18 L-96,4 L-110,-16 L-98,-30 L-104,-56 C-90,-92 -46,-108 6,-106 C62,-104 104,-66 104,-16 L96,-6 L92,-28 L80,-12 L74,-38 Q40,-48 10,-40 Q-4,-30 -10,-6 Q-14,14 -26,24 Z', lines: 'M-60,-80 Q-80,-40 -90,0 M-20,-96 Q-40,-50 -50,0' },
  flip: { back: 'M-50,-70 C-104,-50 -112,20 -102,62 C-98,82 -110,98 -126,100 C-112,114 -86,110 -76,92 C-64,74 -40,72 -18,74 L-14,0 Z', cap: CAP_S, fringe: FRINGE_S, lock: 'M-6,-22 C-14,20 -12,60 0,86 C8,62 12,30 14,-16 Z', lines: 'M-60,-80 Q-90,0 -80,80' },
  hime: { back: 'M-40,-86 C-100,-76 -110,-24 -108,40 L-110,124 L-14,124 L-10,0 Z', cap: CAP_S, fringe: 'M24,-64 C60,-78 102,-52 104,-6 L104,6 L58,6 Q42,-6 30,-34 Z', drape: 'M-38,-14 L-54,118 Q-38,130 -18,122 L-6,-14 Z', lines: 'M-60,-70 L-70,120 M-30,-90 L-40,120', bangLines: 'M70,6 L70,-8 M88,6 L88,-8' },
  wavy: { back: 'M-40,-86 C-104,-76 -116,-10 -108,50 C-118,74 -102,96 -112,120 C-90,130 -60,124 -40,116 C-24,90 -20,40 -14,0 Z', cap: CAP_S, fringe: 'M30,-44 C66,-60 98,-40 104,-4 Q92,-20 80,-22 Q72,-6 58,-26 Q50,-14 40,-30 Z', lock: 'M-8,-20 C-20,20 -6,50 -14,84 C2,70 10,40 12,-14 Z', lines: 'M-60,-70 Q-80,20 -90,110' },
  twin: { back: 'M-62,-62 C-128,-64 -150,-6 -140,56 C-132,94 -146,118 -156,132 C-124,130 -106,106 -110,74 C-114,34 -100,-2 -76,-30 Z', cap: CAP_S, fringe: 'M30,-44 C66,-60 98,-40 104,-4 Q92,-20 80,-22 Q72,-6 58,-26 Q50,-14 40,-30 Z', tie: [-70, -58], lines: 'M-110,-40 C-136,0 -128,60 -134,110' },
  pony: { back: 'M-24,-98 C-86,-150 -150,-110 -142,-36 C-138,4 -152,36 -164,58 C-128,58 -110,28 -110,-12 C-110,-52 -80,-80 -24,-98 Z', cap: CAP_S, fringe: 'M30,-46 C64,-60 100,-42 104,-8 Q86,-30 66,-34 Q50,-26 36,-36 Z', tie: [-32, -96], lines: 'M-60,-110 C-120,-110 -130,-40 -130,10' },
  side: { back: 'M-50,-70 C-108,-50 -114,30 -104,74 Q-80,100 -60,84 L-18,40 Z', cap: CAP_S, fringe: 'M20,-60 C64,-80 104,-50 104,-6 Q96,-24 86,-30 Q80,10 96,40 Q80,44 70,20 Q60,-10 40,-30 Z', lines: 'M-60,-80 Q-90,0 -86,70' },
  quiff: { cap: 'M-96,26 C-104,-60 -56,-100 -10,-102 L-6,-60 Q-6,-36 -10,-8 Q-14,14 -26,24 Q-64,40 -96,26 Z', quiff: 'M-40,-92 C-20,-142 30,-192 86,-210 C66,-178 66,-148 74,-120 C98,-98 106,-60 98,-28 Q72,-58 30,-56 Q-8,-58 -40,-92 Z', lines: 'M-10,-110 C20,-150 50,-180 76,-196 M10,-80 C40,-110 60,-140 80,-150' },
  curls: { back: 'M-40,-86 C-110,-70 -120,0 -108,50 Q-122,70 -108,90 Q-120,110 -104,126 Q-84,128 -82,110 Q-62,112 -60,92 Q-40,90 -30,60 L-14,0 Z', cap: CAP_S, fringe: 'M30,-44 C66,-60 98,-40 104,-4 Q92,-20 80,-22 Q72,-6 58,-26 Q50,-14 40,-30 Z', lock: 'M-8,-14 C-22,20 -18,60 -10,84 Q-20,96 -10,108 Q4,104 2,88 Q-4,60 12,-10 Z', lines: 'M-60,-70 Q-80,20 -90,100' },
};
function hairSide(x, k, part, hideTop) {
  const h = k.hair, H = HAIRS_S[h], c = k.hairColor;
  if (!H) return part === 'cap' ? hl(x, -30, -56, 24, 9, -20, .6) : '';
  let s = '';
  if (part === 'back') {
    if (H.back) s += P(x, H.back, c) + (H.lines ? T(x, H.lines, c) : '');
    if (H.tie) s += E(x, H.tie[0], H.tie[1], 13, 12, '#ff6fae');
  } else if (part === 'drape') {
    if (H.drape) s += P(x, H.drape, c);
  } else {
    if (hideTop) { // under a hat only the hair below the hat line shows
      const id = x.pfx + 'cl'; x.defs[id] = `<clipPath id="${id}"><rect x="-300" y="-62" width="600" height="400"/></clipPath>`;
      return `<g clip-path="url(#${id})">${P(x, H.quiff ? CAP_S : H.cap, c)}${H.fringe ? P(x, H.fringe, c) : ''}</g>`;
    }
    s += P(x, H.cap, c);
    if (H.fringe) s += P(x, H.fringe, c);
    if (H.bangLines) s += T(x, H.bangLines, c);
    if (H.quiff) s += P(x, H.quiff, c) + T(x, H.lines, c) + hl(x, 30, -130, 20, 6, -52);
    else if (!H.back && H.lines) s += T(x, H.lines, c);
    s += hl(x, 10, -82, 26, 7, -8) + hl(x, -62, -50, 14, 5, -60);
  }
  return s;
}
// Hats in profile (head space, facing right).
const HATS_S = {
  helm: (x, col) => P(x, 'M-104,40 C-110,-70 -50,-116 4,-116 C66,-116 110,-74 110,-14 L110,-6 L44,-6 Q26,-6 26,10 L26,58 Q-40,80 -104,40 Z', STEEL) + P(x, 'M110,-20 L110,-4 L44,-4 Q30,-4 28,8 L22,6 Q24,-16 44,-20 Z', STEEL_D) + T(x, 'M-40,-110 Q-60,-40 -50,50', STEEL) + C(x, -66, 10, 4, STEEL_D) + P(x, 'M-6,-112 C-18,-164 -80,-178 -118,-144 C-88,-150 -58,-136 -40,-106 Z', col.p) + T(x, 'M-16,-120 C-30,-150 -60,-160 -90,-152', col.p) + hl(x, 30, -86, 28, 8, 12, .7),
  horned: (x, col) => P(x, 'M-20,-70 C-44,-120 -84,-140 -118,-134 C-92,-114 -70,-84 -60,-50 Z', '#f3ead6') + P(x, 'M-102,-14 C-108,-90 -52,-114 4,-114 C62,-114 108,-86 106,-24 Q0,-44 -102,-14 Z', STEEL) + P(x, 'M-104,-18 Q0,-48 108,-28 L106,-12 Q0,-32 -102,-2 Z', GOLDC) + P(x, 'M98,-26 L110,-26 L106,14 L98,14 Z', STEEL_D) + hl(x, 26, -82, 26, 7, 12, .7),
  headband: (x, col) => P(x, 'M-98,-24 Q0,-66 104,-36 L102,-18 Q0,-48 -96,-6 Z', col.p) + P(x, 'M-92,-18 L-136,2 L-124,16 L-88,-6 Z', col.p) + P(x, 'M-92,-14 L-132,-26 L-130,-8 Z', col.p),
  cap: (x, col) => P(x, 'M-106,-16 C-104,-100 30,-124 104,-62 L110,-42 Q0,-70 -106,-16 Z', col.p) + P(x, 'M-108,-20 Q0,-72 110,-46 L112,-36 Q0,-60 -106,-8 Z', shade(col.p, -.1)) + P(x, 'M-40,-76 C-90,-130 -130,-156 -156,-160 C-126,-118 -96,-88 -54,-62 Z', col.a) + T(x, 'M-48,-72 C-90,-110 -120,-138 -150,-154', col.a) + hl(x, 20, -96, 26, 7, 8, .6),
  hood: (x, col) => P(x, 'M-114,30 C-120,-70 -60,-124 6,-124 C72,-124 116,-76 112,-6 L104,6 C92,-30 66,-48 34,-44 C18,-10 16,44 30,98 L14,110 Q-80,124 -114,30 Z', col.p) + T(x, 'M34,-52 C60,-62 96,-42 106,-10 M-60,-110 Q-90,-20 -70,80', col.p) + hl(x, 0, -100, 26, 7, 0, .5),
  wizard: (x, col) => E(x, 0, -58, 150, 13, shade(col.p, -.12)) + mirror(P(x, 'M-76,-64 Q-62,-150 6,-196 Q38,-218 76,-202 Q46,-198 34,-170 Q60,-122 78,-64 Q0,-46 -76,-64 Z', col.p) + P(x, 'M-78,-66 Q0,-48 80,-66 L76,-84 Q0,-68 -74,-84 Z', col.a) + star(-30, -112, 11, '#ffe78a') + star(10, -140, 7, '#ffe78a') + C(x, 80, -200, 7, '#ffe78a')) + hl(x, 40, -128, 6, 22, -20, .45),
  circlet: (x, col) => P(x, 'M-98,-30 Q0,-74 104,-44 L102,-34 Q0,-62 -96,-20 Z', GOLDC) + P(x, 'M86,-62 L98,-78 L106,-58 L96,-44 Z', col.a) + hl(x, 96, -64, 2.5, 5, 0, .9),
  workcap: (x, col) => P(x, 'M-102,-14 C-106,-96 -50,-118 4,-118 C56,-118 106,-92 104,-24 Q0,-44 -102,-14 Z', col.p) + P(x, 'M90,-34 Q132,-34 154,-18 Q124,-4 92,-14 Z', shade(col.p, -.1)) + T(x, 'M4,-118 Q10,-80 8,-40 M-50,-108 Q-60,-70 -62,-30', col.p) + C(x, 4, -116, 7, col.a) + hl(x, 26, -92, 24, 7, 10, .55),
  goggles: x => P(x, 'M-98,-26 Q0,-66 104,-38 L102,-22 Q0,-50 -96,-10 Z', LEATHER) + E(x, 78, -46, 13, 20, '#b08a4a') + E(x, 80, -46, 8, 14, '#8fe3ff') + hl(x, 77, -52, 3, 5, 0, .9),
  bandana: (x, col) => P(x, 'M-102,-8 C-106,-94 -50,-114 4,-114 C56,-114 106,-90 104,-22 Q0,-40 -102,-8 Z', col.p) + P(x, 'M-96,-12 L-130,30 L-112,34 Z', col.p) + P(x, 'M-96,-16 L-134,6 L-130,-14 Z', col.p) + E(x, -96, -14, 10, 9, shade(col.p, -.06)) + [[-40, -80], [20, -94], [60, -60]].map(([X, Y]) => `<circle cx="${X}" cy="${Y}" r="5" fill="#fff" opacity=".8" stroke="none"/>`).join(''),
};
// Body in profile.
const TORSO_SD = 'M-24,-6 Q-34,30 -36,66 Q-36,74 -28,74 L30,74 Q38,74 38,64 Q36,34 24,-6 Z';
const skirtS = (y, f) => `M-22,-6 Q-34,40 ${-30 - f},${y} L${30 + f},${y} Q34,40 22,-6 Z`;
const SHORTS_SD = 'M-32,58 L34,58 L35,92 L-32,92 Z';
function legsSide(x, o) {
  const top = o.top || 82; let s = '';
  for (const [X, far] of [[3, true], [-13, false]]) {
    const f = c => far ? shade(c, -.08) : c;
    s += R(x, X, top, 17, 132 - top, 8, f(o.leg));
    if (o.sock) s += R(x, X, o.sockTop || 108, 17, 132 - (o.sockTop || 108), 6, f(o.sock));
    s += P(x, `M${X - 2},136 Q${X - 2},124 ${X + 10},124 Q${X + 30},124 ${X + 30},136 Q${X + 30},144 ${X + 14},144 L${X + 4},144 Q${X - 2},144 ${X - 2},136 Z`, f(o.shoe));
    if (!far) s += `<ellipse cx="${X + 12}" cy="130" rx="6" ry="2.4" fill="#fff" opacity=".55" stroke="none"/>`;
  }
  return s;
}
function armSide(x, o, far, rot) {
  const f = c => far ? shade(c, -.1) : c, px = far ? 8 : -2, w = o.w || 20;
  let s = `<g transform="translate(${px},4) rotate(${rot})">` + R(x, -w / 2, -6, w, 58, w / 2, f(o.skin));
  if (o.sleeveLen) s += R(x, -w / 2 - 2, -6, w + 4, o.sleeveLen, (w + 4) / 2, f(o.sleeve));
  if (o.cuff) s += R(x, -w / 2 - 1, 42, w + 2, 9, 4, f(o.cuff));
  s += C(x, 0, 60, (w * .62).toFixed(1), f(o.hand || o.skin)) + '</g>';
  if (!far && o.pauldron) s += E(x, 2, 6, 21, 15, o.pauldron) + T(x, 'M-14,10 Q2,18 18,10', o.pauldron);
  return s;
}
const ARMROT = { near: -16, far: -50, rest: 6 };
const handAt = (far, rot) => { const r = rot * Math.PI / 180; return [(far ? 8 : -2) - 60 * Math.sin(r), 4 + 60 * Math.cos(r)]; };
// Per-outfit profile: arm and leg kit plus the torso drawing.
const OUTFITS_S = {
  plate: k => ({ arm: { skin: k.skin, sleeve: STEEL, sleeveLen: 58, w: 22, hand: STEEL_D, cuff: STEEL_D, pauldron: STEEL }, leg: { leg: STEEL, shoe: STEEL_D, top: 80 },
    torso: x => P(x, TORSO_SD, STEEL) + P(x, 'M4,26 L30,26 L36,104 L8,112 Z', k.col.p) + L(x, 'M4,26 L8,112 L36,104', 2.6, k.col.a) + P(x, 'M-32,40 L35,40 L35,50 L-32,50 Z', LEATHER) + P(x, 'M24,38 L34,38 L34,52 L24,52 Z', GOLDC) }),
  chain: k => ({ arm: { skin: k.skin, sleeve: '#9aa4b2', sleeveLen: 44, w: 21, hand: LEATHER }, leg: { leg: '#9aa4b2', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 112 },
    torso: x => P(x, TORSO_SD, '#9aa4b2') + P(x, 'M-24,0 Q-34,40 -36,108 L36,108 Q34,40 22,0 Q0,8 -24,0 Z', k.col.p) + L(x, 'M-24,0 Q0,8 22,0', 3, k.col.a) + P(x, 'M26,34 L32,44 L30,62 L24,66 Z', k.col.a) + P(x, 'M-34,48 L35,48 L35,58 L-34,58 Z', LEATHER) }),
  brigandine: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 30, w: 21, hand: LEATHER, cuff: LEATHER }, leg: { leg: '#4a4f5c', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 108 },
    torso: x => P(x, TORSO_SD, LEATHER) + P(x, SHORTS_SD, '#4a4f5c') + [[-14, 14], [4, 14], [20, 14], [-16, 34], [2, 34], [20, 34], [-18, 54], [0, 54], [20, 54]].map(([X, Y]) => C(x, X, Y, 3.4, GOLDC)).join('') + P(x, 'M-32,62 L35,62 L35,72 L-32,72 Z', k.col.p) }),
  tunic: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 50, w: 20, hand: LEATHER, cuff: LEATHER }, leg: { leg: '#6b5440', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 104 },
    torso: x => P(x, skirtS(92, 10), k.col.p) + P(x, 'M2,-4 Q28,10 32,58 L8,58 Z', LEATHER) + P(x, 'M-22,-4 Q-30,30 -32,58 L-12,58 L-10,-4 Z', LEATHER) + P(x, 'M-34,54 L36,54 L36,64 L-34,64 Z', shade(LEATHER, -.08)) + P(x, 'M26,52 L36,52 L36,66 L26,66 Z', GOLDC) }),
  scout: k => ({ arm: { skin: k.skin, sleeve: '#e9e1cf', sleeveLen: 40, w: 20, hand: LEATHER }, leg: { leg: k.skin, shoe: LEATHER, top: 80, sock: '#e9e1cf', sockTop: 96 },
    torso: x => P(x, TORSO_SD, '#e9e1cf') + P(x, SHORTS_SD, '#6b5440') + P(x, 'M-32,-12 Q4,2 30,-12 Q44,18 38,40 Q0,52 -38,40 Q-46,18 -32,-12 Z', k.col.p) + C(x, 26, 10, 6, k.col.a) + P(x, 'M-32,56 L35,56 L35,64 L-32,64 Z', LEATHER) }),
  robe: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 50, w: 24, cuff: k.col.a }, leg: { leg: k.skin, shoe: '#3a2a5a', top: 116 },
    torso: x => P(x, skirtS(128, 22), k.col.p) + P(x, 'M-52,116 L52,116 L54,128 L-54,128 Z', k.col.a) + P(x, 'M12,0 L22,0 L44,116 L30,116 Z', shade(k.col.p, .1)) + L(x, 'M12,0 L30,116 M22,0 L44,116', 2.4, k.col.a) + P(x, 'M-26,-10 Q0,4 26,-10 L28,8 Q0,20 -28,8 Z', shade(k.col.p, -.12)) + P(x, 'M-36,46 L36,46 L38,56 L-38,56 Z', '#c43a5c') + star(30, 74, 6, '#ffe78a') }),
  battlerobe: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 36, w: 22, cuff: k.col.a }, leg: { leg: '#3a2f4f', shoe: '#3a2f4f', top: 80, sock: k.col.a, sockTop: 104 },
    torso: x => P(x, skirtS(96, 16), k.col.p) + L(x, 'M-46,96 L46,96', 2.6, k.col.a) + P(x, 'M10,-8 L24,30 L28,-6 Z', shade(k.col.p, .14)) + P(x, 'M-36,52 L38,52 L38,62 L-36,62 Z', '#c43a5c') }),
  apron: k => ({ arm: { skin: k.skin, sleeve: '#6f7a8a', sleeveLen: 18, w: 22, hand: '#7a5232' }, leg: { leg: '#4a4f5c', shoe: '#3b2a24', top: 76 },
    torso: x => P(x, TORSO_SD, '#6f7a8a') + P(x, 'M-32,62 L35,62 L35,90 L-32,90 Z', '#4a4f5c') + P(x, 'M14,10 L32,10 L44,108 L20,112 Z', k.col.p) + tube(x, 'M18,12 L4,-6', 5, shade(k.col.p, -.12)) + tube(x, 'M-30,58 L30,58', 7, k.col.p) }),
  overalls: k => ({ arm: { skin: k.skin, sleeve: '#f1ede4', sleeveLen: 24, w: 21 }, leg: { leg: k.col.p, shoe: '#3b2a24', top: 80 },
    torso: x => P(x, TORSO_SD, '#f1ede4') + P(x, 'M-32,60 L36,60 L37,100 L-32,100 Z', k.col.p) + P(x, 'M8,14 L32,14 L36,62 L4,62 Z', k.col.p) + tube(x, 'M12,16 L-16,-4', 7, k.col.p) + C(x, 14, 18, 4, GOLDC) + P(x, 'M16,28 L30,28 L30,42 L16,42 Z', shade(k.col.p, -.08)) }),
};
const BACKS_S = {
  cape: (x, k) => P(x, 'M-18,-8 Q-48,50 -60,124 Q-34,134 -8,128 L8,-6 Z', shade(k.col.p, -.06)) + T(x, 'M-20,20 Q-34,70 -40,124', k.col.p),
  quiver: x => `<g transform="translate(-30,-26) rotate(-24)">${L(x, 'M-6,0 L-10,-24 M2,0 L2,-28 M8,0 L12,-22', 3)}${P(x, 'M-14,-26 L-6,-20 L-14,-16 Z M0,-32 L6,-26 L-4,-24 Z', '#ff6fae')}${R(x, -12, 0, 24, 74, 8, LEATHER)}${T(x, 'M-12,16 L12,16 M-12,56 L12,56', LEATHER)}</g>`,
  pack: x => R(x, -54, 0, 34, 70, 12, LEATHER) + `<g transform="translate(-40,-8) rotate(-18)">${R(x, -4, -6, 8, 56, 3, WOOD)}${R(x, -16, -18, 32, 18, 4, STEEL)}</g>`,
  tome: (x, k) => `<g transform="translate(-44,26)">${R(x, -10, -4, 20, 62, 5, k.col.p)}${R(x, -4, 0, 10, 54, 3, '#f3ead6')}</g>`,
};
const STRAP_S = { quiver: 1, pack: 1, tome: 1 };
// v5 wardrobe in profile
Object.assign(OUTFITS_S, {
  paladin: k => ({ arm: { skin: k.skin, sleeve: STEEL, sleeveLen: 58, w: 22, hand: STEEL_D, cuff: GOLDC, pauldron: GOLDC }, leg: { leg: STEEL, shoe: STEEL_D, top: 80 },
    torso: x => P(x, TORSO_SD, STEEL) + P(x, 'M-24,-4 Q-36,40 -40,118 L40,118 Q36,40 24,-4 Z', LINEN) + L(x, 'M-39,116 L39,116', 3, k.col.a) + P(x, 'M16,12 L24,12 L26,94 L18,94 Z', k.col.p) + P(x, 'M8,34 L37,34 L38,44 L8,44 Z', k.col.p) + P(x, 'M-34,58 L37,58 L37,66 L-34,66 Z', LEATHER) }),
  gambeson: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 52, w: 23, hand: LEATHER, cuff: shade(k.col.p, -.12) }, leg: { leg: '#6b5440', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 100 },
    torso: x => P(x, 'M-26,-6 Q-38,34 -40,96 Q0,102 40,96 Q38,34 26,-6 Z', k.col.p) + T(x, 'M-12,2 L-16,98 M8,2 L10,98 M-34,28 L34,28', k.col.p) + P(x, 'M-38,64 L40,64 L40,74 L-38,74 Z', LEATHER) + R(x, 30, 64, 10, 10, 2, GOLDC) }),
  duster: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 54, w: 21, hand: LEATHER, cuff: shade(k.col.p, -.14) }, leg: { leg: '#4a4f5c', shoe: LEATHER, top: 80, sock: LEATHER, sockTop: 100 },
    torso: x => P(x, TORSO_SD, '#e9e1cf') + P(x, 'M22,56 L37,56 L37,64 L22,64 Z', LEATHER) + P(x, 'M-24,-6 Q-38,40 -48,122 L20,122 L24,40 L22,-4 Z', k.col.p) + P(x, 'M12,-4 L24,26 L8,16 Z', shade(k.col.p, -.12)) + T(x, 'M-30,82 L-4,82', k.col.p) }),
  corsair: k => ({ arm: { skin: k.skin, sleeve: LINEN, sleeveLen: 46, w: 24, cuff: LINEN }, leg: { leg: '#3b3550', shoe: '#3b2a24', top: 80, sock: '#3b2a24', sockTop: 96 },
    torso: x => P(x, 'M-32,66 L34,66 L35,96 L-32,96 Z', '#3b3550') + P(x, TORSO_SD, LINEN) + P(x, 'M-24,-4 Q-34,30 -36,60 L18,60 L22,-4 Z', k.col.p) + P(x, 'M-36,54 L37,54 L37,70 L-36,70 Z', k.col.a) + P(x, 'M-30,64 L-46,102 L-34,106 L-22,68 Z', k.col.a) }),
  starcloak: k => ({ arm: { skin: k.skin, sleeve: shade(k.col.p, -.16), sleeveLen: 54, w: 25, cuff: k.col.a }, leg: { leg: k.skin, shoe: '#2a2040', top: 116 },
    torso: x => P(x, skirtS(124, 24), shade(k.col.p, -.16)) + L(x, 'M-53,122 L53,122', 3, k.col.a) + star(-20, 84, 6, '#ffe78a') + star(20, 104, 4, '#ffe78a') + P(x, 'M-30,-12 Q4,0 32,-10 Q44,20 38,40 Q0,30 -40,40 Q-46,20 -30,-12 Z', k.col.p) + L(x, 'M-40,40 Q0,30 38,40', 3, k.col.a) + P(x, 'M-30,-12 L-34,-30 L-12,-16 Z', k.col.p) }),
  acolyte: k => ({ arm: { skin: k.skin, sleeve: LINEN, sleeveLen: 54, w: 24, cuff: k.col.a }, leg: { leg: k.skin, shoe: '#7a5232', top: 116 },
    torso: x => P(x, skirtS(128, 22), LINEN) + P(x, 'M-52,116 L52,116 L54,128 L-54,128 Z', k.col.a) + P(x, 'M14,-4 L25,-4 L31,110 L19,110 Z', k.col.p) + P(x, 'M19,98 L30,98 L31,110 L19,110 Z', k.col.a) + tube(x, 'M-34,52 L38,52', 6, '#d8b88a') + tube(x, 'M30,56 L36,90', 5, '#d8b88a') }),
  smith: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 20, w: 23, hand: '#4a3a2e', cuff: '#4a3a2e' }, leg: { leg: '#5a4a3e', shoe: '#3b2a24', top: 78 },
    torso: x => P(x, TORSO_SD, k.col.p) + P(x, 'M-34,70 L36,70 L37,90 L-34,90 Z', '#5a4a3e') + P(x, 'M-24,-4 Q-34,30 -36,66 L26,66 L24,-4 Z', LEATHER) + P(x, 'M-36,62 L38,62 L38,74 L-36,74 Z', shade(LEATHER, -.14)) + R(x, 16, 66, 18, 22, 4, LEATHER) + tube(x, 'M-6,72 L-12,98', 5, STEEL) }),
  engineer: k => ({ arm: { skin: k.skin, sleeve: k.col.p, sleeveLen: 52, w: 22, hand: '#d8b88a', cuff: shade(k.col.p, -.1) }, leg: { leg: k.col.p, shoe: '#3b2a24', top: 76 },
    torso: x => E(x, 1, 110, 11, 8, '#4a4f5c') + P(x, 'M-24,-6 Q-34,30 -36,66 L-36,100 L35,100 L38,64 Q36,34 24,-6 Z', k.col.p) + L(x, 'M28,10 L34,88', 2.4, '#e8eef6') + R(x, 0, 18, 16, 12, 3, k.col.a) + P(x, 'M-36,56 L38,56 L38,64 L-36,64 Z', '#4a4f5c') }),
});
Object.assign(HATS_S, {
  coif: x => HATS_S.hood(x, { p: MAIL }) + mailDots(x, 'M-100,20 C-104,-60 -50,-110 6,-112 C60,-110 100,-70 104,-20 M-96,70 Q-60,100 -10,104'),
  crown: (x, col) => P(x, 'M-90,-26 L-86,-78 L-50,-58 L-12,-98 L24,-62 L66,-94 L100,-44 Q0,-72 -90,-26 Z', GOLDC) + P(x, 'M-92,-30 Q0,-76 104,-44 L102,-30 Q0,-60 -90,-16 Z', shade(GOLDC, -.1)) + C(x, -12, -98, 5, GOLDC) + C(x, 66, -94, 5, GOLDC) + C(x, 62, -46, 6, col.a),
  beret: (x, col) => P(x, 'M-96,-50 C-108,-104 -30,-130 40,-120 C100,-110 124,-80 98,-56 Q0,-40 -96,-50 Z', col.p) + P(x, 'M-92,-52 Q0,-58 100,-60 L98,-48 Q0,-44 -90,-40 Z', shade(col.p, -.12)) + C(x, 4, -124, 6, col.p) + hl(x, 20, -100, 22, 6, 8, .5),
  hardhat: (x, col) => P(x, 'M-100,-20 C-104,-100 -48,-124 4,-124 C60,-124 104,-96 102,-24 Z', col.a) + P(x, 'M-120,-22 Q0,-48 126,-30 L124,-16 Q0,-34 -118,-8 Z', shade(col.a, -.1)) + T(x, 'M4,-122 Q14,-80 10,-36', col.a) + R(x, 50, -80, 34, 22, 6, col.p) + hl(x, 26, -94, 22, 7, 10, .6),
});
BACKS_S.banner = (x, k) => tube(x, 'M-60,110 L-60,-400', 7, WOOD) + C(x, -60, -404, 7, GOLDC) + P(x, 'M-64,-394 L-134,-394 L-134,-334 L-114,-346 L-98,-330 L-64,-338 Z', k.col.p) + P(x, 'M-104,-388 L-96,-388 L-96,-374 L-82,-374 L-82,-366 L-96,-366 L-96,-344 L-104,-344 L-104,-366 L-118,-366 L-118,-374 L-104,-374 Z', k.col.a);
STRAP_S.banner = 1;

// Grip point of each held item as drawn by WEAPONS/OFFHANDS (body space, front view).
const GRIP = { sword: [64, 58], lance: [63, 61], fan: [66, 58], orbit: [66, 61], longbow: [-70, 58], firepot: [64, 62], reviver: [64, 61], hammer: [62, 60] };
// Which hand holds the weapon: 'L' = the character's left (+x in the front view), 'R' = right.
const weaponHand = w => (WEAPONS[w] && WEAPONS[w].offhand) ? 'R' : 'L';
// In the right-facing profile the character's right side is nearest the viewer; the left profile mirrors that.
function sidePose(k, left) {
  const nearHand = left ? 'L' : 'R', wp = WEAPONS[k.weapon] ? k.weapon : null;
  const wNear = wp && weaponHand(wp) === nearHand, ohOn = OFFHANDS[k.offhand] && OFFHANDS[k.offhand].draw;
  const ohNear = !!ohOn && nearHand === 'R';
  const nearBusy = wNear || ohNear, farBusy = (wp && !wNear) || (ohOn && !ohNear);
  const rotN = nearBusy ? ARMROT.near : ARMROT.rest, rotF = farBusy ? ARMROT.far : ARMROT.rest + 8;
  const hand = { near: handAt(false, rotN), far: handAt(true, rotF) };
  const wHand = wp ? (wNear ? hand.near : hand.far) : null;
  return { rotN, rotF, wNear, wp, wHand, hand, ohOn, ohNear };
}
// Offset that moves a held item's front-view grip onto the profile hand (used by effects too).
// Long upward items tilt forward in profile so they pass in front of the face, not across it.
const TILT_S = { lance: 55, orbit: 50, reviver: 92, fan: 30, hammer: 28, sword: -6 };
function sideWeaponOffset(k, left) {
  const p = sidePose(k, left); if (!p.wp) return null;
  return { grip: GRIP[p.wp] || [64, 60], hand: p.wHand, rot: TILT_S[p.wp] || 0 };
}
function renderSide(k, left) {
  const defs = {}, pfx = 'k' + (UID++) + '-';
  const xh = new Ctx(HEAD.s, defs, pfx), xb = new Ctx(BODY.s, defs, pfx);
  const G = (sp, c) => c ? `<g transform="translate(${sp === 'h' ? HEAD.x : BODY.x},${sp === 'h' ? HEAD.y : BODY.y}) scale(${sp === 'h' ? HEAD.s : BODY.s})" stroke="${LINE}" stroke-width="${(sp === 'h' ? xh : xb).sw.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round">${c}</g>` : '';
  const hat = HATS[k.hat] || HATS.none, hideTop = hat.hides === 'top' || hat.hides === 'all', hood = hat.hides === 'all';
  const ex = EXTRAS[k.extra] || EXTRAS.none;
  const O = (OUTFITS_S[k.outfit] || OUTFITS_S.tunic)(k);
  const pose = sidePose(k, left);
  // held items: the weapon moves from its front grip to the profile hand; the far one is shaded by drawing it behind the body
  let wDraw = '';
  if (pose.wp) { const g = GRIP[pose.wp] || [64, 60]; wDraw = `<g transform="translate(${pose.wHand[0].toFixed(1)},${pose.wHand[1].toFixed(1)}) rotate(${TILT_S[pose.wp] || 0}) translate(${-g[0]},${-g[1]})">${WEAPONS[pose.wp].draw(xb, k, false)}</g>`; }
  let ohDraw = '';
  if (pose.ohOn) { const h = pose.ohNear ? pose.hand.near : pose.hand.far; const sh = OFFHANDS[k.offhand].draw(xb, k, false); ohDraw = `<g transform="translate(${(h[0] + 4).toFixed(1)},${h[1].toFixed(1)}) scale(.62,1) translate(62,-54)">${sh}</g>`; }
  const farItems = (pose.wp && !pose.wNear ? wDraw : '') + (pose.ohOn && !pose.ohNear ? ohDraw : '');
  const nearItems = (pose.wp && pose.wNear ? wDraw : '') + (pose.ohOn && pose.ohNear ? ohDraw : '');
  const bk = BACKS_S[k.back] ? BACKS_S[k.back](xb, k) : '';
  const hairBk = hood ? '' : hairSide(xh, k, 'back', hideTop);
  const drape = hood ? '' : hairSide(xb, k, 'drape');
  const skull = P(xh, HEAD_S, k.skin);
  const ear = hood ? '' : E(xh, -8, 16, 12, 16, k.skin) + L(xh, 'M-11,9 Q-3,16 -11,23', 2);
  const capHair = hood ? '' : hairSide(xh, k, 'cap', hideTop);
  let exS = '';
  if (k.extra === 'glasses') exS = L(xh, 'M60,24 m-16,0 a16,16 0 1 0 32,0 a16,16 0 1 0 -32,0 M44,20 L-4,10', 3.4) + `<ellipse cx="54" cy="16" rx="5" ry="3" fill="#fff" opacity=".7" stroke="none"/>`;
  if (k.extra === 'patch') exS = left ? L(xh, 'M-40,-30 L96,6', 3.4) + P(xh, 'M46,8 Q62,2 74,10 Q74,32 60,40 Q46,32 46,8 Z', '#2b2a45') : L(xh, 'M-60,-20 L100,4', 3.4);
  if (k.extra === 'plaster' && left) exS = `<g transform="rotate(-18 54 46)">${R(xh, 40, 40, 30, 13, 4, '#f6e2c4')}${L(xh, 'M48,42 L48,51 M54,42 L54,51 M60,42 L60,51', 1.6, '#d8b88a')}</g>`;
  if (k.extra === 'ahoge' && !hideTop) exS += P(xh, 'M4,-100 C-2,-142 32,-170 68,-150 C42,-150 24,-134 18,-100 Z', k.hairColor);
  const face = faceSide(xh, k.face, left);
  const hatS = HATS_S[k.hat] ? HATS_S[k.hat](xh, k.col) : '';
  const strap = STRAP_S[k.back] ? tube(xb, 'M-20,-4 L30,52', 6, shade(LEATHER, -.1)) : '';
  const cape = k.back === 'cape' ? P(xb, 'M-22,-10 Q0,4 26,-8 L26,4 Q0,16 -22,4 Z', k.col.a) : '';
  const layers = [
    G('b', bk + drape + armSide(xb, O.arm, true, pose.rotF) + farItems),
    G('h', hairBk),
    G('b', legsSide(xb, O.leg) + O.torso(xb) + strap + cape),
    G('h', skull + ear + face + capHair + exS + hatS),
    G('b', armSide(xb, O.arm, false, pose.rotN) + nearItems),
  ];
  const fid = pfx + 'stk';
  const filt = `<filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d"/><feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="w"/><feMorphology in="SourceAlpha" operator="dilate" radius="12" result="d2"/><feFlood flood-color="#1b1430" flood-opacity=".35"/><feComposite in2="d2" operator="in" result="s"/><feOffset in="s" dx="0" dy="6" result="so"/><feMerge><feMergeNode in="so"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const shadow = `<ellipse cx="200" cy="${(BODY.y + 140 * BODY.s).toFixed(0)}" rx="${(90 * BODY.s + 20).toFixed(0)}" ry="12" fill="#000" opacity=".22"/>`;
  const body = layers.join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><defs>${Object.values(defs).join('')}${filt}</defs>${shadow}<g filter="url(#${fid})">${left ? `<g transform="translate(400,0) scale(-1,1)">${body}</g>` : body}</g></svg>`;
}

// ------------------------------------------------------------ assembly
let UID = 0;
function render(k, view) {
  if (view === 'side' || view === 'sideL') return renderSide(k, view === 'sideL');
  // qL / qbL: the 3/4 views turned the other way. Every part is drawn mirrored, then the whole figure is
  // flipped back, so the parts keep their own sides (weapon hand, eyepatch, hat tails) while the turn reverses.
  const flip = view === 'qL' || view === 'qbL';
  if (flip) view = view === 'qL' ? 'q' : 'qb';
  const m = c => flip ? mirror(c) : c;
  const defs = {}, pfx = 'k' + (UID++) + '-';
  const xh = new Ctx(HEAD.s, defs, pfx), xb = new Ctx(BODY.s, defs, pfx);
  const back = view === 'back' || view === 'qb';
  const hc = k.hairColor, col = k.col;
  const hat = HATS[k.hat] || HATS.none, ex = EXTRAS[k.extra] || EXTRAS.none;
  const hideTop = hat.hides === 'top' || hat.hides === 'all';
  const hoodOn = hat.hides === 'all';
  const hairKey = k.hair;
  const H = hairKey ? HAIRS[hairKey] : HAIRS.bald;
  const G = (sp, c) => c ? `<g transform="translate(${sp === 'h' ? HEAD.x : BODY.x},${sp === 'h' ? HEAD.y : BODY.y}) scale(${sp === 'h' ? HEAD.s : BODY.s})" stroke="${LINE}" stroke-width="${(sp === 'h' ? xh : xb).sw.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round">${c}</g>` : '';
  // parts
  const outfit = m(OUTFITS[k.outfit].draw(xb, k, back));
  const bk = BACKS[k.back] || BACKS.none, wp = WEAPONS[k.weapon], oh = OFFHANDS[k.offhand] || OFFHANDS.none;
  const held = m((wp ? wp.draw(xb, k, back) : '') + (oh.draw ? oh.draw(xb, k, back) : ''));
  const skull = E(xh, 0, 0, 98, 88, k.skin);
  const ears = E(xh, -94, 14, 14, 18, k.skin) + E(xh, 94, 14, 14, 18, k.skin);
  const showEars = !hoodOn && (!H.back || hairKey === 'quiff' || hairKey === 'short' || hairKey === 'pony');
  const hb = hairKey && !hoodOn ? hairBack(xh, hairKey, hc, back ? 'back' : 'front') : '';
  const hbTrim = hairKey && hideTop && (hairKey === 'quiff') ? hairBack(xh, 'short', hc, back ? 'back' : 'front') : hb;
  const hairB = m(hoodOn ? '' : hideTop && hairKey === 'quiff' ? hbTrim : hb);
  const hoodLike = hat.hides === 'all';
  let hf = hairKey ? hairFront(xh, hideTop && hairKey === 'quiff' ? 'short' : hairKey, hc, k.skin) : '';
  if (hairKey === 'bald' || !hairKey) hf = hl(xh, -46, -52, 22, 9, -30, .6);
  const faceS = m(face(xh, k.face) + (ex.face ? ex.face(xh) : ''));
  const hatF = m(hat.draw(xh, col, false)), hatB = m(hat.draw(xh, col, true));
  const extraHead = m(!hideTop && ex.head ? ex.head(xh, hc) : '');
  const drape = m(hairKey && !hoodOn ? hairDrape(xb, hairKey, hc, back ? 'back' : 'front') : '');
  const earDetail = showEars ? L(xh, 'M-90,6 Q-100,14 -90,22', 2) + L(xh, 'M90,6 Q100,14 90,22', 2) : '';
  // split helpers for 3/4
  defs[pfx + 'L'] = `<clipPath id="${pfx}L"><rect x="-2000" y="-2000" width="2000.6" height="4000"/></clipPath>`;
  defs[pfx + 'R'] = `<clipPath id="${pfx}R"><rect x="0" y="-2000" width="2000" height="4000"/></clipPath>`;
  const split = (c, sh, far, left) => c ? (left
    ? `<g transform="translate(${sh},0) scale(${far},1)"><g clip-path="url(#${pfx}L)">${c}</g></g><g transform="translate(${sh},0)"><g clip-path="url(#${pfx}R)">${c}</g></g>`
    : `<g transform="translate(${sh},0)"><g clip-path="url(#${pfx}L)">${c}</g></g><g transform="translate(${sh},0) scale(${far},1)"><g clip-path="url(#${pfx}R)">${c}</g></g>`) : '';
  let layers = [];
  if (view === 'front') {
    layers = [G('h', hairB), G('b', (bk.under ? bk.under(xb, k) : '') + drape), G('b', outfit),
      G('h', (showEars ? ears : '') + skull + earDetail + faceS + hf + extraHead + hatF), G('b', held)];
  } else if (view === 'back') {
    layers = [G('b', outfit), G('b', drape + (bk.over ? bk.over(xb, k) : '')),
      G('h', (showEars ? ears : '') + skull + hairB + (ex.back && !hideTop ? ex.back(xh, hc) : '') + hatB), G('b', mirror(held))];
  } else if (view === 'q') {
    const TEMPLE = '-54,-50 -70,-20 L-78,-2 L-72,10 L-82,26 L-74,40 L-84,58 L-76,72 L-86,92';
    // temple: unturned back hair showing behind the turned face, ending in a soft hairline above the ear
    defs[pfx + 'T'] = `<clipPath id="${pfx}T"><path d="M-400,-400 L-24,-400 C-28,-84 ${TEMPLE} L-86,400 L-400,400 Z"/></clipPath>`;
    defs[pfx + 'S'] = `<clipPath id="${pfx}S"><ellipse cx="0" cy="0" rx="97" ry="87"/></clipPath>`;
    // short hair under a covering hat stays hidden; it would only peek out behind the turned hat
    const hbs = hairB && !(hideTop && ['short', 'quiff'].includes(hairKey)) ? `<g transform="translate(-14,0)">${hairB}</g>` : '';
    const temple = hairB ? `<g clip-path="url(#${pfx}T)">${hbs}</g><g clip-path="url(#${pfx}S)">${T(xh, 'M-64,-32 L-70,-20 ' + TEMPLE.slice(TEMPLE.indexOf('L')), hc)}</g>` : '';
    const ear = !hoodOn && (!hairB || showEars) ? E(xh, -60, 16, 13, 17, k.skin) + L(xh, 'M-63,8 Q-54,16 -63,24', 2) : '';
    const fk = hideTop && hairKey === 'quiff' ? 'short' : hairKey, fr = fk && HAIRS[fk] ? HAIRS[fk].front : null;
    // fringe shadow turns with the face but stays clipped to the unturned skull, so it leaves no seam
    const shadowQ = fr ? `<g clip-path="url(#${pfx}S)">${split(m(`<path d="${fr}" transform="translate(0,9)" fill="${shade(k.skin, -.08, .1)}" stroke="none"/>`), 30, .62)}</g>` : '';
    const hfQ = m(fr ? hairFront(xh, fk, hc, k.skin, true) : hf);
    // band hats wrap the skull, so they turn with the face instead of floating like a crown
    const hatQ = hat.band ? split(hatF, 30, .62) : split(hatF, 12, .86);
    layers = [G('h', hbs), G('b', split(m(bk.under ? bk.under(xb, k) : '') + drape, 0, .72)), G('b', split(outfit, 0, .72)),
      G('h', skull + temple + ear + shadowQ + split(faceS + hfQ + extraHead, 30, .62) + hatQ), G('b', split(held, 0, .92))];
  } else { // qb: back 3/4, the far (left) half recedes; .70 keeps the hair's outer edge on the skull's
    defs[pfx + 'N'] = `<clipPath id="${pfx}N"><rect x="40" y="-400" width="400" height="800"/></clipPath>`;
    const ear = !hoodOn ? E(xh, 62, 16, 13, 17, k.skin) + L(xh, 'M65,8 Q56,16 65,24', 2) : '';
    // the band turns with the hair; its near half stretches round to the near temple so it doesn't stop short
    const hatQB = hat.band ? `<g transform="translate(-30,0) scale(.70,1)"><g clip-path="url(#${pfx}L)">${hatB}</g></g><g transform="translate(-30,0) scale(1.28,1)"><g clip-path="url(#${pfx}R)">${hatB}</g></g>` : split(hatB, -12, .86, true);
    layers = [G('b', split(outfit, 0, .72, true)), G('b', split(drape + m(bk.over ? bk.over(xb, k) : ''), 0, .72, true)),
      G('h', skull + ear + split(hairB + m(ex.back && !hideTop ? ex.back(xh, hc) : ''), -30, .70, true) + hatQB),
      G('b', split(mirror(held), 0, .92, true))];
  }
  const fid = pfx + 'stk';
  const filt = `<filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d"/><feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="w"/><feMorphology in="SourceAlpha" operator="dilate" radius="12" result="d2"/><feFlood flood-color="#1b1430" flood-opacity=".35"/><feComposite in2="d2" operator="in" result="s"/><feOffset in="s" dx="0" dy="6" result="so"/><feMerge><feMergeNode in="so"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const shadow = `<ellipse cx="200" cy="${(BODY.y + 140 * BODY.s).toFixed(0)}" rx="${(90 * BODY.s + 20).toFixed(0)}" ry="12" fill="#000" opacity=".22"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><defs>${Object.values(defs).join('')}${filt}</defs>${shadow}<g filter="url(#${fid})">${flip ? `<g transform="translate(400,0) scale(-1,1)">${layers.join('')}</g>` : layers.join('')}</g></svg>`;
}

const SKINS = ['#ffe4d4', '#f6d0b4', '#e9b48c', '#c98a5e', '#8d5a3b', '#5e3a26', '#f2a250', '#eef3f8'];
const HAIR_COLORS = ['#2b2a45', '#5a3a2a', '#a8673f', '#f2cc72', '#ece8f4', '#c8433f', '#2f86a6', '#f19bc2', '#b58ad6', '#3f8f4f'];
const EYE_COLORS = ['#5a3b2e', '#2a7fa8', '#3f8f4f', '#9b5bc0', '#c8433f', '#c98a20'];
const PRIMARY = ['#c8343f', '#2f5fb3', '#3f8f4f', '#5b3fa6', '#e0a83a', '#4a4f5c', '#f1f1f4', '#e8578f', '#7a4a2e'];
const ACCENT = ['#f2c14e', '#e8eef6', '#ff6fae', '#5fe0ff', '#7dff9f', '#2b2a45'];

root.ChibiKit = { render, sideWeaponOffset, CLASSES, HAIRS, HATS, OUTFITS, BACKS, WEAPONS, OFFHANDS, EXTRAS, EYES, MOUTHS, SKINS, HAIR_COLORS, EYE_COLORS, PRIMARY, ACCENT };
})(typeof window !== 'undefined' ? window : globalThis);
