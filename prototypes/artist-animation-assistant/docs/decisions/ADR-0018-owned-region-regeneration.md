# ADR-0018: Hard ownership and disconnected-region regeneration

Accepted for core only; part integration remains pending.

EXP-0022 domain core verified 2026-10-21 03:04 EDT; full stage remains IN PROGRESS.
229 unit tests pass in 145.451s, 322 distinct own-native checks
and98AST parses, all exit0. Full native02 has seventeen runs; domain/general03
rechecked after lazy-import correction. The other96source files are byte-identical
to full02. Exact final lineage and sources retained. Last complete structural checkpoint
remains EXP-0021; no claim that filled-part splitting or domain motion is ready.

Implemented engine/region_domains.py: raw binary ownership constraints, bounded
world/local queries, independently authored four-neighbor component seed hints,
128component cap with explicit refusal rather than dropping small details. Legacy
sorted indices and packed red-boolean-mask-1/PixelPlane metadata are validated on
load/commit. HD domains can cover the canvas; queries remain<=512square and actual
fill input<=256square. Existing224pixel output ROI/16pixel halo remains. Domain
semantics are separate from output selections, visible ink and artist paint.

Fill applies the hard domain after keep-open and clips under-ink overlap to it.
Every supplied component seed is checked; an outside/on-boundary seed refuses
instead of silently losing a piece. Only neighboring forbidden cut samples are
reported as invisible seams, not the whole exterior. Existing unconstrained
method/settings/provenance stay unchanged. Accepted legacy and packed revisions
keep domain/hints, current palette, exact protected paint/hiddenRGB/alpha0erase,
originals/other holds; additional regions inherit ownership without copying another
color region's component seeds. Inconsistent shared-ink domains refuse. Conditional
job manifests/results include exact domain primary-source IDs; dependency hashes
and region epochs reject hint edit-undo. Recompute/review/cancel contracts remain.
List-only domain/view/revision paths retain stdlib-only imports. An actual fresh
Python -S subprocess completes legacy domain regeneration without importing NumPy;
packed-mask validation imports the already cleared runtime only when needed.

Domain-native03 passes13 own Tk checks: offline current sources before processing,
controller-authored diagnostic metadata, actual native paint/erase, existing Edit
accepted boundary UI, keep-open on a cut, separate worker, both disconnected pieces,
exact Tk preview samples/alpha, explicit acceptance, original/correction retention,
undo/redo and compact reopen. No domain-creation/seed-editor UI or actual part split
is claimed. Six original evaluation rows: unrestricted fill leaks1740pixels and
fills64hole samples; single-seed domain misses716; all four component seeds recover
1332/1332 with0leak/0miss and both single-pixel diagonal details retained. Dropping
tiny components misses2; wrong ownership bridge leaks13; alpha0palette keeps all
1332managed pixels with0opaque samples. These are exact authored masks, not anatomy,
semantic prediction, generalization or artist-effort evidence. Native preview viewed.

NEXT implement actual accepted-region interval partition in raster_parts, stable
base/part/parent IDs, current palette/part-binding/donor evidence and snapshots;
preserve original regions before/after target. Wire component seeds/domains to
effective protected-excluded ownership. Then transport them through motion and add
explicit seed-repair UI. Keep current affected-fill refusal until all metadata and
pixels integrate, not just remove the guard. Boundary/palette/rebind after split
and motion, holes/tiny/empty/split-merge regions, protected corrections, local worker,
undo/reopen/cancel need end-to-end verification. Domain motion is NOT implemented.

All20requirements/full master ACTIVE, Phase5 partial, standalone selected. Actual
procedural/predictor/hybrid comparisons, automatic topology/visibility/new surfaces,
intended contour/construction/medium/overdraw/gaps, semantic reference/color tracking,
sparse/economical budgets/events/holds/easing/overshoot/smears, broader native formats,
protection release/proof-bound migration/nonzeroPaeth performance, packaging and
whole-task artist usefulness remain. No owner artwork supplied. No blocker/question.
78APA primary references/full local notices cover this increment; only existing
cleared CPU NumPy is executed. SciPy provides a cited connectivity precedent,
not an imported runtime or copied algorithm implementation.


## EXP0022 integrated checkpoint — 2026-10-21 15:29 EDT

Updated 2026-10-21 15:29 EDT. EXP-0022 paired-region integration is tested locally; Phase5 and
the full twenty-requirement master remain partial. Standalone remains selected.

Editable source/donor part cuts now partition accepted fill regions, palettes,
semantic bindings and inherited ownership across source/target/tail intervals.
Stable base/part/parent identities, source snapshots, current protected paint and
transparent erasure remain intact. Explicit domain transport follows motion;
geometric split/merge/empty/reappearance events and displaced seed review are
recorded. Motion > Edit part ownership > Edit region seeds provides canvas/numeric
seed repair, ownership shading and stale-edit guards. Applying hints is metadata
only; boundary regeneration is previewed and accepted separately. Every permitted
artist seed survives repeated ownership/motion operations, including pending points
and hints outside the local warp. Empty logical identities are retained.

Current source101AST parses. Final05 full247units passed174.262s. Final07 integrated
native22 and focused focus-lifecycle4 pass. Total distinct native regression
lineage348: historical unaffected full04 families plus affected final05 families
and final07 replacements; this is NOT348fresh executions against final source.
Only region_seeds_panel.py changed after final05; the other100files match exactly.
Verification, exact final-source/ and historical failures retained in EXP0022.
Final evaluation06:10original cases/54regenerations,0RGBA/covered-mask differences;
originals, input state, duration and source keys stay exact. Authored masks and
fixtures do not prove semantic inference, generalization or artist time savings.

Shutdown's Escape failure reproduced with no focus after close. Direct activation
alone also failed after queued events. Declaring the editor transient for its part
owner plus restoring focus on active close fixes immediate and settled behavior.
Background close preserves other work; closed owner/repeated close are safe.
Both official Tk focus/wm sources registered before their respective trials;
80APA references/full notices, existing cleared Python/Tk/CPU NumPy only.

Still unsupported: explicit region rebind after retiming/motion-split target or a
new region set; unsupported operations refuse rather than discard metadata.
Boundary regeneration above224px ROI needs future rebind support. Hard ownership
does not infer anatomy or feather seams; donor content comes from approved keys.
Native tests exercise own Tk widgets/events/images and separate workers, not OS
desktop/tablet/screen-reader/external editor or representative artist acceptance.

NEXT actual procedural/predictor/hybrid correspondence/visibility comparison on
the same original sequences, retaining quarter-turn false-clear, wrong ownership,
missing donor, occluded hand and new surface failures. Research/register primary
methods and all exact artifact/runtime/weight/data rights before execution. A
blocked optional checkpoint does not block an independent permitted experiment.
Then sparse event/budget schedules and stylized trajectories/easing/smears remain.
Intended contours/construction/medium/overdraw, semantic reference/color tracking,
broader native formats, protection release/proof-bound migration/nonzeroPaeth
performance, packaging/accessibility and whole-artist-task usefulness stay open.
No owner art benchmark/training consent, paid compute or public deployment.
