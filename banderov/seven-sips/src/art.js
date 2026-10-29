// ---------------------------------------------------------------------------
// Backgrounds: layered flat "wall-art" silhouettes (café, bridge by day, bridge at
// sunset), the table the date sits behind, and small UI glyphs.
// ---------------------------------------------------------------------------
const Art = (() => {
  const svg = (w, h, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;
  const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;

  function skyline(y, color, seed, hMin, hMax, wMin = 26, wMax = 58, windows = null) {
    let x = -10, s = seed, d = "", win = "";
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    while (x < 560) {
      const w = wMin + r() * (wMax - wMin), h = hMin + r() * (hMax - hMin);
      d += `M${x.toFixed(0)} ${y} L${x.toFixed(0)} ${(y - h).toFixed(0)} L${(x + w).toFixed(0)} ${(y - h).toFixed(0)} L${(x + w).toFixed(0)} ${y} Z `;
      if (r() > .6) d += `M${(x + w * .4).toFixed(0)} ${(y - h).toFixed(0)} L${(x + w * .4).toFixed(0)} ${(y - h - 14).toFixed(0)} L${(x + w * .5).toFixed(0)} ${(y - h - 14).toFixed(0)} L${(x + w * .5).toFixed(0)} ${(y - h).toFixed(0)} Z `;
      if (windows) for (let wy = y - h + 10; wy < y - 10; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() > .55) win += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="5" height="7" fill="${windows}"/>`;
      x += w + 2;
    }
    return `<path d="${d}" fill="${color}"/>${win}`;
  }

  // Café interior, 540 x 960 (only the top ~680 is visible behind the date)
  // the light moves through the week: bright morning on day 1, golden hour on day 6
  const DAYLIGHT = [
    { sky: ["#bfe0ef", "#f6dcc4"], sun: [330, 230, "#fff4d6"], city: ["#a9c6d6", "#8fb0c4", "#7496ab"], lit: 0, glow: .16, ray: "#fff6dc" },
    { sky: ["#b4dbf2", "#f2e4cf"], sun: [312, 200, "#fff8e0"], city: ["#a6c4d6", "#8badc2", "#6f92a8"], lit: 0, glow: .14, ray: "#fff8e4" },
    { sky: ["#a8d2ef", "#f5e7cb"], sun: [282, 186, "#fffbe8"], city: ["#a2c0d4", "#88a9bf", "#6b8ea5"], lit: 0, glow: .13, ray: "#fffbea" },
    { sky: ["#a4c6e6", "#f8dcb4"], sun: [244, 214, "#fff0c8"], city: ["#a4b8cc", "#8aa0b8", "#6e86a0"], lit: .1, glow: .17, ray: "#ffefc8" },
    { sky: ["#a7b1dc", "#f7c597"], sun: [212, 262, "#ffe2a2"], city: ["#9ea3c2", "#8487aa", "#686c92"], lit: .3, glow: .22, ray: "#ffdca0", tint: ["#ff9a5a", .07] },
    { sky: ["#7c80c2", "#f59b74"], sun: [190, 318, "#ffc27a"], city: ["#8c86b2", "#6f6898", "#55507c"], lit: .55, glow: .3, ray: "#ffc08a", tint: ["#e0705a", .13] },
  ];
  function cafe(day = 1) {
    const D = DAYLIGHT[Math.max(0, Math.min(5, day - 1))];
    const rg = (id, stops, cx = .5, cy = .5, r = .5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`;
    // pendant lamp: shade with an inner glow, a bulb, a soft pool of light and a faint cone
    const lamp = (x, len) => `<path d="M${x} 0 L${x} ${len}" stroke="#4a3328" stroke-width="3"/>
      <path d="M${x - 40} ${len + 150} L${x - 26} ${len + 30} L${x + 26} ${len + 30} L${x + 40} ${len + 150} Z" fill="url(#cone)" opacity="${(.5 + D.glow).toFixed(2)}"/>
      <circle cx="${x}" cy="${len + 40}" r="150" fill="url(#lpool)" opacity="${(.55 + D.glow * 1.5).toFixed(2)}"/>
      <path d="M${x - 34} ${len + 30} Q${x - 30} ${len} ${x} ${len} Q${x + 30} ${len} ${x + 34} ${len + 30} Z" fill="url(#shade)"/>
      <path d="M${x - 20} ${len + 8} Q${x} ${len - 2} ${x + 8} ${len + 4}" stroke="#ffcf9e" stroke-width="3" fill="none" opacity=".6"/>
      <ellipse cx="${x}" cy="${len + 31}" rx="24" ry="7" fill="#fff1c9"/><ellipse cx="${x}" cy="${len + 33}" rx="12" ry="5" fill="#fff"/>`;
    const cup = (x, y, c) => `<path d="M${x} ${y} L${x + 22} ${y} L${x + 19} ${y + 22} L${x + 3} ${y + 22} Z" fill="${c}"/><path d="M${x + 22} ${y + 5} q9 0 9 7 q0 7 -10 7" stroke="${c}" stroke-width="3" fill="none"/><path d="M${x + 15} ${y + 3} L${x + 13} ${y + 19}" stroke="#000" stroke-opacity=".12" stroke-width="5"/>`;
    const jar = (x, y, c, h) => `<rect x="${x}" y="${y - h}" width="24" height="${h}" rx="5" fill="${c}"/><rect x="${x + 15}" y="${y - h + 3}" width="7" height="${h - 6}" rx="3" fill="#000" opacity=".12"/><rect x="${x + 3}" y="${y - h + 4}" width="4" height="${h - 12}" rx="2" fill="#fff" opacity=".35"/><rect x="${x - 2}" y="${y - h - 6}" width="28" height="8" rx="3" fill="#5a3d2e"/>`;
    const plant = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-6 0 C-40 -40 -30 -90 -4 -120 C-10 -80 0 -40 -6 0 Z M6 0 C30 -50 60 -60 70 -100 C40 -80 20 -50 6 0 Z M0 0 C-10 -60 -60 -70 -70 -90 C-50 -50 -20 -30 0 0 Z" fill="${c}"/><path d="M-4 0 C-34 -40 -26 -88 -4 -116 C-14 -78 -6 -40 -4 0 Z" fill="#000" opacity=".14"/><path d="M-26 0 L26 0 L20 44 L-20 44 Z" fill="#a3603e"/><path d="M8 0 L26 0 L20 44 L6 44 Z" fill="#000" opacity=".15"/></g>`;
    const shelf = (x, y) => `<rect x="${x}" y="${y + 10}" width="100" height="22" fill="url(#shelfsh)"/><rect x="${x}" y="${y}" width="100" height="10" rx="3" fill="#8f603f"/><rect x="${x}" y="${y}" width="100" height="3" rx="1.5" fill="#c08a5e"/>`;
    return svg(540, 960, `
      <defs>${lg("cw", [[0, "#9c7458"], [.12, "#b98f6f"], [.45, "#d6b18d"], [1, "#c19a76"]])}${lg("csky", [[0, D.sky[0]], [1, D.sky[1]]])}
        ${lg("ceil", [[0, "#6f4c39"], [1, "#8d6650"]])}
        ${lg("shade", [[0, "#e8875a"], [1, "#b65a35"]])}
        ${lg("wains", [[0, "#a77955"], [1, "#7e5638"]])}${lg("panel", [[0, "#9a6c48"], [1, "#835a3b"]])}
        <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".35"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></linearGradient>
        <linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${D.ray}" stop-opacity=".18"/><stop offset="1" stop-color="${D.ray}" stop-opacity="0"/></linearGradient>
        <linearGradient id="ceilshv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1408" stop-opacity=".35"/><stop offset="1" stop-color="#2a1408" stop-opacity="0"/></linearGradient>
        <linearGradient id="shelfsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1408" stop-opacity=".28"/><stop offset="1" stop-color="#2a1408" stop-opacity="0"/></linearGradient>
        <linearGradient id="sides" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1408" stop-opacity=".28"/><stop offset=".22" stop-color="#2a1408" stop-opacity="0"/><stop offset=".78" stop-color="#2a1408" stop-opacity="0"/><stop offset="1" stop-color="#2a1408" stop-opacity=".28"/></linearGradient>
        ${rg("lpool", [[0, "#ffe2a6", .45], [.4, "#ffd38a", .1], [1, "#ffd38a", 0]])}
        ${rg("bounce", [[0, D.ray, .38], [.45, D.ray, .12], [1, D.ray, 0]])}
        ${rg("sunglow", [[0, D.sun[2], .9], [.35, D.sun[2], .45], [1, D.sun[2], 0]])}
        ${rg("reveal", [[.78, "#3a2418", 0], [.95, "#3a2418", .45], [1, "#3a2418", .6]])}
      </defs>
      <rect width="540" height="960" fill="url(#cw)"/>
      <ellipse cx="270" cy="290" rx="300" ry="290" fill="url(#bounce)"/>
      <rect width="540" height="960" fill="url(#sides)"/>
      <path d="M0 0 L540 0 L540 70 L0 70 Z" fill="url(#ceil)"/>
      ${[40, 120, 200, 280, 360, 440, 520].map(x => `<rect x="${x - 3}" y="0" width="6" height="70" fill="#5e3f2f"/><rect x="${x - 3}" y="0" width="2" height="70" fill="#a57a5c" opacity=".6"/>`).join("")}
      <rect x="0" y="70" width="540" height="46" fill="url(#ceilshv)"/>
      <g>
        <rect x="120" y="120" width="300" height="300" rx="150" fill="url(#csky)"/>
        <clipPath id="cwin"><rect x="120" y="120" width="300" height="300" rx="150"/></clipPath>
        <g clip-path="url(#cwin)">
          <circle cx="${D.sun[0]}" cy="${D.sun[1]}" r="120" fill="url(#sunglow)"/>
          <circle cx="${D.sun[0]}" cy="${D.sun[1]}" r="34" fill="${D.sun[2]}"/>
          ${skyline(420, D.city[0], 7, 60, 170, 30, 60)}
          ${skyline(420, D.city[1], 23, 40, 120, 24, 48, D.lit > .2 ? "#ffe3a0" : "#dfeaf0")}
          ${skyline(420, D.city[2], 51, 20, 80, 36, 70, D.lit > 0 ? "#ffd27a" : "#f3e3b8")}
          <rect x="120" y="120" width="300" height="300" fill="url(#reveal)"/>
          <path d="M150 200 L230 140 L250 160 L170 220 Z M180 240 L270 170 L282 182 L192 252 Z" fill="#fff" opacity=".12"/>
        </g>
        <rect x="120" y="120" width="300" height="300" rx="150" fill="none" stroke="#6b4630" stroke-width="20"/>
        <rect x="120" y="120" width="300" height="300" rx="150" fill="none" stroke="#a87650" stroke-width="12"/>
        <path d="M152 186 A150 150 0 0 1 268 128" stroke="#e0b58a" stroke-width="3" fill="none" opacity=".8"/>
        <path d="M270 120 L270 420 M120 290 L420 290" stroke="#6b4630" stroke-width="10"/>
        <path d="M270 120 L270 420 M120 290 L420 290" stroke="#a87650" stroke-width="6"/>
        <rect x="104" y="414" width="332" height="14" rx="4" fill="#7e5438"/><rect x="104" y="414" width="332" height="4" rx="2" fill="#c3936a"/>
        <rect x="108" y="428" width="324" height="18" fill="url(#shelfsh)"/>
      </g>
      <text x="270" y="104" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="#3a2016" letter-spacing="3" opacity=".7">SEVEN SIPS</text>
      <text x="270" y="102" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="#f3c993" letter-spacing="3">SEVEN SIPS</text>
      <g>
        ${shelf(-10, 210)}${shelf(-10, 300)}
        ${cup(8, 188, "#efe5d6")}${cup(46, 188, "#d06a50")}${jar(14, 300, "#b8916e", 46)}${jar(50, 300, "#7fa886", 34)}
        ${shelf(450, 210)}${shelf(450, 300)}
        ${cup(462, 188, "#7f9fb4")}${cup(500, 188, "#efe5d6")}${jar(470, 300, "#d0a23e", 40)}${jar(506, 300, "#b8916e", 52)}
      </g>
      <g><rect x="446" y="348" width="96" height="120" rx="8" fill="#2a1408" opacity=".25"/>
        <rect x="440" y="340" width="96" height="120" rx="8" fill="#2f2c31"/><rect x="446" y="346" width="84" height="108" rx="5" fill="#3d3a40"/>
        <text x="488" y="370" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="15" fill="#f4e4cf">MENU</text>
        ${[388, 404, 420, 436].map(y => `<rect x="456" y="${y}" width="${30 + (y % 3) * 12}" height="4" rx="2" fill="#bdb4ab"/><rect x="514" y="${y}" width="10" height="4" rx="2" fill="#e0b24a"/>`).join("")}</g>
      <path d="M150 300 L390 300 L520 760 L40 760 Z" fill="url(#shaft)"/>
      <rect x="0" y="470" width="540" height="490" fill="url(#wains)"/>
      <rect x="0" y="470" width="540" height="14" fill="#6f4a31"/><rect x="0" y="470" width="540" height="3" fill="#c3936a"/>
      <rect x="0" y="484" width="540" height="22" fill="url(#shelfsh)"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${12 + i * 88}" y="500" width="72" height="200" rx="6" fill="url(#panel)"/><rect x="${12 + i * 88}" y="500" width="72" height="3" rx="1.5" fill="#000" opacity=".25"/><rect x="${12 + i * 88}" y="697" width="72" height="3" rx="1.5" fill="#d9a77c" opacity=".5"/>`).join("")}
      ${plant(40, 470, 1, "#5f8c6a")}${plant(505, 470, .9, "#4f7a5a")}
      ${lamp(90, 110)}${lamp(450, 110)}
      ${D.tint ? `<rect width="540" height="960" fill="${D.tint[0]}" opacity="${D.tint[1]}" style="mix-blend-mode:multiply"/>` : ""}
    `, `preserveAspectRatio="xMidYMin slice" data-mood="cafe d${day}"`);
  }

  // The table between you and her
  // the café table (540 x 210; the top edge sits 80px down so the cup can stand on it)
  function table() {
    return svg(540, 210, `
      <defs>${lg("tw", [[0, "#a8703f"], [.35, "#8a5730"], [1, "#5a361c"]])}${lg("tc", [[0, "#fbf5ec"], [1, "#d9cbb6"]])}
        <radialGradient id="tsh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2a1408" stop-opacity=".45"/><stop offset="1" stop-color="#2a1408" stop-opacity="0"/></radialGradient>
        <linearGradient id="tlip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9824f"/><stop offset=".5" stop-color="#e4b07a"/><stop offset="1" stop-color="#b9824f"/></linearGradient></defs>
      <path d="M-10 80 L550 80 L550 210 L-10 210 Z" fill="url(#tw)"/>
      ${[104, 128, 150, 176, 198].map((y, i) => `<path d="M-10 ${y} Q ${140 + i * 30} ${y - 4} 270 ${y + 2} T 550 ${y}" stroke="#3a2010" stroke-opacity=".12" stroke-width="2" fill="none"/>`).join("")}
      <path d="M-10 80 L550 80 L550 93 L-10 93 Z" fill="url(#tlip)"/>
      <path d="M-10 93 L550 93 L550 99 L-10 99 Z" fill="#2a1408" opacity=".25"/>
      <ellipse cx="420" cy="90" rx="62" ry="10" fill="url(#tsh)"/>
      <ellipse cx="97" cy="91" rx="36" ry="6" fill="url(#tsh)"/>
      <g transform="translate(380 20)">
        <ellipse cx="40" cy="68" rx="48" ry="10" fill="#d8ccba"/><ellipse cx="40" cy="66" rx="44" ry="8" fill="#efe6d8"/>
        <path d="M8 10 L72 10 L66 64 L14 64 Z" fill="url(#tc)" stroke="#2a2330" stroke-opacity=".35" stroke-width="2"/>
        <path d="M50 12 L64 12 L60 62 L48 62 Z" fill="#000" opacity=".08"/><path d="M16 14 L20 14 L22 58 L19 58 Z" fill="#fff" opacity=".7"/>
        <ellipse cx="40" cy="12" rx="32" ry="6" fill="#4a2e22"/><ellipse cx="34" cy="11" rx="12" ry="2" fill="#a77b5e" opacity=".6"/>
        <path d="M72 20 q18 0 18 14 q0 14 -20 14" stroke="#e2d6c4" stroke-width="7" fill="none"/>
      </g>
      <g transform="translate(70 62)"><rect x="0" y="0" width="54" height="30" rx="6" fill="#efe4cf"/><rect x="0" y="22" width="54" height="8" rx="4" fill="#000" opacity=".08"/><rect x="8" y="8" width="34" height="4" rx="2" fill="#b58e6b"/><rect x="8" y="16" width="24" height="4" rx="2" fill="#b58e6b"/></g>
    `, 'preserveAspectRatio="none"');
  }

  // The river bridge. mode: "day" | "sunset" | "night"
  function bridge(mode = "sunset", couple = null) {
    const P = {
      day: { sky: [[0, "#8ec9ef"], [.7, "#d9eef6"], [1, "#fbe6c8"]], sun: "#fff6d8", far: "#a8c3d6", mid: "#86a6bd", near: "#617f97", water: [[0, "#9dcbe6"], [1, "#5f93b8"]], bridge: "#4e5b72", glow: "#fff6d8" },
      sunset: { sky: [[0, "#5b4b8a"], [.45, "#e0708a"], [.8, "#f7a864"], [1, "#fbd38a"]], sun: "#ffe08a", far: "#b0708a", mid: "#86587a", near: "#5a3d62", water: [[0, "#f0a07a"], [1, "#6d4a78"]], bridge: "#3a2842", glow: "#ffe08a" },
      night: { sky: [[0, "#1b1c3a"], [1, "#46406e"]], sun: "#f4f1d8", far: "#3a3a66", mid: "#2e2d52", near: "#222042", water: [[0, "#3b3b6b"], [1, "#1a1a36"]], bridge: "#141326", glow: "#f4f1d8" },
    }[mode];
    let stars = "";
    if (mode === "night") for (let i = 0; i < 40; i++) stars += `<circle cx="${(i * 97) % 540}" cy="${(i * 53) % 380}" r="${1 + (i % 3) * .6}" fill="#fff" opacity="${.4 + (i % 4) * .15}"/>`;
    let shimmer = "";
    for (let i = 0; i < 16; i++) shimmer += `<rect x="${220 + ((i * 37) % 120) - 60}" y="${560 + i * 14}" width="${40 + (i % 5) * 18}" height="4" rx="2" fill="${P.glow}" opacity="${.5 - i * .025}"/>`;
    const railPosts = Array.from({ length: 14 }, (_, i) => `<rect x="${i * 42 - 4}" y="742" width="8" height="70" fill="${P.bridge}"/>`).join("");
    let cp = "";
    if (couple) {
      // two figures seen from behind, leaning on the rail, her hair in her own colour
      cp = `<g transform="translate(270 820)">
        <path d="M-78 -150 Q-78 -176 -54 -176 Q-30 -176 -30 -150 L-30 -118 L-22 -106 L-20 0 L-88 0 L-86 -106 L-78 -118 Z" fill="#241c2c"/>
        <rect x="-78" y="-178" width="48" height="22" rx="10" fill="${couple.guyHair || "#3a2418"}"/>
        <path d="M18 -140 Q18 -168 44 -168 Q70 -168 70 -140 L70 -110 L78 -96 L80 0 L12 0 L14 -96 L18 -110 Z" fill="#2c2032"/>
        <path d="M14 -150 Q14 -176 44 -176 Q74 -176 74 -150 L${couple.long ? "78 -60 L10 -60" : "76 -118 L12 -118"} Z" fill="${couple.hair}"/>
        <path d="M-24 -100 Q0 -112 18 -100" stroke="#241c2c" stroke-width="12" fill="none" stroke-linecap="round"/>
      </g>`;
    }
    const sunY = mode === "sunset" ? 470 : 200, sunR = mode === "sunset" ? 90 : 52;
    const rad = (id, c, a0) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a0}"/><stop offset=".4" stop-color="${c}" stop-opacity="${a0 * .35}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    // soft cloud bands, lit from below by the low sun
    const cloud = (x, y, w, c, lit) => `<g opacity="${mode === "night" ? .35 : .85}"><path d="M${x} ${y} q${w * .2} -22 ${w * .45} -8 q${w * .2} -20 ${w * .4} 0 q${w * .12} 2 ${w * .15} 10 Z" fill="${c}"/><path d="M${x + w * .08} ${y} L${x + w * .95} ${y}" stroke="${lit}" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>`;
    const C = { day: ["#ffffff", "#ffffff"], sunset: ["#c4628a", "#ffc27a"], night: ["#4a4778", "#8a86c0"] }[mode];
    // street lamps on the bridge
    const lampPost = x => `<rect x="${x - 3}" y="610" width="6" height="128" fill="${P.bridge}"/><path d="M${x - 12} 612 L${x + 12} 612 L${x + 8} 594 L${x - 8} 594 Z" fill="${P.bridge}"/>
      ${mode !== "day" ? `<circle cx="${x}" cy="604" r="70" fill="url(#lampglow)"/><circle cx="${x}" cy="604" r="6" fill="#fff4cf"/>` : `<circle cx="${x}" cy="604" r="5" fill="#d8dde6"/>`}`;
    return svg(540, 960, `
      <defs>${lg("bs" + mode, P.sky)}${lg("bw" + mode, P.water)}${rad("sunhalo" + mode, P.glow, mode === "night" ? .35 : .7)}${rad("lampglow", "#ffd98a", mode === "night" ? .75 : .45)}
        <linearGradient id="haze${mode}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.glow}" stop-opacity="0"/><stop offset=".5" stop-color="${P.glow}" stop-opacity="${mode === "night" ? .08 : .35}"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></linearGradient>
        <linearGradient id="rim${mode}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></linearGradient></defs>
      <rect width="540" height="960" fill="url(#bs${mode})"/>${stars}
      <circle cx="270" cy="${sunY}" r="${sunR * 3.2}" fill="url(#sunhalo${mode})"/>
      ${cloud(-30, 150, 260, C[0], C[1])}${cloud(330, 110, 240, C[0], C[1])}${cloud(140, 260, 200, C[0], C[1])}${cloud(380, 330, 180, C[0], C[1])}
      <circle cx="270" cy="${sunY}" r="${sunR}" fill="${P.sun}" opacity="${mode === "night" ? .9 : 1}"/>
      ${mode === "night" ? `<circle cx="252" cy="${sunY - 10}" r="${sunR * .9}" fill="url(#bs${mode})" opacity=".0"/><circle cx="256" cy="${sunY - 8}" r="10" fill="#d9d4b0" opacity=".5"/><circle cx="284" cy="${sunY + 14}" r="7" fill="#d9d4b0" opacity=".45"/>` : ""}
      <rect y="440" width="540" height="140" fill="url(#haze${mode})"/>
      ${skyline(540, P.far, 5, 40, 150, 26, 50, mode === "night" ? "#ffe9a0" : null)}
      <path d="M0 540 Q140 470 270 520 Q400 560 540 480 L540 560 L0 560 Z" fill="${P.mid}"/>
      <rect y="540" width="540" height="420" fill="url(#bw${mode})"/>${shimmer}
      <path d="M-20 700 Q270 540 560 700 L560 740 Q270 590 -20 740 Z" fill="${P.bridge}"/>
      <path d="M-20 700 Q270 540 560 700 L560 708 Q270 552 -20 708 Z" fill="url(#rim${mode})"/>
      ${lampPost(40)}${lampPost(500)}
      <rect x="-10" y="730" width="560" height="16" fill="${P.bridge}"/>${railPosts}
      <rect x="-10" y="806" width="560" height="160" fill="${P.near}"/>
      <rect x="-10" y="802" width="560" height="10" fill="${P.bridge}"/>
      ${cp}
    `, `preserveAspectRatio="xMidYMid slice" data-mood="bridge ${mode}${couple ? " couple" : ""}"`);
  }

  // small glyphs used in the UI
  const heart = (c = "#ff4f86") => `<svg viewBox="-20 -20 40 36"><path d="M0 12 C-22 -4 -14 -24 0 -12 C14 -24 22 -4 0 12 Z" fill="${c}"/></svg>`;
  const brokenHeart = `<svg viewBox="-24 -24 48 42"><path d="M-2 14 C-24 -2 -16 -24 -2 -12 L-6 -2 L2 4 L-4 12 Z" fill="#ff4f86"/><path d="M4 14 L10 4 L2 -2 L6 -12 C20 -24 28 -2 4 14 Z" fill="#ff4f86"/></svg>`;
  // the rail in front of the girl on the bridge, so she stands behind it rather than floating
  function rail() {
    // a solid stone balustrade: girls are drawn as busts, so nothing may show through below them.
    // Lit from the low sun behind the river: warm top edges, posts lit on the left, deep shade below.
    const posts = Array.from({ length: 14 }, (_, i) => `<g transform="translate(${i * 42 + 6} 30)"><rect width="22" height="96" rx="6" fill="url(#rpost)"/><rect x="2" y="4" width="4" height="86" rx="2" fill="#ffc9a0" opacity=".35"/><rect y="88" width="22" height="8" rx="4" fill="#1c1222" opacity=".5"/></g>`).join("");
    return svg(540, 230, `<defs>
        <linearGradient id="rbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f2c48"/><stop offset="1" stop-color="#1e1426"/></linearGradient>
        <linearGradient id="rpost" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a4c70"/><stop offset=".45" stop-color="#4a3553"/><stop offset="1" stop-color="#2f2138"/></linearGradient>
        <linearGradient id="rcap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0a77a"/><stop offset=".25" stop-color="#7a5680"/><stop offset="1" stop-color="#4c3656"/></linearGradient>
        <linearGradient id="rglow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd08a" stop-opacity="0"/><stop offset=".5" stop-color="#ffd08a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd08a" stop-opacity="0"/></linearGradient></defs>
      <rect x="-10" y="10" width="560" height="220" fill="url(#rbody)"/>
      <rect x="-10" y="26" width="560" height="104" fill="#160d1c" opacity=".55"/>${posts}
      <rect x="-10" y="0" width="560" height="24" rx="5" fill="url(#rcap)"/><rect x="-10" y="0" width="560" height="3" fill="url(#rglow)"/>
      <rect x="-10" y="20" width="560" height="6" fill="#1f1526"/>
      <rect x="-10" y="126" width="560" height="10" fill="#1f1526"/><rect x="-10" y="136" width="560" height="4" fill="#5a4263" opacity=".6"/>`, 'preserveAspectRatio="none"');
  }
  return { cafe, table, bridge, rail, heart, brokenHeart };
})();

window.SevenArt = Art;
