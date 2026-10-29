# ADR-0007 — Local fill revision with persistent artist constraints

Date 2026-10-20 22:38 EDT. Independent project design; still bounded prototype, full goal active.

Revision uses the CURRENT accepted ink as transparent input. Never re-factor or
redraw that ink while revising a fill. Reuse the existing fill layer/region identity
and change one held exposure reference to a NEW retained drawing version. Preserve
all old pixels, source/native bytes, original snapshots, unrelated holds and layers.

Strokes persist cumulative touched-pixel constraints, including same-color touches
and transparent erasure. Recomputed fill copies those samples exactly and records
that final painted output may differ from geometric region metadata. Legacy locked
fills without spatial history protect their full raster, not an inferred subset.
Layer/ancestor locks still require explicit unlock. Release/rebind tools are future
work; do not silently drop a correction just because it is inconvenient for a fill.

Hash region, ink/fill drawings, selected exposures, relevant layer/ancestor nodes,
palette entries, canvas/shot and subject clocks. Unrelated document history/drawings
are excluded. Preserve current unrelated work when applying to a later global
revision. Session commit/undo/redo monotonically advances only changed subjects;
otherwise undo could restore identical pixels and accidentally revive a stale job.
Initial fill and translation retain conservative document-wide guards.

Result identity, settings, provenance and deterministic operation are checked before
explicit acceptance. Region/input clocks and current UI settings must still match.
No inference of semantic opening intent or artistic approval from these guards.

Evidence:84unit tests and21native revision checks; existing19fill/24general/14KRA/
12ORA checks pass. Full page child mapping/bounds at1100x760/900x680; actual own Tk
preview removes old exterior fill, keeps colored/erased constraints and unrelated
pixel; project/ORA exact, undo/redo, dependent stale after undo. Synthetic setup only;
not OS input/external editor/screen reader/representative artist acceptance.
