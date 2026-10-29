# ADR0019 — Optional quarter-turn evidence; do not ship the weak scorer

Status: accepted experimental option.

Context: EXP20near-hint quarter turn produced a false clear; ordinary fixed patches cannot match rotated texture. Alternatives: fixed NSSD; four rotated template hypotheses; trained logistic feature ranking; hybrid gating.

Updated 2026-10-21 15:39 EDT. Full master/all20requirements remain unfinished; standalone selected.

EXP0023 adds an optional experimental Patch orientation > Quarter turns mode in
Pose motion / correspondences > Suggest targets from images. Fixed remains the
default. Four template rotations, existing bounded search and reverse/ambiguity
checks propose reviewable targets. Candidate details show patch turns; this is
not a predicted actor rotation. A control change refuses an old result. Explicit
review/undo/reopen retains candidate evidence, originals, drawings and timing.
Legacy fixed settings and complete result objects match the preserved backend on
four original fixtures; no forced old-project/job schema migration.

Fresh full251unit tests passed in162.398s;102AST parses; affected
native16existing +8quarter-turn checks pass (24total), including both window sizes,
worker/review/stale controls/undo/cancel/save. Exact source snapshots and logs in
EXP0023/verification.json. Integrated backend reproduces the independent comparison
on all9original pairs/51source landmarks. No other native families rerun here;
EXP0022's348distinct historical/native lineage remains separately documented.

Measured quarter-turn-with-near-target-hints: fixed0/8correct with1falseclear;
quarter search8/8correct,3clear,0falseclear. Without target hints only2/8correct
and0clear: bounded search cannot infer global motion. Ordinary arm keeps8/8best
but clear suggestions fall5to3, so quarter search is optional. Repeated texture
remains ambiguous and missing texture remains unaccepted. No newly visible surface
is reconstructed. No anatomy, arbitrary angle/scale or artist-time benefit claim.

Actually trained an independent10feature L2 logistic scorer, full-batch gradient
descent1000steps, existing local CPU NumPy only.24training glyph families,8validation,
8heldout,600/200/200rows; all data/generator/weights/splits/hashes saved. Threshold.7
selected on validation only. Heldout64positives:16accepted,48missed;2false positives
among136negatives. Gradient finite-difference maximum error5.34e-12. Training.034s,
whole comparison13.021s on this machine; neither is an artist-task benchmark.
Scarf images excluded from training/selection but previously examined in EXP20,
so they are diagnostics rather than a new blind test. Learned ranking loses all
6correct palette-change matches; learned/hybrid clears none on scarf cases and
adds no useful benefit. Keep coefficients/negative result for research, DO NOT
promote this scorer into the host. Loss still declining at fixed1000step budget;
this does not prove all logistic/neural methods incapable or settle the right model.

Sources: refreshed official OpenCV4.13 template formula and inspected scikit-learn
1.9.1 binary logistic objective.81APA references/full offline notices. Only existing
cleared Python/Tk/NumPy executes; no scikit-learn/OpenCV runtime, downloaded model,
third-party dataset, owner artwork or GPU. The new scorer is linear, not a neural
network or pretrained-model reproduction. All procedural/pretrained/adapted/custom
neural routes remain eligible. Native own Tk controls/events/controller fixture,
not OS/tablet/screen-reader/external-editor or representative artist acceptance.

EXP0022 paired region/domain motion/seed repair remains verified. Fixed shutdown
Escape focus loss via correct transient ownership and active-close focus return;
background close retains focus elsewhere. All permitted artist seed hints/empty
logical region identities, protected RGBA/erase/current palettes and originals
persist across its tested ownership/motion/regeneration loop. Explicit rebind for
retimed/motion-split/new-region sets and >224pxboundary ROI remains unimplemented;
unsupported cases refuse instead of silently losing metadata.

NEXT: implement Phase6event and drawing-budget scheduling on approved keys and
existing motion proposals. Separate composited actor poses from raster asset count,
playback slots, proposals computed and holds. Preserve duration/keys/contact events;
distinguish maximum/target/preference budgets and report conflicts. Compare several
editable schedules at actual playback speed through worker/preview/explicit accept,
undo/save/reopen. Keep Phase5 automatic visibility/new surfaces/identity, learned
comparison beyond this small scorer and approved-breakdown handling open. Remaining
contour/construction/medium/overdraw, semantic reference/color tracking, trajectories,
easing/overshoot/smears, native formats/protection release/migration/Paeth speed,
packaging/accessibility and whole-artist-task usefulness stay in the full matrix.
No purchase or public deployment authorized. No actual user answer blocks next work.

Reopen when arbitrary-angle/scale, semantic/occlusion or broader artist evidence shows a better method. Old fixed requests remain interpreted exactly; optional discrete patch turns persist in new provenance. No checkpoint/weights required for the default or new geometric mode.
