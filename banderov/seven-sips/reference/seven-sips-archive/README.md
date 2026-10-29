# Seven Sips — PARTIAL archive (what exists in Claude's cloud workspace)

Archived **2026-10-06** by Claude Opus 4.8, at Alexander Banderov's request.

> ⚠️ **This is NOT the complete, shippable game.** The real Seven Sips build — the uncompressed
> `< 20 MB` folder Alexander ships to CrazyGames — lives on **his computer / CrazyGames**, not in
> Claude's cloud workspace. What's here are the working source files that happened to remain in the
> cloud scratchpad. Treat this as a code/history snapshot, not a runnable build.

## What's actually here
```
src/all.js          ~232 KB — the main Seven Sips game code (the "Art" module + game logic as one
                              bundle). It is JS, not a standalone page — it needs the game's
                              index.html wrapper (which is on his computer) to run.
src/game_before.js   ~31 KB — an earlier snapshot of the game code, kept for history.
assets/cafe.mp3     ~1.2 MB — café background music (believed to be Seven Sips' theme).
design-notes.md             — the design/spec, rebuilt from what Alexander has stated (see below).
```

## What's MISSING (and where it really lives)
- The game's `index.html` / full build folder, any sprite/image assets, the CrazyGames SDK wiring,
  and the shipped minified bundle — all on **his computer** and on **CrazyGames**.
- If you need the complete, current game, get it from him: either he zips the build folder, or (if the
  Claude desktop app is connected) Claude can pull it from his machine.

## Game facts (from Alexander, as of early Oct 2026)
See `design-notes.md`. In short: a mobile-first café "speed-dating" game. **Quick Match** is the
shipped default mode (he considers it good as-is). He decided to ship a slower **Expanded Mode**
alongside it. Target: uncompressed build folder under **20 MB**.
