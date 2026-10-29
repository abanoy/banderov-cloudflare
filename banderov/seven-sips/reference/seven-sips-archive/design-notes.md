# Seven Sips — design notes (rebuilt from Alexander's stated intent)

> Source: Alexander's own statements captured in Claude's memory. Not reverse-engineered from code.
> If this conflicts with the actual build on his computer, the build wins — ask him.

## Core
- Alexander's own web game for **CrazyGames**, a café **speed-dating** game.
- **Mobile-first** — designed to be played with mobile in mind.
- Hard size budget: **uncompressed build folder under 20.0 MB.**

## Modes
- **Quick Match** — the first and **default** mode. He feels it is **good as-is**; don't rework it
  without his say-so.
- **Expanded Mode** — a slower, more thorough mode he decided to **ship alongside** Quick Match.
  - **Greyed out until the player has won a heart** in Quick Match.
  - Each Quick Match win can be **saved into Expanded Mode** (**max 5 saves**); you then continue
    with that girl for **3 more weeks (a month in all)**.

## Expanded Mode ideas he was weighing (UNDECIDED — "something to think about")
Do not treat these as locked features; confirm before building:
- A **cubicle desk-job minigame** for money, with a **clock** that can make you miss meetups.
- **Her texts**, with **per-girl preferences** on how often you should reply.
- **Meetups and shopping that cost money**; read her **expression** to guess what she wants.
- Girls you **dissed in Quick Match reappearing**.
- A **phone chatroom** with other girls where **cheating has consequences** (a "two-hares" ending).

## Education angle
- He sees the **office minigame as an education opportunity**: teaching players to **spot email / SMS
  phishing** (real-world anti-phishing examples).

## Status (early Oct 2026)
- Decided to **ship with Expanded Mode included**. Beyond that, see the live status in the master
  handoff `LLM.md` (§2d) and memory `/areas/seven-sips.md`.
