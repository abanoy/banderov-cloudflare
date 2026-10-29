# ADR-0017: Editable part ownership and supplied content

Accepted 2026-10-21 02:39 EDT. Full master/all twenty requirements remain ACTIVE.

Motion > Edit part ownership opens a separate native mask panel. A hard ownership
mask assigns existing samples across selected actor ink/color layers to an editable
part hierarchy, with the complementary base retained. Brush/add/remove, rectangle,
source-to-content mask copy and independent approved content-key controls are visible.
Front/back/hidden changes the part group; full part pixels remain editable when
hidden. Original drawings, source/guide keys, unrelated layers/holds, raw alpha and
shot duration survive. Initial same-key binary partition recomposes the original
projection exactly in tested nested-opacity cases. Mask seams can still be wrong;
this is not automatic anatomy, feathered matting or new stroke reconstruction.

Source and content masks are separate. New content may come from a different
explicit approved key; the input IDs/hashes and event approved_key_content persist.
Content must be outside the edited interval to avoid deriving from its own output.
No unseen content is invented. The part can be moved independently using the
existing deformation backend and can pass behind retained body layers. Depth is
an artist choice, not inferred visibility. Keys at0/8 and12slot duration are exact
in original sequence tests, with split at4 and local part motion at6. Drawing asset
counts include separate ink/color/blank assets and retained versions, not pose count.

Review uses a separate local worker, explicit masks/settings/dependency identity,
deterministic recomputation, tamper/replay/cancel guards and one-action undo. Structural
preview renders the real resulting hierarchy; source comparison remains available.
Changed controls/dependent edit-undo refuse old results; unrelated layer changes
remain applicable. Source protected world samples are excluded from ownership/content
cuts, and target painted/erased RGBA survives mask revision. Depth changes with
protected target samples are inspectable but cannot be accepted until constraints
are repaired. Raw protection is not a proof of anatomical or visual continuity.

Persistent raster_parts/part_operations retain stable part IDs, actor/layer mapping,
mask assets, donor/source hashes, depth, versions and independent operation snapshots.
Originals stay unchanged. Identical pixels AND protection reuse current drawing IDs,
including depth-only reviews and unchanged donor bases; no redundant full rasters.
Each ownership mask fits256square; source/control views<=512,32layers, existing
schema limits and final-state budgets remain. Filled-region geometry is explicitly
refused pending integrated partition support; it is never silently dropped. A moved
part splits its derived interval, so later mask revision requires explicit rebind.

Eight original comparison rows retain input/project/PNG sequences0/4/6/8 and
independent cut/integer-shift/source-over oracles. Same-key partition, front/back
overlap, hidden recovery and approved donor content are exactRGBA with zero changes
outside each declared task area. The supplied donor recovers25/25 visible magenta
samples; source-only recovers0/25 despite silhouetteIoU.9965. This is observed donor
content, not prediction. A wrong face mask gives1970RGBA differences/1598changes
outside the intended arm andIoU.7366: no semantic correction is inferred. Moving the
whole actor by the same vector gives9706RGBA differences versus intended part/back,
with660ink+1804color opaque samples clipped. That comparison explicitly allows
ordinary clipping and stays a pure preview. Source keys/originals/duration remain
exact in the accepted part sequences. Visible front/back images inspected; mask seams
and anatomical quality are not accepted. No external art, held-out generalization,
learned/paper reproduction, normal-playback quality or artist effort benefit claim.

77APA sources/full notices. Registered before trials: Krita transparency masks,
Frite current complete README/group workflow, and Eurographics transient-embedding
metadata/abstract from an indexed primary-source response. Direct catalog and full
PDF were403; no full-paper/lattice/thickness-crossfade implementation claimed. Frite
code/dependencies/examples were not acquired or executed. MLS sources explicitly
mapped before sequence comparisons. Existing local NumPy2.4.1/full notices reused;
no install, model/data/art acquisition/upload, training or binary redistribution.
Runtime local use and release distribution audit remain separate. No paid compute,
public service/deployment, Krita launch, browser-policy workaround or scheduler.
