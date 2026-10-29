// ---------------------------------------------------------------------------
// Seven Sips: the game flow.
// Days 1-6 are café speed dates; day 7 is the date (or the drama).
// ---------------------------------------------------------------------------
let THRESH = 100;            // hearts needed for her to ask you out after day 6
const THRESH_FIRST = 80;     // beginner's luck: on your very first week the line sits lower
const WIN_AT = 100;         // hearts needed at the end of the day-7 date
const MAXH = 130;
const SLOT_TIME = [5.2, 4.6, 4.1, 3.7, 3.4, 3.1];
const DATE_SLOT_TIME = 3.2;
const DATES_PER_DAY = 3, EXCHANGES = 3, MIN_DATES = 3;
const HAIR = {
  "The Unimpressed": ["#3a3036", false], "The Waitress": ["#e9d27a", true], "The Scientist": ["#1f1d24", false],
  "Maria": ["#232838", false], "The Doll": ["#e8cf7a", true], "The Sunhat": ["#f0dc5a", true],
  "The Princess": ["#1f1d24", true], "The Android": ["#e0445c", false],
};
const byKey = k => GIRLS.find(g => g.key === k);
const shortName = k => k.replace(/^The /, "");

let G = null;            // run state
let SAVE = {};           // persistent: endings seen, sigma line index, tutorial flag
const BOT = window.BOT || null;   // automated playtests set this before boot
const UI = {};

// ------------------------------------------------------------ run flow
function clearStage() { $$(".girl", UI.stage).forEach(w => w._rig ? w._rig.destroy() : w.remove()); }
// Today's special: one girl per calendar day (same for everyone that day) starts 10 hearts up.
// A small reason to come back tomorrow.
function todaysSpecial() {
  const d = new Date(), n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return GIRLS[(n * 2654435761 >>> 0) % GIRLS.length].key;
}
function newRun(keep = null) {
  THRESH = SAVE.plays || BOT ? 100 : THRESH_FIRST;
  $$(".girl", UI.stage).forEach(w => w._rig !== keep && (w._rig ? w._rig.destroy() : w.remove()));
  G = { day: 1, blocked: new Set(), hearts: {}, met: {}, lineIx: {}, lines: {}, seenToday: new Set(), stats: { exchanges: 0, score: 0 } };
  GIRLS.forEach(g => { G.hearts[g.key] = 20; G.met[g.key] = 0; G.lineIx[g.key] = 0; G.lines[g.key] = [g.lines[0], ...shuffle(g.lines.slice(1))]; });
  G.special = todaysSpecial(); G.hearts[G.special] += 10;
}
// Save the week at the start of each day, so closing the tab doesn't throw the run away
function snapshot() {
  if (BOT) return;
  const lines = {};
  GIRLS.forEach(g => lines[g.key] = G.lines[g.key].map(l => g.lines.indexOf(l)));
  SAVE.run = { day: G.day, hearts: G.hearts, met: G.met, blocked: [...G.blocked], lineIx: G.lineIx, lines, stats: G.stats, best: G.best || null, thresh: THRESH, streak: G.streak || 0, nextSeats: G.nextSeats || null, crossed: G.crossed || {}, special: G.special };
  CG.save(SAVE);
}
function restore(sn) {
  newRun();
  Object.assign(G, { special: sn.special || G.special, hearts: sn.hearts, met: sn.met, blocked: new Set(sn.blocked), lineIx: sn.lineIx, stats: sn.stats, best: sn.best, streak: sn.streak, nextSeats: sn.nextSeats || null, crossed: sn.crossed || {} });
  GIRLS.forEach(g => { const ix = sn.lines[g.key]; if (ix && ix.every(i => i >= 0)) G.lines[g.key] = ix.map(i => g.lines[i]); });
  THRESH = sn.thresh || 100;
  return sn.day;
}
function nextLine(key) {
  let i = G.lineIx[key]++;
  if (i >= G.lines[key].length) { G.lines[key] = shuffle(byKey(key).lines); G.lineIx[key] = 1; i = 0; }
  return G.lines[key][i];
}
function seatsFor(day) {
  const all = GIRLS.map(g => g.key);
  if (day === 1) {                                  // nobody is blocked yet on day 1
    const p = G.prologue && G.prologue.key;
    return p ? [p, shuffle(all.filter(k => k !== p))[0]] : shuffle(all).slice(0, 2);
  }
  // the two least-met girls get the next seats
  return shuffle(all.filter(k => !G.blocked.has(k))).sort((a, b) => G.met[a] - G.met[b]).slice(0, 2);
}

async function playDate(key, dateNo) {
  const g = byKey(key);
  G.met[key]++; G.seenToday.add(key);
  // the girl from the cold open is already sitting here: keep her
  const kept = G.prologue && G.prologue.key === key && G.prologue.rig && G.prologue.rig.alive ? G.prologue.rig : null;
  if (G.prologue) G.prologue.rig = null;
  const r = kept || addGirl(key);
  setMeter(key);
  if (!kept) await enter(r);
  if (G.met[key] === 1 && !BOT) introCard(key);
  const slotT = SLOT_TIME[G.day - 1];
  for (let i = 0; i < EXCHANGES; i++) {
    const res = await exchange(r, nextLine(key), slotT);
    if (res.out) return walkOut(r);
  }
  showPanel(false);
  const h = G.hearts[key];
  if (G.met[key] === 2 && !(SAVE.secrets || {})[key]) await herSay(r, g.hint, 1.4);   // a nudge toward her secret
  else await herSay(r, pick(h >= THRESH ? VERDICT.high : h >= 40 ? VERDICT.mid : VERDICT.low), .9);
  hideHer();
  if (G.stats.dates === undefined) G.stats.dates = 0;
  if (++G.stats.dates === 1) tip("meter", 70);
  await leave(r, -1);
}

// zero hearts: she's had enough and won't sit with you again this week
async function walkOut(r) {
  const g = byKey(r.key);
  showPanel(false);
  G.blocked.add(r.key);
  // some storm out, some leave in tears
  const wk = byKey(r.key).likes.rude > 0 || Math.random() < .5 ? "anger" : "cry";
  r.emote(wk); Sound.sfx(wk);
  await herSay(r, g.walkout, 1.2);
  r.setMouth(wk === "cry" ? "cry" : "anger");          // she leaves still upset
  if (wk === "cry" && VFX.on) { const [x, y] = VFX.mouthOf(r); VFX.emit.tears(x, y, 10); }
  hideHer();
  Sound.sfx("crack");
  if (VFX.on) { const [x, y] = VFX.mouthOf(r); VFX.emit.shards(x, y - 40, 12, "#9a8ea0"); VFX.shake(10, .4); VFX.emit.dust(270, 600, 12); }
  await leave(r, 1);
  await banner("💔 Blocked", `${shortName(r.key)} won't see you again this week`, 1.4);
}
async function pickSeat() {
  // the third seat of the day is yours to choose
  const opts = GIRLS.map(g => g.key).filter(k => !G.seenToday.has(k) && !G.blocked.has(k));
  if (!opts.length) return null;
  const rows = opts.map(k => ({ label: `<span>${shortName(k)}</span><span class="h ${G.hearts[k] >= THRESH ? "hot" : ""}">${"☕".repeat(Math.min(G.met[k], MIN_DATES))} ♥ ${Math.round(G.hearts[k])}</span>`, value: k, cls: "seat" }));
  return modal(`<h2>Last seat of the day</h2><p class="blurb">Who do you want to sit with?</p>`, rows, "seats");
}

async function playDay() {
  G.seenToday = new Set();
  UI.day.textContent = `Day ${G.day} of 7`;
  // ads wait until you're into it: one break before day 3 and one before day 5 (was every day)
  if (G.day === 3 || G.day === 5) await CG.midgame();
  if (G.day > 1) await setBg(Art.cafe(G.day), BOT ? .05 : .6);
  Sound.sfx("jingle");
  await banner(`Day ${G.day}`, G.day === 1 ? "Speed dating at the café" : G.day === 6 ? "Last day to make an impression" : `${7 - G.day} days until the big date`);
  G.dayBest = null;
  const seats = G.nextSeats && G.nextSeats.every(k => !G.blocked.has(k)) ? G.nextSeats : seatsFor(G.day);   // as promised last night
  G.nextSeats = null;
  for (let d = 0; d < DATES_PER_DAY; d++) {
    const key = d < 2 ? seats[d] : await pickSeat();
    if (!key || G.blocked.has(key) || G.seenToday.has(key)) continue;
    await playDate(key, d);
  }
  // hearts cool off a little for anyone you didn't see today
  if (G.day >= 2) GIRLS.forEach(g => { if (!G.seenToday.has(g.key)) G.hearts[g.key] = Math.max(0, G.hearts[g.key] - 3); });
  setMeter(null);
  await daySummary();
}

async function daySummary() {
  const rows = GIRLS.map(g => g.key).sort((a, b) => G.hearts[b] - G.hearts[a]).map(k => {
    const h = G.hearts[k], hot = h >= THRESH && G.met[k] >= MIN_DATES;
    if (G.blocked.has(k)) return `<div class="srow out"><span class="sn">${shortName(k)}<small class="cups">blocked you</small></span><div class="m-bar"></div><span class="sh">💔</span></div>`;
    return `<div class="srow ${hot ? "hot" : ""}"><span class="sn">${shortName(k)}<small class="cups">${"☕".repeat(Math.min(G.met[k], MIN_DATES))}${"·".repeat(Math.max(0, MIN_DATES - G.met[k]))}</small></span><div class="m-bar"><div class="m-fill" style="width:${100 * h / MAXH}%"></div><div class="m-mark" style="left:${100 * THRESH / MAXH}%"></div></div><span class="sh">${hot ? "♥ " : ""}${Math.round(h)}</span></div>`;
  }).join("");
  const left = 6 - G.day;
  // tomorrow's first two seats are decided now, so the card can tease them
  if (left > 0) { G.day++; G.nextSeats = seatsFor(G.day); G.day--; }
  const best = G.dayBest ? `<div class="quote"><small>Moment of the day</small><p>"${G.dayBest.said}"</p><p class="qr"><b>${G.dayBest.who}:</b> ${G.dayBest.reply}</p></div>` : "";
  const tease = left > 0 && G.nextSeats ? `<div class="nexttry"><small>Tomorrow</small><p>${G.nextSeats.map(shortName).join(" and ")} saved you a seat.</p></div>` : "";
  await modal(`<h2>End of Day ${G.day}</h2><p class="blurb">${left > 0 ? `Past the line after at least ${MIN_DATES} dates (☕) and she'll ask you out. ${left} day${left > 1 ? "s" : ""} left.` : "Tonight, your phone decides..."}</p><div class="summary">${rows}</div>${best}${tease}`,
    [{ label: left > 0 ? "Next day" : "Check phone", value: 1, cls: "primary" }], "summary-card");
}

async function run(prologue = null, resume = null) {
  let from = 1;
  if (resume) from = restore(resume);
  else {
    newRun(prologue && prologue.rig);
    G.prologue = prologue;                       // who you already met on the title screen
    if (prologue) G.hearts[prologue.key] = clamp(G.hearts[prologue.key] + prologue.delta, 0, MAXH);
  }
  CG.gameplayStart();
  Sound.music("cafe");
  if (!prologue) await setBg(Art.cafe(Math.min(6, from)), .3);
  for (G.day = from; G.day <= 6; G.day++) { if (G.day > 1) snapshot(); await playDay(); }
  G.day = 7; snapshot();
  UI.day.textContent = "Day 7";
  const asked = GIRLS.map(g => g.key).filter(k => !G.blocked.has(k) && G.hearts[k] >= THRESH && G.met[k] >= MIN_DATES).sort((a, b) => G.hearts[b] - G.hearts[a]);
  G.asked = asked;
  if (asked.length === 0) return endLonely();
  if (asked.length === 1) {
    await invite(asked);
    return finalDate(asked[0]);
  }
  await invite(asked);
  return argument(asked[0], asked[1]);
}

async function invite(keys) {
  Sound.sfx("heartUp");
  const names = keys.map(k => `<b>${shortName(k)}</b>`).join(keys.length === 2 ? " and " : ", ");
  await modal(`<div class="phone">📱</div><h2>${keys.length > 1 ? "Uh-oh." : "Your phone buzzes..."}</h2><p class="blurb">${names} ${keys.length > 1 ? "both want" : "wants"} to meet you at the river bridge tonight.</p>`,
    [{ label: keys.length > 1 ? "...Go anyway" : "Go to the bridge", value: 1, cls: "primary" }]);
}

async function finalDate(key) {
  Sound.music("date");
  await setBg(Art.bridge("sunset"), .8);
  UI.day.textContent = "Day 7 · The date";
  G.hearts[key] = 50 + Math.min(15, Math.max(0, (G.hearts[key] - THRESH) / 2));
  const r = addGirl(key);
  setMeter(key);
  await enter(r);
  await banner("The Date", `with ${key}`, 1.2);
  return dateTalk(r);
}
// her own little beat in the middle of the date (caption, her line, effect); changes no hearts
async function dateMoment(r) {
  const m = DATE_MOMENTS[r.key]; if (!m) return;
  showPanel(false);
  const c = el("div", { class: "moment" }, UI.fx, m[0]);
  setFx(c, { o: 0, y: 12 }); anim(c, { o: 1, y: 0 }, .35, { ease: "out" });
  await Engine.wait(.9);
  r.busy = false; r.emote(m[2]); Sound.sfx(m[2]);
  if (VFX.on && MOMENT_FX[r.key]) { const [x, y] = VFX.mouthOf(r); MOMENT_FX[r.key](x, y); }
  await herSay(r, m[1], 1.4);
  await anim(c, { o: 0, y: -10 }, .3); c.remove();
}
// the four exchanges of a Day 7 date, her moment after the second, then the ending
async function dateTalk(r) {
  const g = byKey(r.key);
  const lines = [...shuffle(DATE_LINES).slice(0, 3), pick(g.finals || [g.final])];
  await heckle();
  for (let i = 0; i < lines.length; i++) {
    if (i === 2) await dateMoment(r);
    await exchange(r, lines[i], DATE_SLOT_TIME);
  }
  showPanel(false);
  if (G.hearts[r.key] >= WIN_AT) return endWin(r);
  return endBroken(r);
}

// an ex you got blocked by walks past and gets one line in
async function heckle() {
  const exes = [...G.blocked];
  if (!exes.length || Math.random() < .25) return;
  const k = pick(exes);
  const h = addGirl(k, { x: -150, s: .6, enter: -1 });
  UI.stage.prepend(h.wrap);                    // behind your date: she's in the background
  h.wrap.style.filter = "brightness(.85)";
  await enter(h);
  // an ex is either still mad or very pleased you're suffering
  const hk = pick(["anger", "smug", "pout"]);
  h.emote(hk); Sound.sfx(hk);
  await herSay(h, HECKLES[k], 1);
  hideHer();
  await leave(h, -1);
}
async function argument(a, b) {
  Sound.music("drama");
  await setBg(Art.bridge("sunset"), .8);
  UI.day.textContent = "Day 7 · Uh-oh";
  const ra = addGirl(a, { x: -120, s: .82, enter: -1 }), rb = addGirl(b, { x: 120, s: .82 });
  await Promise.all([enter(ra), enter(rb)]);
  const A = byKey(a), B = byKey(b);
  // they spot each other: a fighting-game "VS" slams in between them
  if (!BOT) {
    const vs = el("div", { class: "vs" }, UI.fx, "VS");
    setFx(vs, { s: 3, o: 0, r: -12 }); Sound.sfx("crack");
    await anim(vs, { s: 1, o: 1, r: -6 }, .22, { ease: "in" });
    if (VFX.on) { VFX.shake(12, .4); VFX.flash("#ff3b3b", .25, .35); VFX.emit.sparks(270, 360, 24, 260, "#ffd36b"); }
    anim(vs, { o: 0, s: 1.3 }, .4, { delay: .6 }).then(() => vs.remove());
  }
  // Bots (and their fixed scripts) keep the old talk-then-choose scene; players get the Yap Battle.
  let choice, power = 0;
  if (BOT) {
    const seq = [[ra, A.argue[0], "anger"], [rb, B.argue[0], "pout"], [ra, A.argue[1], "shock"], [rb, B.argue[1], "smug"], [ra, A.argue[2], "anger"], [rb, B.argue[2], "sweat"]];
    for (const [r, line, k] of seq) { Sound.sfx(k); r.emote(k); await herSay(r, line, .7); }
    hideHer();
    choice = await modal(`<h2>Well?! Choose!</h2><p class="blurb">They're both staring at you.</p>`, [
      { label: shortName(a), value: "a", cls: "primary" }, { label: shortName(b), value: "b", cls: "primary" },
      { label: "Both of you!", value: "both" }, { label: "Walk away", value: "walk" },
    ], "choice");
  } else {
    await Engine.wait(.9);
    ({ choice, power } = await yapBattle(ra, rb, A, B));
  }
  if (choice === "a" || choice === "b") {
    const keep = choice === "a" ? ra : rb, gone = choice === "a" ? rb : ra;
    gone.emote("pout"); Sound.sfx("pout");
    await herSay(gone, pick(["Hmph. Fine.", "...Your loss.", "I see how it is."]), .6);
    await leave(gone, gone === ra ? -1 : 1);
    hideHer();
    Engine.tween(fx(keep.wrap), { x: 0, s: 1 }, .5, { onUpdate: () => keep.wrap._fxApply() });
    keep.homeX = 0;
    // the drama costs you a little; a convincing win in the Yap Battle earns some of it back
    G.hearts[keep.key] = 45 + Math.min(15, Math.max(0, (G.hearts[keep.key] - THRESH) / 2)) + Math.round(power * 10);
    await Engine.wait(.5);
    return finalDateWith(keep);
  }
  if (choice === "both") return endHares(ra, rb);
  return endSigma(ra, rb);
}
async function finalDateWith(r) {
  Sound.music("date");
  setMeter(r.key);
  await banner("The Date", `with ${r.key}`, 1.2);
  return dateTalk(r);
}

// ------------------------------------------------------------ endings
const likesOf = k => Object.entries(byKey(k).likes).filter(([t, v]) => v > 0 && t !== "awkward").sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => TAGS[t].label).join(" & ");
function record(id) {
  SAVE.endings = SAVE.endings || {};
  SAVE.endings[id] = (SAVE.endings[id] || 0) + 1;
  SAVE.plays = (SAVE.plays || 0) + 1;
  delete SAVE.run;                             // the week is over: nothing to continue
  // sticker book: anything this week earned for the first time
  const have = SAVE.stickers = SAVE.stickers || {};
  G.newStickers = earnedStickers({ ending: id, stats: G.stats, blocked: G.blocked.size, secrets: Object.keys(SAVE.secrets || {}).length, endings: SAVE.endings }).filter(s => !have[s]);
  G.newStickers.forEach(s => have[s] = 1);
  CG.save(SAVE);
  G.ending = id;
  window.__lastEnding = id;
}
async function endScreen(title, sub, icon, cls) {
  CG.gameplayStop();
  hideHer(); setMeter(null); showPanel(false);
  // replay pull: how much is left to find, and one concrete thing to try next time
  const seen = SAVE.endings || {}, found = SAVE.secrets || {};
  const ENDS = [...GIRLS.map(g => "win:" + g.key), "broken", "hares", "sigma", "lonely"];
  const nSeen = ENDS.filter(e => seen[e]).length, nSec = GIRLS.filter(g => found[g.key]).length;
  const TRY = {
    broken: "Get asked out... then blow the date on purpose.",
    hares: "Get TWO girls past the line, then keep the Yap Battle dead even.",
    sigma: "Get two girls fighting over you... and don't lift a finger.",
    lonely: "Finish the week with nobody past the line.",
  };
  const have = SAVE.stickers || {}, fresh = STICKERS.filter(s => (G.newStickers || []).includes(s.id));
  const newSt = fresh.length ? `<div class="newst"><small>New sticker${fresh.length > 1 ? "s" : ""}!</small>${fresh.slice(0, 4).map(s => `<span><i>${s.icon}</i>${s.name}</span>`).join("")}</div>` : "";
  const ideas = [
    ...STICKERS.filter(s => !have[s.id] && !["first", "all", "mind"].includes(s.id)).map(s => `Sticker "${s.name}": ${s.hint}`),
    ...ENDS.filter(e => !seen[e]).map(e => e.startsWith("win:") ? `Win ${shortName(e.slice(4))}: she likes ${likesOf(e.slice(4))}.` : TRY[e]),
    ...GIRLS.filter(g => !found[g.key]).map(g => `${shortName(g.key)}'s secret: "${g.hint}"`),
  ];
  const next = ideas.length ? `<div class="nexttry"><small>Next time, try</small><p>${pick(ideas)}</p></div>` : "";
  const prog = `<div class="prog"><span>🏆 Endings <b>${nSeen}/${ENDS.length}</b></span><span>✨ Secrets <b>${nSec}/${GIRLS.length}</b></span><span>🏷️ Stickers <b>${Object.keys(have).length}/${STICKERS.length}</b></span></div>`;
  const quote = G && G.best ? `<div class="quote"><small>Line of the week</small><button class="copy" type="button">Copy</button><p>"${G.best.said}"</p><p class="qr"><b>${G.best.who}:</b> ${G.best.reply}</p></div>` : "";
  // let people share the funniest thing they said (the card is built by modal(), so wire it after)
  setTimeout(() => {
    const btn = UI.ov.querySelector(".quote .copy");
    if (!btn || !G.best) return;
    btn.onclick = async e => {
      e.stopPropagation();
      const text = `"${G.best.said}"\n${G.best.who}: ${G.best.reply}\n- Seven Sips`;
      try { await navigator.clipboard.writeText(text); btn.textContent = "Copied!"; }
      catch (err) { btn.textContent = "Can't copy"; }
      Sound.sfx("tap");
    };
  }, 0);
  const stopAmb = VFX.ambient(cls);
  const v = await modal(`<div class="end-icon">${icon}</div><h2 class="end-t">${title}</h2><p class="end-s">${sub}</p>${quote}${newSt}${prog}${next}`,
    [{ label: "Play again", value: "again", cls: "primary" }, { label: "Endings", value: "endings" }, { label: "Title", value: "title" }], "ending " + cls);
  stopAmb();
  clearStage();
  UI.curtain.className = "curtain"; UI.curtain.innerHTML = "";
  return v;                                   // main() decides where to go next
}
async function endWin(r) {
  record("win:" + r.key);
  CG.happytime();
  r.emote("smitten"); Sound.sfx("smitten");
  await herSay(r, pick(["...Yes. Yes, okay.", "I was hoping you'd say that.", "Stay a little longer?"]), 1);
  hideHer();
  await leave(r, 1);
  const [hair, long] = HAIR[r.key];
  Sound.music("ending");
  await setBg(Art.bridge("sunset", { hair, long }), 1.2);
  await Engine.wait(BOT ? .05 : 1.6);
  // the screen rolls up into a heart
  Sound.sfx("fanfare");
  if (VFX.on) { VFX.emit.petals(30); VFX.emit.confetti(50); Engine.after(.6, () => VFX.emit.burst(270, 420, 22)); }
  UI.curtain.className = "curtain heart-roll";
  UI.curtain.innerHTML = `<div class="big-heart">${Art.heart()}</div>`;
  await Engine.wait(BOT ? .05 : 1.4);
  return endScreen(ENDINGS.win.title, `${ENDINGS.win.sub}<br><small>${r.key}</small>`, Art.heart(), "win");
}
async function endBroken(r) {
  record("broken");
  r.emote("cry"); Sound.sfx("cry");
  await herSay(r, pick(["I think... I should go.", "This isn't working. Sorry.", "Goodbye."]), 1);
  hideHer();
  await leave(r, 1);
  Sound.music(null); Sound.sfx("crack");
  if (VFX.on) { VFX.emit.shards(270, 360, 22); VFX.shake(12, .5); VFX.flash("#3a2a40", .35, .5); }
  UI.curtain.className = "curtain roll-down";
  await Engine.wait(BOT ? .05 : 1);
  Sound.sfx("fail");
  return endScreen(ENDINGS.broken.title, ENDINGS.broken.sub, Art.brokenHeart, "broken");
}
async function endHares(ra, rb) {
  if (VFX.on) VFX.shake(11, .5);
  record("hares");
  ra.emote("anger"); rb.emote("anger"); Sound.sfx("anger");
  await herSay(ra, "BOTH?!", .5);
  await herSay(rb, "Unbelievable.", .5);
  hideHer();
  await Promise.all([leave(ra, -1), leave(rb, 1)]);
  Sound.music(null); Sound.sfx("fail");
  UI.curtain.className = "curtain roll-down";
  await Engine.wait(BOT ? .05 : 1);
  return endScreen(ENDINGS.hares.title, ENDINGS.hares.sub, "🐇🐇", "hares");
}
async function endSigma(ra, rb) {
  record("sigma");
  ra.emote("confused"); rb.emote("confused"); Sound.sfx("confused");
  await herSay(ra, "Wait... where are you going?", .5);
  hideHer();
  // you walk off: the whole scene recedes
  await Promise.all([anim(UI.stage, { s: .7, o: 0, y: -40 }, 1.2, { ease: "inOut" }), anim(UI.bg, { s: 1.15 }, 1.2, { ease: "inOut" })]);
  ra.destroy(); rb.destroy();
  setFx(UI.stage, { s: 1, o: 1, y: 0 }); setFx(UI.bg, { s: 1 });
  Sound.music("ending");
  const subs = ENDINGS.sigma.subs, i = (SAVE.sigmaIx || 0) % subs.length;
  SAVE.sigmaIx = i + 1; CG.save(SAVE);
  return endScreen(ENDINGS.sigma.title, subs[i], "🗿", "sigma");
}
async function endLonely() {
  record("lonely");
  Sound.music(null);
  await setBg(Art.bridge("night"), 1);
  Sound.sfx("sad");
  return endScreen(ENDINGS.lonely.title, ENDINGS.lonely.sub, "🌙", "lonely");
}

async function showEndings() {
  const seen = SAVE.endings || {};
  const tiles = [
    ...GIRLS.map(g => ({ id: "win:" + g.key, name: shortName(g.key), icon: Art.heart("#ff4f86") })),
    { id: "broken", name: "Heartbreak", icon: Art.brokenHeart }, { id: "hares", name: "Two hares", icon: "🐇" },
    { id: "sigma", name: "Walk away", icon: "🗿" }, { id: "lonely", name: "Alone", icon: "🌙" },
  ];
  const n = tiles.filter(t => seen[t.id]).length;
  const sc = Object.keys(SAVE.secrets || {}).length;
  const have = SAVE.stickers || {}, nSt = STICKERS.filter(s => have[s.id]).length;
  const stickers = `<p class="blurb sc">Stickers ${nSt}/${STICKERS.length}</p><div class="stickers">${STICKERS.map(s => `<span class="${have[s.id] ? "got" : ""}" title="${s.hint}"><i>${have[s.id] ? s.icon : "?"}</i><small>${have[s.id] ? s.name : s.hint}</small></span>`).join("")}</div>`;
  const secrets = `<div class="secrets">${GIRLS.map(g => `<span class="${(SAVE.secrets || {})[g.key] ? "got" : ""}" title="${g.key}">${(SAVE.secrets || {})[g.key] ? "✨" : "?"}<small>${shortName(g.key)}</small></span>`).join("")}</div>`;
  await modal(`<h2>Endings ${n}/${tiles.length}</h2><div class="gallery">${tiles.map(t => `<div class="tile ${seen[t.id] ? "got" : ""}"><div class="ti">${seen[t.id] ? t.icon : "?"}</div><div class="tn">${seen[t.id] ? t.name : "???"}</div></div>`).join("")}</div><p class="blurb sc">Secret combos ${sc}/${GIRLS.length}</p>${secrets}${stickers}`,
    [{ label: "Back", value: 1, cls: "primary" }], "endings-card");
}

// ------------------------------------------------------------ title screen
async function title_() {
  CG.gameplayStop();
  Sound.music("title");
  UI.day.textContent = "";
  setMeter(null); showPanel(false); hideHer(); clearStage();
  await setBg(Art.cafe(1), .3);
  // The title screen is already the game: she says one line, you answer with one tap.
  $("#game").classList.add("titling");
  const bar = el("div", { class: "titlebar" }, $("#game"),
    `<div><div class="logo-s" aria-label="Seven Sips">${[..."Seven Sips"].map((ch, i) => ch === " " ? " " : `<i style="--i:${i}">${ch}</i>`).join("")}<em>☕</em></div><div class="special">👑 Today's special: <b>${shortName(todaysSpecial())}</b></div></div><span>${SAVE.run ? `<button class="chipbtn cont">▶ Day ${SAVE.run.day}</button>` : ""}<button class="chipbtn end">🏆${SAVE.run ? "" : " Endings"}</button></span>`);
  let wantEndings = false, wantResume = false;
  // prefer openers this player hasn't seen yet (16 in all), and today's special half the time
  SAVE.seenOpens = SAVE.seenOpens || {};
  const all = GIRLS.flatMap(g => [g.key + "|1", g.key + "|2"]);
  let pool = all.filter(id => !SAVE.seenOpens[id]); if (!pool.length) pool = all;
  const sp = pool.filter(id => id.startsWith(todaysSpecial() + "|"));
  const openId = sp.length && Math.random() < .5 ? pick(sp) : pick(pool);
  SAVE.seenOpens[openId] = 1;
  const k = openId.split("|")[0], [line, answers] = (openId.endsWith("|1") ? COLD_OPENS : COLD_OPENS_2)[k];
  const r = addGirl(k, { enter: 1 });
  // the chips work from the first frame, even while she is still walking in
  const pickP = new Promise(res => {
    bar.querySelector(".chipbtn.end").onclick = () => { Sound.unlock(); Sound.sfx("tap"); wantEndings = true; res(null); };
    const cont = bar.querySelector(".chipbtn.cont");
    if (cont) cont.onclick = () => { Sound.unlock(); Sound.sfx("tap"); wantResume = true; res(null); };
    (async () => {
      await enter(r);
      if (wantEndings || wantResume) return;
      // a little hello hop while she talks (never delays the first tap)
      if (!BOT) Engine.tween(r.e, { figY: -9 }, .14, { ease: "out" }).then(() => Engine.tween(r.e, { figY: 0 }, .3, { ease: "bounce" }));
      await herSay(r, line, .1);
      if (wantEndings || wantResume) return;
      showPanel(true);
      UI.say.innerHTML = `<span class="tapme">Tap a reply ↓</span>`;
      UI.blocks.classList.add("idle");          // the answers bob gently while she waits
      // nobody tapped for a while: a hand points at the answers
      const nudge = setTimeout(() => { if (UI.blocks.classList.contains("idle")) UI.blocks.classList.add("nudge"); }, 4500);
      res(await chooseSlot(shuffle(answers.map(([text, tag, kind, reply]) => ({ text, tag, kind, reply }))), Infinity, byKey(k)));
      clearTimeout(nudge); UI.blocks.classList.remove("idle", "nudge");
    })();
  });
  const choice = await pickP;
  if (wantEndings || wantResume || !choice) {
    bar.remove(); $("#game").classList.remove("titling"); showPanel(false); hideHer(); UI.blocks.innerHTML = ""; UI.blocks.classList.remove("idle", "nudge"); UI.timer.style.visibility = "";
    await leave(r, -1);
    return wantResume ? { next: "resume" } : "endings";
  }
  Sound.unlock();
  paintSentence([null, { text: choice.text, tag: choice.tag }, null].filter(Boolean));
  UI.blocks.innerHTML = ""; UI.timer.style.visibility = "";
  UI.guyRig.talk(.8);
  // forgiving opening: whatever you say, she noticed you (the reaction carries the joke)
  const w = byKey(k).likes[choice.tag] ?? -1, delta = clamp(Math.round(w * 4), 1, 8);
  Sound.sfx(choice.kind); r.emote(choice.kind); guyReact(choice.kind, w);
  floatHearts(delta, r);
  await herSay(r, choice.reply, 1.1);
  bar.remove(); $("#game").classList.remove("titling");
  showPanel(false); hideHer();
  return { next: "play", prologue: { key: k, delta, rig: r } };
}

// The whole game is one loop. Every screen returns where to go next ("play", "again",
// "endings", "title"), so nothing nests inside a finished run (that nesting is what left
// the heart curtain stuck over the next game).
async function main(next = "title") {
  for (;;) {
    if (next && next.next === "play") next = await run(next.prologue);
    else if (next && next.next === "resume") next = SAVE.run ? await run(null, SAVE.run) : "title";
    else if (next === "play" || next === "again") next = await run();
    else if (next === "endings") { await showEndings(); next = "title"; }
    else next = await title_();
  }
}

// Saves come from localStorage / the portal's cloud: treat them as untrusted. Anything of the
// wrong shape is dropped, and a half-broken mid-week snapshot is thrown away rather than resumed.
function cleanSave(raw) {
  const obj = v => v && typeof v === "object" && !Array.isArray(v);
  const S = obj(raw) ? raw : {};
  for (const k of ["endings", "secrets", "tips", "seenOpens", "stickers"]) if (!obj(S[k])) delete S[k];
  for (const k of ["plays", "sigmaIx"]) if (!Number.isFinite(S[k]) || S[k] < 0) delete S[k];
  const r = S.run, keys = GIRLS.map(g => g.key);
  const okRun = obj(r) && Number.isInteger(r.day) && r.day >= 2 && r.day <= 7
    && obj(r.hearts) && obj(r.met) && obj(r.lineIx) && obj(r.lines) && obj(r.stats) && Array.isArray(r.blocked)
    && keys.every(k => Number.isFinite(r.hearts[k]) && Number.isInteger(r.met[k]) && r.met[k] >= 0 && Number.isInteger(r.lineIx[k]) && r.lineIx[k] >= 0
      && Array.isArray(r.lines[k]) && r.lines[k].length > 0 && r.lines[k].length <= byKey(k).lines.length && r.lines[k].every(i => Number.isInteger(i) && i >= 0 && i < byKey(k).lines.length))
    && r.blocked.every(k => keys.includes(k)) && Number.isFinite(r.stats.exchanges) && Number.isFinite(r.stats.score);
  if (!okRun) delete S.run;
  else {
    keys.forEach(k => r.hearts[k] = clamp(r.hearts[k], 0, MAXH));
    if (!Number.isFinite(r.thresh)) r.thresh = 100;
    if (!obj(r.best) || typeof r.best.said !== "string") r.best = null;
    if (!Array.isArray(r.nextSeats) || !r.nextSeats.every(k => keys.includes(k))) r.nextSeats = null;
    if (!obj(r.crossed)) r.crossed = {};
    if (!keys.includes(r.special)) delete r.special;
    r.streak = Number.isFinite(r.streak) ? r.streak : 0;
  }
  return S;
}

// ------------------------------------------------------------ boot
async function boot() {
  Engine.init($("#game"));
  await CG.init();
  CG.loadingStart();
  SAVE = cleanSave(CG.load());
  if (SAVE.music === false) Sound.setMusic(false);
  if (SAVE.sfx === false) Sound.setSfx(false);
  buildUI();
  document.addEventListener("pointerdown", () => Sound.unlock(), { once: false });
  document.addEventListener("keydown", e => { if (e.key === "Escape") UI.set.hidden ? openSettings() : UI.set.querySelector('[data-k="resume"]').click(); });
  document.addEventListener("visibilitychange", () => { Engine.paused = document.hidden || !UI.set.hidden; Sound.hideMute(document.hidden); });
  // alt-tab / clicking outside the game iframe doesn't hide the page, so the timer would keep
  // running: losing focus mid-week opens the pause card instead
  window.addEventListener("blur", () => { if (!BOT && G && !G.ending && UI.set.hidden && (UI.panel.classList.contains("up") || G.inBattle)) openSettings(); });
  // block the page scrolling / zooming under the game on mobile
  document.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", e => e.preventDefault());
  CG.loadingStop();
  if (BOT) { BOT.ready && BOT.ready(); if (BOT.speed) Engine.speed = BOT.speed; return main("play"); }
  if (!window.__noBoot) main();          // tests drive main() themselves
}
window.addEventListener("load", boot);
