/* Crusaders chibi kit, part 2: gear bonuses, enchantments and their animated effects.
   Base numbers come from the game (battle-professions.js CLASSES/WARD, battle-combat.js WEAPONS and melee).
   Effects are SMIL-animated SVG drawn in screen space (viewBox 400x520): an "under" layer behind the
   chibi and an "over" layer in front of it, both outside the sticker filter. */
(function (root) {
'use strict';
const K = root.ChibiKit;
const BX = 200, BY = 370, BS = .86, GROUND = Math.round(BY + 136 * BS), LINE = '#28223c';

// ------------------------------------------------------------ game numbers
const GAME = {
  classes: {
    fighter: { hp: 1000, ammo: 0, mana: 0, res: 30 },
    ranger: { hp: 100, ammo: 96, mana: 0, res: 30 },
    mage: { hp: 100, ammo: 48, mana: 100, res: 30 },
    builder: { hp: 125, ammo: 60, mana: 0, res: 60 },
  },
  ward: { mana: 35, seconds: 10, regen: 2 },
  weapons: {
    sword: { damage: 75, interval: .7, pellets: 1, melee: 3.8 },
    lance: { damage: 8, interval: .28, pellets: 1, magazine: 18, reload: 1.8 },
    fan: { damage: 12, interval: .48, pellets: 3, magazine: 9, reload: 2.2 },
    orbit: { damage: 18, interval: .85, pellets: 5, magazine: 6, reload: 2.5 },
    longbow: { damage: 72, interval: 1.8, pellets: 1, magazine: 3, reload: 2.8, charge: 1.15 },
    firepot: { damage: 65, interval: 3.2, pellets: 1, magazine: 2, reload: 3, blast: 10 },
    reviver: { damage: 0, interval: 1.8, pellets: 1, magazine: 3, reload: 2.4, revive: 14 },
    hammer: { tool: true },
  },
};

// ------------------------------------------------------------ item bonuses
// Keys: hp (flat), hpPct, dmg, rate, reload, move, regen, revive, blast, block (fractions), mag, ammo, mana, res (flat), ward (seconds).
const ITEM = {
  outfit: {
    plate: { hp: 150, move: -.08 }, chain: { hp: 90, move: -.03 }, brigandine: { hp: 40, move: .04 },
    tunic: { move: .06, ammo: 8 }, scout: { reload: .1, ammo: 16 },
    robe: { mana: 25 }, battlerobe: { hp: 20, ward: 1 },
    apron: { hp: 15, res: 15 }, overalls: { res: 25, move: .02 },
    paladin: { hp: 120, block: .05, move: -.06 }, gambeson: { hp: 60, move: .01 },
    duster: { hp: 20, ammo: 12 }, corsair: { move: .05, dmg: .03 },
    starcloak: { mana: 15, regen: .15 }, acolyte: { hp: 10, ward: .5, revive: .1 },
    smith: { hp: 25, res: 20 }, engineer: { res: 30, blast: .05 },
  },
  hat: {
    none: {}, helm: { hp: 40 }, horned: { hp: 25, dmg: .04 }, headband: { move: .03 }, bandana: { reload: .05 },
    cap: { dmg: .05 }, hood: { move: .02, reload: .04 }, wizard: { regen: .15 }, circlet: { mana: 15, ward: .5 },
    workcap: { hp: 10, res: 5 }, goggles: { blast: .1, dmg: .03 },
    coif: { hp: 30 }, crown: { hpPct: .05 }, beret: { reload: .06 }, hardhat: { hp: 30 },
  },
  back: { none: {}, cape: { hp: 20, move: .02 }, quiver: { ammo: 24 }, pack: { res: 20 }, tome: { ward: 1, regen: .1 }, banner: { hp: 10, fx: ['Allies near you deal 5% more damage'] } },
  offhand: { none: {}, heater: { block: .2, move: -.03 }, buckler: { block: .1 } },
};

const TIERS = {
  rare: { name: 'Rare', m: 1, n: 1, color: '#5fa8ff' },
  epic: { name: 'Epic', m: 1.5, n: 1.6, color: '#c77dff' },
  legendary: { name: 'Legendary', m: 2, n: 2.3, color: '#ffb340' },
};

const INFUSIONS = {
  none: { name: 'Plain', blurb: 'No infusion' },
  ember: { name: 'Ember', color: '#ff8a2a', glow: '#ffb347', blurb: 'More damage and a burn',
    bonus: m => ({ dmg: .08 * m, fx: [`Burns for ${r1(5 * m)} dmg/s over 2 s`] }) },
  frost: { name: 'Frost', color: '#8fe8ff', glow: '#bff4ff', blurb: 'Hits slow the target',
    bonus: m => ({ fx: [`Slows targets ${pct(.15 * m)} for 1.5 s`] }) },
  storm: { name: 'Storm', color: '#7fb8ff', glow: '#d6ecff', blurb: 'Faster attacks and reloads',
    bonus: m => ({ rate: .08 * m, reload: .06 * m }) },
  venom: { name: 'Venom', color: '#8de04a', glow: '#c6ff8a', blurb: 'Poison that lingers',
    bonus: m => ({ fx: [`Poisons for ${r1(3 * m)} dmg/s over 4 s`] }) },
  radiant: { name: 'Radiant', color: '#ffd75e', glow: '#fff1b0', blurb: 'Hits heal you, longer revives',
    bonus: m => ({ revive: .15 * m, fx: [`Each hit heals you ${r1(3 * m)} HP`] }) },
  void: { name: 'Void', color: '#a65cff', glow: '#d3a8ff', blurb: 'Tears through castle shields',
    bonus: m => ({ dmg: .04 * m, fx: [`${pct(.15 * m)} damage to castle shields`] }) },
  tide: { name: 'Tide', color: '#3fb8ff', glow: '#a8e6ff', blurb: 'Hits push targets back',
    bonus: m => ({ reload: .04 * m, fx: [`Hits push targets back ${r1(1.5 * m)} m`] }) },
  quake: { name: 'Quake', color: '#d08a3a', glow: '#ffd9a0', blurb: 'Smashes castle blocks',
    bonus: m => ({ dmg: .05 * m, fx: [`${pct(.12 * m)} more damage to castle blocks`] }) },
};

const AURAS = {
  none: { name: 'None', blurb: 'No aura' },
  bulwark: { name: 'Bulwark', color: '#8fd0ff', blurb: 'More health, better blocks',
    bonus: m => ({ hpPct: .08 * m, block: .05 * m }) },
  zephyr: { name: 'Zephyr', color: '#bff5e2', blurb: 'Run faster',
    bonus: m => ({ move: .06 * m }) },
  verdant: { name: 'Verdant', color: '#7ee08a', blurb: 'Heal out of combat',
    bonus: m => ({ fx: [`Heals ${r1(1.5 * m)} HP/s after 4 s out of combat`] }) },
  bramble: { name: 'Bramble', color: '#79b84f', blurb: 'Melee attackers get hurt',
    bonus: m => ({ fx: [`Reflects ${pct(.1 * m)} of melee damage`] }) },
  shadow: { name: 'Shadow', color: '#6b4fa0', blurb: 'Bots spot you later',
    bonus: m => ({ fx: [`Bots spot you ${pct(.1 * m)} later`] }) },
  arcane: { name: 'Arcane', color: '#c08bff', only: ['mage'], blurb: 'Mage only: mana and wards',
    bonus: m => ({ regen: .25 * m, ward: .5 * m }) },
  forge: { name: 'Forge', color: '#ffae4a', only: ['builder'], blurb: 'Builder only: more resources',
    bonus: m => ({ res: Math.round(10 * m), fx: [`Field repairs ${pct(.1 * m)} faster`] }) },
  phoenix: { name: 'Phoenix', color: '#ff7a2a', blurb: 'Rise again once per match',
    bonus: m => ({ hp: Math.round(15 * m), fx: [`Once per match, rise again with ${pct(.2 * m)} HP`] }) },
  frostveil: { name: 'Frostveil', color: '#a8e8ff', blurb: 'Melee attackers are slowed',
    bonus: m => ({ block: .03 * m, fx: [`Melee attackers are slowed ${pct(.12 * m)}`] }) },
  starfall: { name: 'Starfall', color: '#ffe78a', blurb: 'Falling stars strike your target',
    bonus: m => ({ fx: [`Every 8 s a star strikes your target for ${Math.round(15 * m)} damage`] }) },
};

function r1(v) { return (Math.round(v * 10) / 10).toString(); }
function pct(v) { return Math.round(v * 100) + '%'; }
function sgn(v, s) { return (v < 0 ? '−' : '+') + s; }

const LABEL = { hp: 'HP', hpPct: 'max HP', dmg: 'damage', rate: 'attack speed', reload: 'faster reload', move: 'move speed', regen: 'mana regen', revive: 'revive range', blast: 'blast radius', block: 'block (front)', mag: 'magazine', ammo: 'ammo', mana: 'mana', res: 'resources', ward: 'ward' };
function bonusText(o) {
  const out = [];
  for (const [k, v] of Object.entries(o || {})) {
    if (k === 'fx' || !v) continue;
    if (k === 'ward') out.push(sgn(v, Math.abs(v) + ' s') + ' ' + LABEL[k]);
    else if (k === 'reload') out.push(sgn(v, pct(Math.abs(v))) + ' ' + (v < 0 ? 'slower reload' : 'faster reload'));
    else if (['hp', 'mag', 'ammo', 'mana', 'res'].includes(k)) out.push(sgn(v, Math.abs(v)) + ' ' + LABEL[k]);
    else out.push(sgn(v, pct(Math.abs(v))) + ' ' + LABEL[k]);
  }
  return out.concat((o && o.fx) || []);
}
function itemBonus(slot, key) { return (ITEM[slot] || {})[key] || {}; }
function enchantBonus(kind, key, tier) {
  const d = (kind === 'aura' ? AURAS : INFUSIONS)[key];
  return d && d.bonus ? d.bonus((TIERS[tier] || TIERS.rare).m) : {};
}
function allowedAura(cls, key) { const a = AURAS[key]; return !!a && (!a.only || a.only.includes(cls)); }

// Final stat sheet for a build: rows with base, value and unit, plus effect lines.
function stats(k) {
  const C = GAME.classes[k.cls], W = GAME.weapons[k.weapon] || {};
  const parts = [itemBonus('outfit', k.outfit), itemBonus('hat', k.hat), itemBonus('back', k.back), itemBonus('offhand', k.offhand),
    enchantBonus('weapon', k.infuse, k.infuseTier), enchantBonus('aura', k.aura, k.auraTier)];
  const t = {}, fx = [];
  for (const p of parts) for (const [key, v] of Object.entries(p)) { if (key === 'fx') fx.push(...v); else t[key] = (t[key] || 0) + v; }
  const g = key => t[key] || 0;
  const rows = [];
  const row = (id, label, base, val, unit = '', dec = 0, better = 1) => rows.push({ id, label, base, val, unit, dec, better });
  row('hp', 'Health', C.hp, (C.hp + g('hp')) * (1 + g('hpPct')));
  row('move', 'Move speed', 100, 100 * (1 + g('move')), '%');
  if (W.tool) {
    rows.push({ id: 'tool', label: 'Hammer', text: 'Builds and repairs' });
  } else if (W.damage) {
    const dmg = W.damage * (1 + g('dmg')), iv = W.interval / (1 + g('rate'));
    row('dmg', W.pellets > 1 ? `Damage (x${W.pellets})` : 'Damage', W.damage, dmg);
    row('rate', W.melee ? 'Swings / s' : 'Shots / s', 1 / W.interval, 1 / iv, '', 2);
    row('dps', 'Damage / s', W.damage * W.pellets / W.interval, dmg * W.pellets / iv);
  } else if (W.revive) {
    row('revive', 'Revive range', W.revive, W.revive * (1 + g('revive')), ' m', 1);
  }
  if (W.magazine) {
    row('mag', 'Magazine', W.magazine, W.magazine + g('mag'));
    row('reload', 'Reload', W.reload, W.reload * (1 - g('reload')), ' s', 2, -1);
    row('ammo', 'Pocket ammo', C.ammo, C.ammo + g('ammo'));
  }
  if (W.blast) row('blast', 'Blast radius', W.blast, W.blast * (1 + g('blast')), ' m', 1);
  if (k.cls === 'mage') {
    row('mana', 'Mana', C.mana, C.mana + g('mana'));
    row('regen', 'Mana / s', GAME.ward.regen, GAME.ward.regen * (1 + g('regen')), '', 1);
    row('ward', 'Ward length', GAME.ward.seconds, GAME.ward.seconds + g('ward'), ' s', 1);
  }
  if (k.cls === 'builder') row('res', 'Resources', C.res, C.res + g('res'));
  if (g('block')) row('block', 'Front block', 0, 100 * g('block'), '%');
  return { rows, fx: W.damage ? fx : fx.filter(t => !/^Each hit|^Burns|^Poisons|^Slows|^Hits push|^Every 8 s|castle shields$|castle blocks$/.test(t)) };
}

// ------------------------------------------------------------ effect helpers
let FXID = 0;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const f1 = v => (Math.round(v * 10) / 10).toString();
const A = (attr, values, dur, begin, extra = '') => `<animate attributeName="${attr}" values="${values}" dur="${f1(dur)}s" begin="${f1(-begin)}s" repeatCount="indefinite" ${extra}/>`;
const AT = (type, values, dur, begin, extra = '') => `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${f1(dur)}s" begin="${f1(-begin)}s" repeatCount="indefinite" ${extra}/>`;
function glowDef(defs, pfx, c) {
  const id = pfx + 'rg' + c.slice(1);
  defs[id] = `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".45" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  return `url(#${id})`;
}
function glow(x, cx, cy, r, c, op = .7, ry) {
  return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(r)}" ry="${f1(ry || r)}" fill="${glowDef(x.defs, x.pfx, c)}" opacity="${op}">${A('opacity', `${op * .7};${op};${op * .7}`, 1.6, x.rnd() * 1.6)}</ellipse>`;
}
function star4(r) { const q = r * .28; return `M0,${-r} L${q},${-q} L${r},0 L${q},${q} L0,${r} L${-q},${q} L${-r},0 L${-q},${-q} Z`; }
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Weapon segments in body space (grip end, business end) and the hot spot.
const WSEG = {
  sword: [[67, 72], [90, 144], [88, 136]],
  lance: [[72, 10], [86, -84], [86, -78]],
  fan: [[60, 50], [34, 0], [38, 4]],
  orbit: [[70, 40], [78, -22], [78, -22]],
  longbow: [[-64, -30], [-64, 146], [-70, 58]],
  firepot: [[66, 60], [72, -2], [71, 0]],
  reviver: [[62, 80], [73, -26], [73, -28]],
  hammer: [[64, 62], [96, 2], [94, 4]],
};
function mapPt(view, p, k) {
  if (view === 'side' || view === 'sideL') {
    const o = k && K.sideWeaponOffset(k, view === 'sideL');
    let q = p;
    if (o) { const r = o.rot * Math.PI / 180, dx = p[0] - o.grip[0], dy = p[1] - o.grip[1]; q = [o.hand[0] + dx * Math.cos(r) - dy * Math.sin(r), o.hand[1] + dx * Math.sin(r) + dy * Math.cos(r)]; }
    const X = q[0] * BS, Y = BY + q[1] * BS;
    return [view === 'sideL' ? BX - X : BX + X, Y];
  }
  const flip = view === 'qL' || view === 'qbL', v = flip ? view.slice(0, -1) : view;
  let X = flip ? -p[0] : p[0];
  if (v === 'back' || v === 'qb') X = -X;
  if ((v === 'q' && X > 0) || (v === 'qb' && X < 0)) X *= .92;
  return [flip ? BX - X * BS : BX + X * BS, BY + p[1] * BS];
}

// ------------------------------------------------------------ weapon infusions
function infusionFx(x, key, n, a, b, tip, lite) {
  const R = x.rnd, d = INFUSIONS[key], c = d.color, gl = d.glow;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  const along = (lo = .25, hi = 1, j = 6) => { const p = lerp(a, b, lo + R() * (hi - lo)), s = (R() - .5) * 2 * j; return [p[0] + nx * s, p[1] + ny * s]; };
  const cnt = v => Math.round(v * n);
  let under = '', over = '';
  const bl = x.pfx + 'bl';
  x.defs[bl] = `<filter id="${bl}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>`;
  // Infused look: a blurred, screen-blended halo along the weapon plus a hot spot.
  if (lite) over += glow(x, tip[0], tip[1], 50 + 10 * n, c, .6) + `<path d="M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}" stroke="${c}" stroke-width="${f1(14 + 5 * n)}" stroke-linecap="round" opacity=".35"/>`;
  else over += `<g style="mix-blend-mode:screen">${glow(x, tip[0], tip[1], 56 + 12 * n, c, .5)}<g filter="url(#${bl})"><path d="M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}" stroke="${c}" stroke-width="${f1(18 + 6 * n)}" stroke-linecap="round" fill="none" opacity=".7">${A('opacity', '.5;.9;.5', 1.4, 0)}</path><circle cx="${f1(tip[0])}" cy="${f1(tip[1])}" r="${f1(16 + 5 * n)}" fill="${gl}" opacity=".8"/></g></g>`;
  if (key === 'ember') {
    for (let i = 0; i < cnt(6); i++) {
      const [px, py] = along(.3, 1, 7), s = 1 + R() * .7, du = .5 + R() * .4;
      over += `<g transform="translate(${f1(px)},${f1(py)}) scale(${f1(s)})"><g><path d="M0,2 C-8,-2 -9,-14 0,-28 C9,-14 8,-2 0,2 Z" fill="${c}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/><path d="M0,0 C-4,-3 -4,-10 0,-17 C4,-10 4,-3 0,0 Z" fill="#fff2a8"/>${AT('scale', '1 1;1.12 1.3;.92 .9;1 1', du, R() * du)}</g></g>`;
    }
    for (let i = 0; i < cnt(14); i++) {
      const [px, py] = along(.1, 1, 14), du = 1.2 + R() * 1.2, h = 60 + R() * 70, sw = (R() - .5) * 40;
      over += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(2.2 + R() * 2.4)}" fill="${R() < .5 ? '#ffd36a' : c}">${A('cy', `${f1(py)};${f1(py - h)}`, du, R() * du)}${A('cx', `${f1(px)};${f1(px + sw / 2)};${f1(px + sw)}`, du, R() * du)}${A('opacity', '0;1;1;0', du, R() * du)}</circle>`;
    }
  } else if (key === 'frost') {
    for (let i = 0; i < cnt(7); i++) {
      const [px, py] = along(.15, 1, 8), r = 6 + R() * 6, rot = R() * 360;
      over += `<g transform="translate(${f1(px)},${f1(py)}) rotate(${f1(rot)})"><path d="M0,${f1(-r * 1.9)} L${f1(r * .55)},0 L0,${f1(r * 1.2)} L${f1(-r * .55)},0 Z" fill="#e6fbff" stroke="#3aa6cf" stroke-width="1.4" stroke-linejoin="round"/><path d="M0,${f1(-r * 1.5)} L${f1(r * .2)},0" stroke="#fff" stroke-width="1.2" fill="none">${A('opacity', '.2;1;.2', 1.4 + R(), R() * 2)}</path></g>`;
    }
    for (let i = 0; i < cnt(11); i++) {
      const [px, py] = along(0, 1, 34), du = 2 + R() * 2, r = 4.5 + R() * 3.5, dx = (R() - .5) * 40;
      const flake = `<path d="M0,${-r} L0,${r} M${f1(-r * .87)},${f1(-r / 2)} L${f1(r * .87)},${f1(r / 2)} M${f1(-r * .87)},${f1(r / 2)} L${f1(r * .87)},${f1(-r / 2)}" stroke="#f2fdff" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
      over += `<g opacity="0">${A('opacity', '0;1;1;0', du, R() * du)}<g transform="translate(${f1(px)},${f1(py)})">${AT('translate', `0,0;${f1(dx)},50`, du, 0, 'additive="sum"')}<g>${flake}${AT('rotate', '0;180', du, 0)}</g></g></g>`;
    }
    over += `<ellipse cx="${f1(tip[0])}" cy="${f1(tip[1])}" rx="26" ry="10" fill="#dff8ff" opacity=".35">${A('rx', '20;30;20', 2.4, R() * 2)}</ellipse>`;
  } else if (key === 'storm') {
    for (let i = 0; i < cnt(5); i++) {
      const t0 = R() * .5, t1 = .55 + R() * .45, p0 = lerp(a, b, t0), p1 = lerp(a, b, t1), seg = 5;
      let pts = [];
      for (let s = 0; s <= seg; s++) { const p = lerp(p0, p1, s / seg), o = (s === 0 || s === seg) ? (R() - .5) * 10 : (R() - .5) * 50; pts.push(f1(p[0] + nx * o) + ',' + f1(p[1] + ny * o)); }
      const du = .9 + R() * 1.1, on = (R() * .6).toFixed(2);
      const kt = `0;${on};${(+on + .08).toFixed(2)};1`;
      over += `<g opacity="0">${A('opacity', '0;1;0;0', du, R() * du, `calcMode="discrete" keyTimes="${kt}"`)}<polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="9" stroke-linejoin="round" opacity=".6"/><polyline points="${pts.join(' ')}" fill="none" stroke="#fffbd0" stroke-width="3.2" stroke-linejoin="round"/></g>`;
    }
    for (let i = 0; i < cnt(8); i++) {
      const [px, py] = along(0, 1, 30), du = .6 + R() * .8;
      over += `<path d="${star4(4 + R() * 4)}" transform="translate(${f1(px)},${f1(py)})" fill="#fffbd0">${A('opacity', '0;1;0', du, R() * du)}</path>`;
    }
  } else if (key === 'venom') {
    over += `<path d="M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}" stroke="${c}" stroke-width="8" stroke-linecap="round" opacity=".45"/>`;
    for (let i = 0; i < cnt(8); i++) {
      const [px, py] = along(.1, 1, 6), du = 1.3 + R() * 1, fall = 50 + R() * 40;
      over += `<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="3.8" ry="5.2" fill="${c}" stroke="#3f6f1f" stroke-width="1.2">${A('cy', `${f1(py)};${f1(py + 4)};${f1(py + fall)}`, du, R() * du, 'keyTimes="0;.4;1"')}${A('opacity', '0;1;1;0', du, R() * du)}</ellipse>`;
    }
    for (let i = 0; i < cnt(10); i++) {
      const [px, py] = along(0, 1, 26), du = 1.5 + R() * 1.4, r = 3.4 + R() * 4;
      over += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(r)}" fill="${c}" fill-opacity=".25" stroke="#c6ff8a" stroke-width="1.4">${A('cy', `${f1(py)};${f1(py - 30 - R() * 20)}`, du, R() * du)}${A('r', `${f1(r * .4)};${f1(r)};${f1(r * 1.3)}`, du, R() * du)}${A('opacity', '0;1;0', du, R() * du)}</circle>`;
    }
  } else if (key === 'radiant') {
    let rays = '';
    for (let i = 0; i < 12; i++) { const an = i * Math.PI / 6, r0 = 14, r1 = i % 2 ? 46 : 70 + 8 * n; rays += `<path d="M${f1(Math.cos(an) * r0)},${f1(Math.sin(an) * r0)} L${f1(Math.cos(an) * r1)},${f1(Math.sin(an) * r1)}" stroke="#fff1b0" stroke-width="${i % 2 ? 2 : 3.4}" stroke-linecap="round"/>`; }
    over += `<g transform="translate(${f1(tip[0])},${f1(tip[1])})" opacity=".6" style="mix-blend-mode:screen"><g>${rays}${AT('rotate', '0;360', 14, 0)}</g></g>`;
    for (let i = 0; i < cnt(11); i++) {
      const [px, py] = along(0, 1, 36), du = 1 + R() * 1.2;
      over += `<g transform="translate(${f1(px)},${f1(py)})"><path d="${star4(6 + R() * 6)}" fill="${R() < .5 ? '#fff' : c}" stroke="#c9902a" stroke-width="1">${AT('scale', '0;1;0', du, R() * du)}</path></g>`;
    }
  } else if (key === 'void') {
    under += `<circle cx="${f1(tip[0])}" cy="${f1(tip[1])}" r="${16 + 3 * n}" fill="#1a0b2e" stroke="${c}" stroke-width="3">${A('r', `${14 + 3 * n};${19 + 3 * n};${14 + 3 * n}`, 1.8, 0)}</circle>`;
    for (let i = 0; i < cnt(5); i++) {
      const r = 26 + R() * 22, s0 = R() * 360, ln = 70 + R() * 90, du = 1.6 + R() * 1.6, dir = R() < .5 ? '0' : '360', end = dir === '0' ? '360' : '0';
      const an = ln * Math.PI / 180;
      over += `<g transform="translate(${f1(tip[0])},${f1(tip[1])})"><g transform="rotate(${f1(s0)})"><path d="M${f1(r)},0 A${f1(r)},${f1(r)} 0 0 1 ${f1(r * Math.cos(an))},${f1(r * Math.sin(an))}" fill="none" stroke="${i % 2 ? '#d3a8ff' : c}" stroke-width="${f1(3 + R() * 3)}" stroke-linecap="round">${AT('rotate', `${dir};${end}`, du, 0)}</path></g></g>`;
    }
    for (let i = 0; i < cnt(12); i++) {
      const an = R() * Math.PI * 2, d0 = 55 + R() * 35, du = 1 + R() * 1, sx = tip[0] + Math.cos(an) * d0, sy = tip[1] + Math.sin(an) * d0;
      over += `<circle r="${f1(2.4 + R() * 2.2)}" fill="${R() < .5 ? '#d3a8ff' : '#3a1466'}">${A('cx', `${f1(sx)};${f1(tip[0])}`, du, R() * du)}${A('cy', `${f1(sy)};${f1(tip[1])}`, du, R() * du)}${A('opacity', '0;1;0', du, R() * du)}</circle>`;
    }
  } else if (key === 'tide') {
    // two counter-phased currents wind along the weapon
    for (let w = 0; w < 2; w++) {
      let d = '';
      for (let s = 0; s <= 24; s++) { const p = lerp(a, b, s / 24), o = Math.sin(s / 24 * Math.PI * 3 + w * Math.PI) * (12 + 2 * n); d += (s ? ' L' : 'M') + f1(p[0] + nx * o) + ',' + f1(p[1] + ny * o); }
      over += `<path d="${d}" fill="none" stroke="${w ? '#e8f8ff' : c}" stroke-width="${w ? 3 : 6.5}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${f1(len * .32)} ${f1(len * .22)}">${A('stroke-dashoffset', `0;${f1(-len * .54)}`, 1.1 + w * .3, 0)}</path>`;
    }
    for (let i = 0; i < cnt(7); i++) {
      const [px, py] = along(.2, 1, 10), du = 1.2 + R() * .8, dx = (R() - .5) * 50, s = .8 + R() * .7;
      over += `<g opacity="0">${A('opacity', '0;1;1;0', du, R() * du)}<g transform="translate(${f1(px)},${f1(py)})">${AT('translate', `0,0;${f1(dx / 2)},-14;${f1(dx)},60`, du, R() * du, 'additive="sum"')}<path d="M0,-7 C5,0 6,4 0,8 C-6,4 -5,0 0,-7 Z" transform="scale(${f1(s)})" fill="#bfeaff" stroke="#1f6f9f" stroke-width="1.4"/></g></g>`;
    }
    for (let i = 0; i < cnt(9); i++) {
      const [px, py] = along(0, 1, 30), du = 1.6 + R() * 1.2, r = 3 + R() * 4;
      over += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(r)}" fill="#ffffff" fill-opacity=".15" stroke="#e8f8ff" stroke-width="1.6">${A('cy', `${f1(py)};${f1(py - 40 - R() * 30)}`, du, R() * du)}${A('opacity', '0;1;0', du, R() * du)}</circle>`;
    }
    over += `<ellipse cx="${f1(tip[0])}" cy="${f1(tip[1])}" rx="10" ry="4" fill="none" stroke="#e8f8ff" stroke-width="3">${A('rx', '8;40', 1.4, 0)}${A('ry', '3;14', 1.4, 0)}${A('opacity', '1;0', 1.4, 0)}</ellipse>`;
  } else if (key === 'quake') {
    // cracked, glowing ground under the feet and stones circling the business end
    for (let i = 0; i < 7; i++) {
      const an = Math.PI * (.05 + i * .9 / 6) * (i % 2 ? 1 : -1) + (i % 2 ? 0 : Math.PI), r = 70 + R() * 50 + 10 * n;
      let d = 'M200,' + GROUND, px = 200, py = GROUND;
      for (let s = 1; s <= 4; s++) { const t = s / 4; px = 200 + Math.cos(an) * r * t + (R() - .5) * 16; py = GROUND + Math.sin(an) * r * t * .22 + (R() - .5) * 5; d += ` L${f1(px)},${f1(py)}`; }
      under += `<path d="${d}" fill="none" stroke="#3b2414" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#ffc46a" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">${A('opacity', '.4;1;.4', 1.4 + R(), R() * 2)}</path>`;
    }
    under += `<ellipse cx="200" cy="${GROUND}" rx="120" ry="18" fill="${glowDef(x.defs, x.pfx, '#ff9a3a')}" opacity=".55"/>`;
    for (let i = 0; i < cnt(5); i++) {
      const r = 34 + R() * 12, du = 2.4 + R(), rk = 6 + R() * 5;
      let pts = []; for (let v = 0; v < 6; v++) { const q = v * Math.PI / 3 + R() * .5, rr = rk * (.75 + R() * .4); pts.push(f1(Math.cos(q) * rr) + ',' + f1(Math.sin(q) * rr)); }
      const orbit = `M${f1(tip[0] - r)},${f1(tip[1])} a${f1(r)},${f1(r * .45)} 0 1 0 ${f1(2 * r)},0 a${f1(r)},${f1(r * .45)} 0 1 0 ${f1(-2 * r)},0`;
      over += `<polygon points="${pts.join(' ')}" fill="${R() < .5 ? '#a87a4a' : '#8a6038'}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"><animateMotion dur="${f1(du)}s" begin="${f1(-i * du / cnt(5))}s" repeatCount="indefinite" path="${orbit}"/></polygon>`;
    }
    for (let i = 0; i < cnt(6); i++) {
      const [px, py] = along(.4, 1, 12), du = 1.4 + R(), r = 8 + R() * 8;
      over += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(r)}" fill="#e8c89a" opacity="0">${A('r', `${f1(r * .4)};${f1(r * 1.6)}`, du, R() * du)}${A('opacity', '0;.7;0', du, R() * du)}</circle>`;
    }
    for (let i = 0; i < cnt(6); i++) {
      const [px, py] = along(.2, 1, 10), du = .9 + R() * .6, fall = 60 + R() * 50;
      over += `<rect x="${f1(px)}" y="${f1(py)}" width="5" height="5" rx="1" fill="#8a6038" stroke="${LINE}" stroke-width="1">${A('y', `${f1(py)};${f1(py + fall)}`, du, R() * du)}${A('opacity', '1;1;0', du, R() * du)}</rect>`;
    }
  }
  return { under, over };
}

// ------------------------------------------------------------ armour auras
function auraFx(x, key, n, view) {
  const R = x.rnd, c = AURAS[key].color, cnt = v => Math.round(v * n);
  let under = '', over = '';
  const CX = 200, MID = 322;
  const halves = (inner, cy) => { // ring drawn in squashed space; back half under, front half over
    const idB = x.pfx + 'hb' + (FXID++), idF = x.pfx + 'hf' + (FXID++);
    x.defs[idB] = `<clipPath id="${idB}"><rect x="-100" y="-100" width="600" height="${cy + 100}"/></clipPath>`;
    x.defs[idF] = `<clipPath id="${idF}"><rect x="-100" y="${cy}" width="600" height="800"/></clipPath>`;
    under += `<g clip-path="url(#${idB})" opacity=".75">${inner}</g>`;
    over += `<g clip-path="url(#${idF})">${inner}</g>`;
  };
  if (key === 'bulwark') {
    const pid = x.pfx + 'hex';
    x.defs[pid] = `<pattern id="${pid}" width="24" height="41.6" patternUnits="userSpaceOnUse"><path d="M12,0 L24,6.9 L24,20.8 L12,27.7 L0,20.8 L0,6.9 Z M12,27.7 L12,41.6 M0,6.9 L-12,0 M24,6.9 L36,0" fill="none" stroke="${c}" stroke-width="1.6"/></pattern>`;
    const gid = x.pfx + 'shim';
    x.defs[gid] = `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    const cid = x.pfx + 'bub';
    x.defs[cid] = `<clipPath id="${cid}"><ellipse cx="${CX}" cy="${MID}" rx="170" ry="190"/></clipPath>`;
    under += `<ellipse cx="${CX}" cy="${MID}" rx="170" ry="190" fill="${glowDef(x.defs, x.pfx, c)}" opacity=".35">${A('opacity', '.25;.45;.25', 2.6, 0)}</ellipse>`;
    over += `<g clip-path="url(#${cid})"><rect x="20" y="110" width="360" height="440" fill="url(#${pid})" opacity=".22">${A('opacity', `.1;${.18 + .06 * n};.1`, 2.6, 0)}</rect><rect x="20" y="0" width="360" height="90" fill="url(#${gid})" opacity=".5">${A('y', '40;560', 3.2 - .4 * n, 0)}</rect></g>`;
    over += `<ellipse cx="${CX}" cy="${MID}" rx="170" ry="190" fill="none" stroke="${c}" stroke-width="${f1(2 + n)}" opacity=".7">${A('opacity', '.45;.85;.45', 2.6, 0)}</ellipse>`;
    over += `<path d="M86,210 A150,180 0 0 1 150,150" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;
  } else if (key === 'zephyr') {
    for (let i = 0; i < cnt(9); i++) {
      const y = 190 + R() * 300, w = 130 + R() * 60, bend = 16 + R() * 22, du = 1.1 + R() * 1, dash = 40 + R() * 50;
      const d = `M${CX - w},${f1(y)} Q${CX},${f1(y + bend)} ${CX + w},${f1(y)}`;
      const s = `<path d="${d}" fill="none" stroke="${i % 2 ? '#ffffff' : c}" stroke-width="${f1(3.5 + R() * 3)}" stroke-linecap="round" stroke-dasharray="${f1(dash)} 420">${A('stroke-dashoffset', `${f1(dash)};${f1(-420)}`, du, R() * du)}</path>`;
      if (i % 2 || y < 400) under += `<g opacity=".8">${s}</g>`; else over += s;
    }
    for (let i = 0; i < cnt(6); i++) {
      const y = 400 + R() * 90, du = 2 + R() * 1.6, col = R() < .5 ? '#9fe0a0' : '#e0f0a0';
      over += `<g opacity="0">${A('opacity', '0;1;1;0', du, R() * du)}<g transform="translate(40,${f1(y)})">${AT('translate', `0,0;160,-${f1(10 + R() * 20)};330,${f1(R() * 20)}`, du, R() * du, 'additive="sum"')}<g><path d="M0,-9 Q10,0 0,10 Q-10,0 0,-9 Z" fill="${col}" stroke="${LINE}" stroke-width="1.2"/>${AT('rotate', '0;360', 1.2 + R(), 0)}</g></g></g>`;
    }
    under += `<ellipse cx="${CX}" cy="${GROUND}" rx="120" ry="18" fill="${glowDef(x.defs, x.pfx, c)}" opacity=".6"/>`;
  } else if (key === 'arcane') {
    const cy = 440, r = 128, glyphs = ['M-6,-8 L6,8 M6,-8 L-6,8', 'M0,-9 L0,9 M-6,-3 L6,-3', 'M-7,7 L0,-8 L7,7 Z', 'M-6,-8 L6,-8 L-6,8 L6,8', 'M0,-8 A8,8 0 1 0 0.1,-8 M0,-8 L0,8', 'M-7,0 L7,0 M-4,-7 L4,7 M4,-7 L-4,7'];
    let ring = `<ellipse cx="0" cy="0" rx="${r}" ry="${r}" fill="none" stroke="${c}" stroke-width="8" opacity=".85"/><ellipse cx="0" cy="0" rx="${r - 16}" ry="${r - 16}" fill="none" stroke="#f0e0ff" stroke-width="2" stroke-dasharray="6 10"/>`;
    for (let i = 0; i < 10; i++) { const an = i * Math.PI / 5; ring += `<g transform="translate(${f1(Math.cos(an) * (r - 8))},${f1(Math.sin(an) * (r - 8))}) rotate(${f1(an * 180 / Math.PI + 90)}) scale(1.4,2.6)"><path d="${glyphs[i % glyphs.length]}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`; }
    halves(`<g transform="translate(${CX},${cy}) scale(1,.3)"><g>${ring}${AT('rotate', '0;360', 9 - n, 0)}</g></g>`, cy);
    for (let i = 0; i < cnt(8); i++) {
      const px = 90 + R() * 220, py = 300 + R() * 160, du = 1.6 + R() * 1.4;
      over += `<g transform="translate(${f1(px)},${f1(py)})"><path d="${star4(3 + R() * 4)}" fill="#f0e0ff">${AT('translate', '0,0;0,-50', du, R() * du)}${A('opacity', '0;1;0', du, R() * du)}</path></g>`;
    }
    under += glow(x, CX, 300, 150, c, .35, 190);
  } else if (key === 'verdant') {
    let ring = '';
    for (let i = 0; i < 14; i++) { const an = i * Math.PI / 7, lx = Math.cos(an) * 118, ly = Math.sin(an) * 118; ring += `<g transform="translate(${f1(lx)},${f1(ly)}) rotate(${f1(an * 180 / Math.PI)}) scale(1,3)"><path d="M-10,0 Q0,-6 10,0 Q0,6 -10,0 Z" fill="${i % 2 ? c : '#4fae5f'}" stroke="${LINE}" stroke-width="1"/></g>`; }
    halves(`<g transform="translate(${CX},${GROUND - 4}) scale(1,.26)"><g>${ring}${AT('rotate', '0;360', 24, 0)}</g></g>`, GROUND - 4);
    for (let i = 0; i < cnt(14); i++) {
      const px = 95 + R() * 210, py = GROUND - R() * 20, du = 2 + R() * 1.6, h = 110 + R() * 160;
      over += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(3 + R() * 3)}" fill="${R() < .6 ? '#c8ffb0' : c}">${A('cy', `${f1(py)};${f1(py - h)}`, du, R() * du)}${A('cx', `${f1(px)};${f1(px + (R() - .5) * 30)};${f1(px)}`, du, R() * du)}${A('opacity', '0;1;0', du, R() * du)}</circle>`;
    }
    for (let i = 0; i < cnt(6); i++) {
      const px = 80 + R() * 240, du = 3 + R() * 2;
      over += `<g opacity="0">${A('opacity', '0;1;1;0', du, R() * du)}<g transform="translate(${f1(px)},150)">${AT('translate', `0,0;${f1((R() - .5) * 40)},170;${f1((R() - .5) * 60)},330`, du, R() * du, 'additive="sum"')}<g><ellipse rx="9" ry="5.4" fill="#ffc6dc" stroke="#d0708f" stroke-width="1"/>${AT('rotate', '-40;40;-40', 1.4 + R(), 0)}</g></g></g>`;
    }
    under += `<ellipse cx="${CX}" cy="${GROUND}" rx="130" ry="20" fill="${glowDef(x.defs, x.pfx, c)}" opacity=".55"/>`;
  } else if (key === 'bramble') {
    let vine = '', thorns = '';
    const r = 122;
    for (let i = 0; i < 28; i++) {
      const an = i * Math.PI / 14, wob = i % 2 ? 8 : -8, px = Math.cos(an) * (r + wob), py = Math.sin(an) * (r + wob);
      vine += (i ? ' L' : 'M') + f1(px) + ',' + f1(py);
      if (i % 2 === 0) thorns += `<g transform="translate(${f1(Math.cos(an) * (r + wob))},${f1(Math.sin(an) * (r + wob))}) rotate(${f1(an * 180 / Math.PI)}) scale(1,3)"><path d="M0,-4 L14,0 L0,4 Z" fill="#c9b07a" stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
      if (i % 4 === 1) thorns += `<g transform="translate(${f1(px)},${f1(py)}) scale(1,3)"><path d="M0,0 Q8,-8 16,-2 Q8,4 0,0 Z" fill="#5f9f3f" stroke="${LINE}" stroke-width="1"/></g>`;
    }
    vine += ' Z';
    const inner = `<g transform="translate(${CX},${GROUND - 6}) scale(1,.26)"><g><path d="${vine}" fill="none" stroke="${LINE}" stroke-width="13" stroke-linejoin="round"/><path d="${vine}" fill="none" stroke="#5a8a3a" stroke-width="7" stroke-linejoin="round"/>${thorns}${AT('scale', `1;${f1(1 + .03 * n)};1`, 1.8, 0)}</g></g>`;
    halves(inner, GROUND - 6);
    for (let i = 0; i < cnt(3); i++) {
      const an = R() * Math.PI, px = CX + Math.cos(an) * 120, py = GROUND - 6 + Math.sin(an) * 32;
      over += `<g transform="translate(${f1(px)},${f1(py)})"><circle r="7" fill="#e0405a" stroke="${LINE}" stroke-width="1.6"/><path d="M-3,-1 Q0,-5 3,-1" stroke="#ff9fb0" stroke-width="1.4" fill="none"/></g>`;
    }
  } else if (key === 'shadow') {
    under += `<ellipse cx="${CX}" cy="${MID + 20}" rx="150" ry="200" fill="${glowDef(x.defs, x.pfx, '#0e0820')}" opacity=".95">${A('opacity', '.75;1;.75', 3, 0)}</ellipse>`;
    for (let i = 0; i < cnt(14); i++) {
      const px = 95 + R() * 210, py = GROUND - R() * 14, du = 1.8 + R() * 1.6, r = 16 + R() * 16;
      const puff = `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(r)}" fill="${R() < .5 ? '#2a1e40' : '#3d2a5e'}">${A('r', `${f1(r * .4)};${f1(r * 1.5)}`, du, R() * du)}${A('cy', `${f1(py)};${f1(py - 40 - R() * 30)}`, du, R() * du)}${A('opacity', '0;.85;0', du, R() * du)}</circle>`;
      if (i % 4 === 0) over += puff; else under += puff;
    }
    for (let i = 0; i < cnt(8); i++) {
      const px = 90 + R() * 220, du = 2.4 + R() * 1.6, h = 200 + R() * 140;
      under += `<path d="M${f1(px)},${GROUND} q-10,-30 0,-60 q10,-30 0,-60" fill="none" stroke="#a487e6" stroke-width="3.4" stroke-linecap="round" opacity="0">${A('opacity', '0;.8;0', du, R() * du)}${AT('translate', `0,0;0,-${f1(h * .4)}`, du, R() * du)}</path>`;
    }
  } else if (key === 'forge') {
    under += `<ellipse cx="${CX}" cy="${GROUND}" rx="150" ry="30" fill="${glowDef(x.defs, x.pfx, '#ff7a1a')}" opacity=".85">${A('opacity', '.45;.8;.45', 1.4, 0)}</ellipse>`;
    for (let i = 0; i < cnt(18); i++) {
      const sx = 110 + R() * 180, sy = GROUND - 4, dx = (R() - .5) * 140, h = 60 + R() * 110, du = .9 + R() * .8;
      over += `<g opacity="0">${A('opacity', '0;1;1;0', du, R() * du, 'keyTimes="0;.1;.7;1"')}<path d="M0,0 L-11,0" stroke="${R() < .5 ? '#ffe08a' : '#ff9a2a'}" stroke-width="3.6" stroke-linecap="round"><animateMotion dur="${f1(du)}s" begin="${f1(-R() * du)}s" repeatCount="indefinite" rotate="auto" path="M${f1(sx)},${sy} Q${f1(sx + dx / 2)},${f1(sy - h * 2)} ${f1(sx + dx)},${f1(sy - h * .2)}"/></path></g>`;
    }
    for (let i = 0; i < cnt(4); i++) {
      const px = 120 + R() * 160, du = 2 + R();
      over += `<path d="M${f1(px)},${GROUND - 10} q-6,-14 0,-28 q6,-14 0,-28" fill="none" stroke="#ffd0a0" stroke-width="2" stroke-linecap="round" opacity="0">${A('opacity', '0;.5;0', du, R() * du)}${AT('translate', '0,0;0,-80', du, R() * du)}</path>`;
    }
  } else if (key === 'phoenix') {
    // fire wings that beat slowly behind the shoulders, embers and flame tongues at the feet
    const gid = x.pfx + 'wing';
    x.defs[gid] = `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="-.4"><stop offset="0" stop-color="#fff2a8"/><stop offset=".45" stop-color="#ffab3a"/><stop offset="1" stop-color="#e8402a"/></linearGradient>`;
    const wing = `<path d="M0,0 C30,-70 100,-130 175,-120 C150,-100 140,-85 160,-66 C130,-62 118,-48 136,-28 C104,-26 92,-12 104,8 C70,4 40,14 26,34 C16,20 8,10 0,0 Z" fill="url(#${gid})" stroke="#b8361e" stroke-width="2.6" stroke-linejoin="round"/><path d="M8,-2 C50,-60 110,-100 160,-112 M10,4 C50,-30 100,-56 150,-64 M12,10 C46,-6 90,-20 128,-26 M14,16 C40,10 70,4 96,6" fill="none" stroke="#fff2a8" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
    const ws = f1(1.02 + .1 * n);
    // seen from behind, the wings grow out of the back in front of the figure
    const onBack = view === 'back' || view === 'qb' || view === 'qbL';
    for (const sx of [1, -1]) { const wg = `<g transform="translate(${200 + sx * 30},400) scale(${sx * +ws},${ws}) rotate(-22)" opacity=".95"><g>${wing}${AT('rotate', '4;-10;4', 1.6, 0)}</g></g>`; if (onBack) over += wg; else under += wg; }
    under += glow(x, 200, 360, 170, c, .35, 150);
    for (let i = 0; i < cnt(4); i++) {
      const px = 110 + R() * 180, s = .55 + R() * .5, du = .5 + R() * .4;
      over += `<g transform="translate(${f1(px)},${GROUND + 2}) scale(${f1(s)})"><g><path d="M0,2 C-8,-2 -9,-14 0,-28 C9,-14 8,-2 0,2 Z" fill="${c}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/><path d="M0,0 C-4,-3 -4,-10 0,-17 C4,-10 4,-3 0,0 Z" fill="#fff2a8"/>${AT('scale', '1 1;1.12 1.3;.92 .9;1 1', du, R() * du)}</g></g>`;
    }
    for (let i = 0; i < cnt(14); i++) {
      const px = 70 + R() * 260, py = 260 + R() * 220, du = 1.4 + R() * 1.2, h = 80 + R() * 90;
      over += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(2 + R() * 2.6)}" fill="${R() < .5 ? '#ffd36a' : c}">${A('cy', `${f1(py)};${f1(py - h)}`, du, R() * du)}${A('opacity', '0;1;0', du, R() * du)}</circle>`;
    }
    under += `<ellipse cx="${CX}" cy="${GROUND}" rx="120" ry="18" fill="${glowDef(x.defs, x.pfx, '#ff7a1a')}" opacity=".7"/>`;
  } else if (key === 'frostveil') {
    // ice crystals orbit the waist (behind on the far side, in front on the near side), snow drifts down
    const cy = 412, rx = 158, ry = 34;
    let orbiters = '';
    for (let i = 0; i < cnt(6); i++) {
      const du = 5.5, h = 9 + R() * 7, rot = (R() - .5) * 40;
      const orbit = `M${CX + rx},${cy} a${rx},${ry} 0 1 0 ${-2 * rx},0 a${rx},${ry} 0 1 0 ${2 * rx},0`;
      orbiters += `<g><path d="M0,${f1(-h * 1.6)} L${f1(h * .5)},0 L0,${f1(h)} L${f1(-h * .5)},0 Z" transform="rotate(${f1(rot)})" fill="#e6fbff" stroke="#3aa6cf" stroke-width="1.6" stroke-linejoin="round"/><path d="M0,${f1(-h * 1.2)} L${f1(h * .18)},0" stroke="#fff" stroke-width="1.4" fill="none" transform="rotate(${f1(rot)})"/><animateMotion dur="${du}s" begin="${f1(-i * du / cnt(6))}s" repeatCount="indefinite" path="${orbit}"/></g>`;
    }
    halves(`<ellipse cx="${CX}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${c}" stroke-width="2.4" stroke-dasharray="3 9" opacity=".8"/>${orbiters}`, cy);
    for (let i = 0; i < cnt(12); i++) {
      const px = 60 + R() * 280, du = 3 + R() * 2.4, r = 3 + R() * 2.6, dx = (R() - .5) * 50;
      const flake = `<path d="M0,${f1(-r)} L0,${f1(r)} M${f1(-r * .87)},${f1(-r / 2)} L${f1(r * .87)},${f1(r / 2)} M${f1(-r * .87)},${f1(r / 2)} L${f1(r * .87)},${f1(-r / 2)}" stroke="#f2fdff" stroke-width="2" stroke-linecap="round" fill="none"/>`;
      over += `<g opacity="0">${A('opacity', '0;1;1;0', du, R() * du)}<g transform="translate(${f1(px)},140)">${AT('translate', `0,0;${f1(dx)},${GROUND - 150}`, du, R() * du, 'additive="sum"')}${flake}</g></g>`;
    }
    for (let i = 0; i < 5; i++) {
      const px = 130 + i * 35 + (R() - .5) * 10, h = 14 + R() * 12;
      over += `<path d="M${f1(px - 7)},${GROUND + 8} L${f1(px)},${f1(GROUND + 8 - h)} L${f1(px + 7)},${GROUND + 8} Z" fill="#dff8ff" stroke="#3aa6cf" stroke-width="1.6" stroke-linejoin="round" opacity=".9"/>`;
    }
    under += `<ellipse cx="${CX}" cy="${GROUND}" rx="130" ry="20" fill="${glowDef(x.defs, x.pfx, c)}" opacity=".7"/>`;
  } else if (key === 'starfall') {
    // a constellation behind the head, twinkles, and shooting stars that streak past
    const pts = [[86, 120], [128, 72], [200, 52], [270, 76], [318, 132], [300, 210]];
    under += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#fff6c8" stroke-width="1.6" stroke-dasharray="4 6" opacity=".5">${A('opacity', '.25;.6;.25', 3, 0)}</polyline>`;
    for (const [px, py] of pts) under += `<g transform="translate(${px},${py})"><path d="${star4(7)}" fill="#fff6c8">${AT('scale', '.6;1.2;.6', 1.6 + R(), R() * 2)}</path></g>`;
    for (let i = 0; i < cnt(4); i++) {
      const sx = 160 + R() * 240, sy = -20 - R() * 40, dx = -(170 + R() * 80), dy = 260 + R() * 120, du = 1.6 + R() * 1.2, ang = Math.atan2(dy, dx) * 180 / Math.PI;
      under += `<g opacity="0">${A('opacity', '0;1;1;0', du, R() * du, 'keyTimes="0;.15;.7;1"')}<g transform="translate(${f1(sx)},${f1(sy)})">${AT('translate', `0,0;${f1(dx)},${f1(dy)}`, du, R() * du, 'additive="sum"')}<g transform="rotate(${f1(ang + 180)})"><path d="M0,0 L60,0" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity=".55"/><path d="M0,0 L36,0" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g><path d="${star4(10)}" fill="#fff6c8" stroke="#c9902a" stroke-width="1.2"/></g></g>`;
    }
    for (let i = 0; i < cnt(10); i++) {
      const an = R() * Math.PI * 2, rr = 150 + R() * 40, px = CX + Math.cos(an) * rr * .9, py = MID - 30 + Math.sin(an) * rr, du = 1 + R() * 1.4;
      const tw = `<g transform="translate(${f1(px)},${f1(py)})"><path d="${star4(4 + R() * 5)}" fill="${R() < .5 ? '#fff' : c}">${AT('scale', '0;1;0', du, R() * du)}</path></g>`;
      if (py > MID) over += tw; else under += tw;
    }
    under += glow(x, CX, 200, 190, '#fff1b0', .25, 170);
  }
  return { under, over };
}

// Rarity flourishes: Epic adds a ground glow, Legendary a slow rune sigil under the feet.
function tierFx(x, tier, c) {
  if (tier === 'epic') return `<ellipse cx="200" cy="${GROUND}" rx="104" ry="16" fill="none" stroke="${c}" stroke-width="3" opacity=".6">${A('rx', '96;112;96', 2.2, 0)}</ellipse>`;
  if (tier !== 'legendary') return '';
  let ticks = '';
  for (let i = 0; i < 24; i++) { const an = i * Math.PI / 12, r0 = i % 2 ? 112 : 104; ticks += `<path d="M${f1(Math.cos(an) * r0)},${f1(Math.sin(an) * r0)} L${f1(Math.cos(an) * 120)},${f1(Math.sin(an) * 120)}" stroke="${c}" stroke-width="3"/>`; }
  let starP = '';
  for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + i * 4 * Math.PI / 5; starP += (i ? 'L' : 'M') + f1(Math.cos(an) * 92) + ',' + f1(Math.sin(an) * 92); }
  return `<g transform="translate(200,${GROUND}) scale(1,.27)" opacity=".85"><g><circle r="120" fill="none" stroke="${c}" stroke-width="4"/><circle r="96" fill="none" stroke="#fff6d8" stroke-width="2"/>${ticks}<path d="${starP}Z" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>${AT('rotate', '0;360', 20, 0)}</g></g>`;
}

function fx(k, view, lite) {
  const defs = {}, pfx = 'x' + (FXID++) + '-';
  const x = { defs, pfx, rnd: rng(hash((k.infuse || '') + (k.aura || '') + view + k.weapon)) };
  let under = '', over = '', sig = '';
  const ink = k.infuse && k.infuse !== 'none' && INFUSIONS[k.infuse] && WSEG[k.weapon];
  const aura = k.aura && k.aura !== 'none' && AURAS[k.aura] && allowedAura(k.cls, k.aura);
  if (aura) {
    const t = TIERS[k.auraTier] || TIERS.rare, r = auraFx(x, k.aura, lite ? t.n * .6 : t.n, view);
    under += r.under; over += r.over; sig = tierFx(x, k.auraTier, AURAS[k.aura].color);
  }
  if (ink) {
    const t = TIERS[k.infuseTier] || TIERS.rare, s = WSEG[k.weapon];
    const r = infusionFx(x, k.infuse, lite ? t.n * .7 : t.n, mapPt(view, s[0], k), mapPt(view, s[1], k), mapPt(view, s[2], k), lite);
    under += r.under; over += r.over;
    if (!sig) sig = tierFx(x, k.infuseTier, INFUSIONS[k.infuse].color);
  }
  return { defs: Object.values(defs).join(''), under: sig + under, over };
}

// Wrap the base renderer: effects go outside the sticker-filtered group.
const baseRender = K.render;
function render(k, view, opts) {
  const svg = baseRender(k, view);
  if (opts && opts.fx === false) return svg;
  const e = fx(k, view, opts && opts.lite);
  if (!e.under && !e.over) return svg;
  return svg.replace('<defs>', '<defs>' + e.defs)
    .replace(/<g filter="url\(#[^"]+\)">/, m => `<g class="fx-under">${e.under}</g>` + m)
    .replace(/<\/svg>$/, `<g class="fx-over" style="pointer-events:none">${e.over}</g></svg>`);
}

function weaponBox(w, view = 'front', size = 170) { const s = WSEG[w]; if (!s) return null; const a = mapPt(view, s[0]), b = mapPt(view, s[1]); const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2; return [cx - size / 2, cy - size / 2, size, size].map(v => Math.round(v)).join(' '); }
Object.assign(K, { render, baseRender, weaponBox, GAME, ITEM, TIERS, INFUSIONS, AURAS, stats, bonusText, itemBonus, enchantBonus, allowedAura });
})(typeof window !== 'undefined' ? window : globalThis);
