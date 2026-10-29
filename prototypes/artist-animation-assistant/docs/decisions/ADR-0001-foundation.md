# ADR-0001 — Portable foundation and provisional Krita host

Status: accepted as a reversible engineering choice, 2026-10-20.
Requirements: REQ-01–REQ-20 remain in scope; immediate REQ-11/12/13/18.

Context: Only the owner-provided spec exists. Installed Python 3.13.1 and Krita
5.3.2.1 are available. Native app control is disabled. No artist fixtures exist.

Options: embed everything inside Krita; immediately build a standalone editor;
or separate an engine model from a provisional Krita adapter and a small credits
shell. Choose the third. The shell does not replace the final editing application.

Evidence: REF-KRITA-API, REF-KRITA-NODE, REF-KRITA-PLUGIN and REF-KRITA-LICENSE.
The API documents uniform-step import and annotations; only a native save/reopen
test can establish installed-version fidelity. Distributed plugins require GPL;
no plugin/binary distribution is being performed and final project terms are open.

Decision: stdlib Python for the original model and credits build; JSON schema 0.1;
top-left integer coordinates, straight-alpha sRGB RGBA8 diagnostic grids; stable
drawing IDs separate from layer display labels and exposure timing. Preserve
source snapshot, reject stale acceptance, retain rejected proposals. Engine
functions return copies. No GUI object appears in engine imports.

Credits: canonical sources/components/uses/experiment records generate all views;
permission and use states remain separate; candidate and historical entries remain
searchable. No components are approved for binary redistribution by this stage.

Tradeoffs: grid data is a tiny integration format, not a production image format.
Original snapshots are preservation copies with hashes, not tamper-proof storage.
Revision-wide staleness is conservative; dependency-local invalidation, transport,
asynchronous jobs, cancel and pixel locks remain future work. No color conversion.

Reopen on native probe failure, measured grid/JSON limits, required high-bit-depth
or vector work, license/distribution choice, or owner standalone preference.
Migration: preserve old project snapshots; explicitly version new representations.
