# ADR-0005 — Editable artwork and bound assistant state

Date 2026-10-20 22:13 EDT. Engineering choice under selected standalone host; not an owner
selection of final interchange format. Status implemented for bounded prototype.

OpenRaster provides layered still artwork. Timing, immutable originals, drawing
IDs and correction locks require authoritative assistant state. Export both the
standard artwork and optional full-project extension, plus an explicit project
sidecar/timing manifest for animation. Never call ORA a standard animated format.

Unchanged extension restoration requires member hashes, project fingerprint and
semantic comparisons of canvas/DPI, layer graph/properties and exposed pixel grids.
A rehashed wrong image or DPI must still fail. Externally edited artwork raises
StaleEmbeddedProject. The user may explicitly create a new still using those
edited pixels; retain the entire original archive and do not reapply stale history.
No automatic destructive merge is inferred. All destination folders/files are new.

Normal auto/isolate groups, fractional opacity and stable tied order follow the
OpenRaster/W3C definitions. Legacy group offsets are ignored per specification;
leaf offsets are signed and offcanvas clipping warned while archive retained.
PNG codec covers common8bit/packed gray/indexed formats, not general color management.
No package/runtime or font binaries bundled. System-font attribution gap corrected
in this increment with exact installed identities and Microsoft primary sources.

Evidence: EXP-0009 verification,63unit/24general/14KRA/12ORA checks. Own-control
dialog choices stubbed; no external editor, artistic quality or broad native claim.
Larger storage/scale, masks/vectors/profiles and actual drawing-assistance methods
remain required. Do not keep polishing interchange instead of beginning assistance.
