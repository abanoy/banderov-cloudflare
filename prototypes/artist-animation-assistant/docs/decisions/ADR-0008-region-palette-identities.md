# ADR-0008 — Shared ink and explicit region/palette identities

Date 2026-10-20 22:55 EDT. Independent project design; bounded prototype, full goal active.

Append additional fill siblings under the existing ink group; do not duplicate/hide
the ink for every seed. Accepted interiors must remain disjoint unless an explicit
future split/merge operation resolves them. Shared under-ink coverage is permitted
with existing sibling priority; preview must match accepted source-over exactly.
Record shared-coverage adjacency as a proxy, never semantic part/occlusion proof.

Store authoritative managed masks separately from displayed pixels. Palette color
identity is an explicit stable binding, never approximate pixel equality. Palette
wide recolor changes all bound regions; rebind changes one region's target entry.
Transparent color retains masks/identity for later edits. Copy artist-protected
samples exactly, including erasures; legacy whole locks remain conservative. Old
versions/source/other holds and custom names survive; generated labels may follow
rebinds. A locked affected layer/group aborts the whole proposed batch.

Palette dependencies include accepted mask/fill/region/bindings/ancestors/palettes
and subject clocks. They exclude current ink pixels because color edit does not
resegment accepted geometry. Independent ink changes therefore survive application;
changed target fills/bindings/undo remain stale. Additional region jobs include
peer topology, and geometry revision cannot silently merge accepted interiors.
Legacy managed-mask reconstruction is explicit/warned from saved region and retained
generation ink, not guessed colors. No general cross-shot tracking claim.

Complete warnings live in an offline review window; compact status summaries avoid
long multi-region warnings consuming the editor. Native01 found4px help clipping at
900x680; retained failure/preimage, replaced help block with review control and
verified all allocated controls/text at default/minimum. Final97unit/114native checks
pass,51AST parses. Synthetic cases only; cleanup/references/motion/timing/scale and
artist usefulness remain open. No upstream implementation/default swatches copied.
