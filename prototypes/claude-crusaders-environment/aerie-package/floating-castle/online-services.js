// Online services placeholders (accounts, saved stats, leaderboards, matchmaking). Loaded by battle-stats.js.
// Integration point: the Banderov site already has an email account client, banderov/public/account/client.js:
// createEmailAccountClient().current() does GET /api/account/current (same origin, credentials 'same-origin') and returns
// {version:3, authenticated, account:{status,identityVerified,ageEligibility}, csrfToken, entitlements, checkedAt, validUntil};
// sign-in is the magic-link page /account/ (createEmailAccountClient().start(email) / complete(token)). Nothing else exists yet:
// there is no stats, leaderboard, match-report or matchmaking API for this game (the Worker relay/lobby /ws + /rooms in
// banderov/PROTOCOL.md serves another title). Until those land, every call below rejects with ServiceUnavailableError
// (code BANDEROV_SDK_NOT_INTEGRATED) so callers can show a polite placeholder. Replace each method body when its API exists;
// keep the signatures. This module makes NO network calls and touches no window/document/storage at import time.
export const SERVICE_CODE='BANDEROV_SDK_NOT_INTEGRATED';
export const SERVICE_FEATURES=Object.freeze(['account','save-stats','load-stats','leaderboard','matchmaking','report-match']);
const LABELS={account:'Banderov accounts','save-stats':'Online saving','load-stats':'Online stats',leaderboard:'Leaderboards',matchmaking:'Online matchmaking','report-match':'Match reporting'};
export class ServiceUnavailableError extends Error{
 constructor(feature='online',message){super(message||(LABELS[feature]||'Online services')+" isn't available yet.");this.name='ServiceUnavailableError';this.code=SERVICE_CODE;this.feature=feature;}}
export const isServiceUnavailable=e=>!!e&&(e instanceof ServiceUnavailableError||e.code===SERVICE_CODE);

// opts.location: a {hostname} stand-in for tests (defaults to globalThis.location, read lazily).
export function createOnlineServices(opts={}){
 const unavailable=feature=>Promise.reject(new ServiceUnavailableError(feature));
 const host=()=>{try{return String((opts.location??globalThis.location)?.hostname||'');}catch{return '';}};
 return {
  name:'banderov-placeholder',available:false,
  // Future: createEmailAccountClient().current() -> {authenticated, account}.
  async getAccount(){return unavailable('account');},
  // Future: POST a stats snapshot (battle-stats.js snapshot()) for the signed-in account, with the account csrfToken.
  async saveStats(snapshot){void snapshot;return unavailable('save-stats');},
  async loadStats(){return unavailable('load-stats');},
  // kind: 'wins' | 'kills' | 'score' ... (no API yet).
  async fetchLeaderboard(kind){void kind;return unavailable('leaderboard');},
  // opts: {teamSize, mode} (no matchmaking yet; matches are local bot battles).
  async findMatch(o){void o;return unavailable('matchmaking');},
  // summary: the battle finish summary (battle.js buildSummary).
  async reportMatch(summary){void summary;return unavailable('report-match');},
  // The account page: same origin on banderov.com and its subdomains, the public site elsewhere (file://, localhost, portals).
  accountUrl(){return /(^|\.)banderov\.com$/i.test(host())?'/account/':'https://banderov.com/account/';}};
}
