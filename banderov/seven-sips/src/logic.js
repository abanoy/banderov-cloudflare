/* Condensed Quick Match prototype. Seven days are source-backed; pacing is provisional. */
(function (scope) {
  const clamp = n => Math.max(0, Math.min(130, n));
  function score(girl, parts, day) {
    if (parts.length !== 3 || parts.some(p => !p || typeof p.tag !== 'string')) throw Error('Three blocks required');
    const taste = parts.reduce((n, p, i) => n + (girl.likes[p.tag] || 0) * (i === 1 ? 1.5 : 1), 0);
    const perfect = parts.every(p => (girl.likes[p.tag] || 0) >= 1);
    // Archived taste weights, middle emphasis and final-day multiplier; no speed bonus.
    const delta = Math.round(taste * 1.3 * (day === 7 ? 1.5 : 1)) + (perfect ? 3 : 0);
    return {taste, perfect, delta};
  }
  function create(key) { return {key, day:1, hearts:20, phase:'choose', parts:[], history:[]}; }
  function submit(state, girl, parts) {
    if (state.phase !== 'choose') throw Error('Reply already submitted');
    const result = score(girl, parts, state.day);
    // The archive protects the first exchange from losing hearts.
    const delta = state.day === 1 ? Math.max(2, result.delta) : result.delta;
    return {...state, hearts:clamp(state.hearts + delta), phase:'feedback', parts:parts.slice(),
      history:[...state.history, {day:state.day, delta, taste:result.taste, perfect:result.perfect}]};
  }
  function advance(state) {
    if (state.phase !== 'feedback') throw Error('Finish a reply first');
    if (state.hearts === 0 || state.day === 7) return {...state, phase:'ended', won:state.day === 7 && state.hearts >= 80};
    return {...state, day:state.day + 1, phase:'choose', parts:[]};
  }
  scope.SevenLogic = {score, create, submit, advance};
})(globalThis);
