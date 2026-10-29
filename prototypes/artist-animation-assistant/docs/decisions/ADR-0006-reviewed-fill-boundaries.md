# ADR-0006 — Separate fill containment from visible ink

Date 2026-10-20 22:25 EDT. First bounded still baseline; full master remains active.

Use independently authored four-connected seed fill on an explicit invisible
barrier. Optional square closing changes the barrier, never the source ink. Default
radius0 because identical accidental/intended gaps cannot be distinguished by this
geometry. Preserve add/keep-open overrides and show warnings, including edge reach
and uncolored invisible-gap pixels. No calibrated confidence or semantic claim.

Transparent input ink remains sample-exact. Opaque white-paper input can explicitly
propose max-whiteness alpha separation from source-over equations; exact over white
does not establish the true foreground. Retain source file/snapshots and warn.

Accept into a new group with source-opacity/order and editable ink/fill. Retain
source layer hidden, its drawings/locks/history/native bytes unchanged. Other held
exposures retain their pixels; blank fill for nonselected holds. Stable palette
identity is an artist assignment, not sampled color identity. Current acceptance
is explicit; result bound to full document hash/revision and current settings.

Known incomplete interaction: after acceptance masks/settings persist but cannot
yet be reloaded/revised through a dedicated region tool. Implement dependency-local
revision and protection of artist-corrected fill before claiming complete iterative
boundary editing. Do not add opaque fills on top of corrections or discard old fills.
Future multi-seed/adjacency/color/cleanup/motion work remains fully in scope.

Evidence:74unit/19fill own-control checks,8original synthetic cases/19method trials.
Closing false-seals intentional opening and can refuse on seed near tiny hole;
threshold sensitivity and invisible gap pinhole are recorded limitations. No real
artist data/effort or model reproduction. Primary specs/interaction abstracts are
credited with exact reading scope; no copied OpenCV/Krita implementation or images.
