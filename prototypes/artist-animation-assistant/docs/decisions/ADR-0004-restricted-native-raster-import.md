# ADR-0004 — Restricted independent native raster import

Date 2026-10-20 21:46 EDT. Status implemented for documented subset, wider fidelity unresolved.

The standalone route must offer useful native input without repeated owner-operated
Krita checks. Retained actual synthetic KRA includes separately compressed paint
layers and a hidden group. Read exact0619060tile framing/channel-plane/LZF grammar,
BGRA8 traits, native timing serialization and W3C source-over references; registered
APA sources before execution. Implemented independent bounded reader and renderer.
No upstream implementation copied; no claim of novel compression/compositing.

Accept version2BGRA8 raw/LZF tiles, exact tested sRGB profile, normal isolated groups,
bounded canvases/archives/drawings, zero defaults. Reject unsupported masks/blends/
profiles/group transforms/attributes/off-canvas nontransparent content. Preserve full
native bytes/hash and metadata as an explicit alternative alongside editable pixels,
UUID-linked layers and clip-relative exposures. JSON schema remains0.1 with explicit
optional native_source and layer metadata; unsupported consumers reject rather than
silently dropping richer structure. A future migration may replace grid serialization.

Actual original8x8KRA: both layers equal original ORA pixels, projection equals saved
native mergedimage, hidden group/parentage preserved, edit/undo/redo/save/reopen exact
for current project and archive. Modeled animation XML with genuine tile data tests
keys0/4 and4/8holds only; real native animated fidelity remains unresolved. Normal
compositing is source-over defined by renderer, not an all-mode native color match.

New Layers tab selects raster children, toggles visibility/locks and avoids active
hidden-group painting. UI rejects redirected strokes when revision/layer/drawing
changes. Entire original archive remains available; accepted edits create revisions.
No native .kra serializer exists; next layer export is explicitly separate work.

Reopen for profile/structure/scale needs, real animation or native projection mismatch,
latency/resource findings and final distribution/license review. No purchase or host
launch required to continue these experiments. Full artist-assistance goal stays active.
