import assert from 'node:assert/strict';
import {encodeModeratorSlowMode,encodeGuestAction} from './public/protocol.js';
const valid={type:'moderate',requestId:'slow1',action:'slowmode',intervalSeconds:1,durationSeconds:30};
assert.deepEqual(JSON.parse(encodeModeratorSlowMode(valid)),valid);assert(encodeModeratorSlowMode({...valid,intervalSeconds:0,durationSeconds:0}));assert(encodeModeratorSlowMode({...valid,intervalSeconds:30,durationSeconds:900}));
for(const patch of [{intervalSeconds:0},{intervalSeconds:31},{intervalSeconds:1.5},{intervalSeconds:'1'},{durationSeconds:0},{durationSeconds:29},{durationSeconds:901},{durationSeconds:'30'},{role:'moderator'},{action:'ban'}])assert.throws(()=>encodeModeratorSlowMode({...valid,...patch}));assert.throws(()=>encodeGuestAction(valid));console.log('14 bounded slow-mode encoder/guest separation cases passed.');
