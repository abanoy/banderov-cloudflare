# ADR0034 — Explicit source-bound candidate corrections

Status: implemented scoped mechanism; full master remains active.

Painting on an unapproved generated pose must not approve its unpainted surroundings.
Retain paint/erase as explicit per-layer masks and full RGBA, with versioned source
and raw-candidate bindings. Regenerate first, verify all candidate baselines, overlay
only touched pixels, and preserve protected holds in the actor drawing budget.

Use a separately saved preview editor and explicit constraints-only adoption. Keep
all source drawings/approvals/holds exact, refuse incompatible structures/lineage,
merge independent source edits and provide one commit/undo. Retain private resume
artifacts and old correction versions. UI completion never opens a window.

Changed source/request/backend needs explicit reviewed rebind; there is no automatic
new-pose propagation or whole-layer approval. Refusal preserves history but is not
completion of broader dependency-local regeneration or artist-quality requirements.
See EXP0038results/verification, including actual full9layer hidden study and398tests.
