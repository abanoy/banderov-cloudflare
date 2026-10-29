# ADR-0016: Image evidence with explicit correspondence review

Accepted 2026-10-21 02:07 EDT. Full master remains ACTIVE.

Proposal > Pose motion / correspondences > Suggest targets from images opens
the candidate window. Source landmarks and approved source/guide images are supplied;
target coordinates are proposed by a bounded image search. No automatic source-point
or anatomical detection. Independent normalized squared difference on premultiplied
RGBA ignores hidden RGB beneath alpha zero. Only the selected actor/ancestors are
rendered, within at most 512-square context, on small or packed larger documents.
Patch radius 2..8, search radius 4..48; explicit search around source or a current
target hint, max error, alternative gap and reverse tolerance. Default radius4,
search32/error.2/gap.015/reverse2 are engineering choices, not calibrated confidence.
Up to five spatially separated alternatives per point are retained. Flat source
patches stay uninformative; explicit unmatched/disabled points are untouched.

The candidate tree shows target/error/evidence and queued review, with selected
patch boxes on the actual source/guide views. Use or Reject a selected alternative,
or Queue clear suggestions; a separate Apply reviewed matches/rejections commits
only guide metadata/history, never pixels, drawing IDs, keys or hold timing. Each
review is one undo action and persists the complete proposal/settings/alternatives,
decisions and exact source/guide drawing hashes. Rejected alternatives and replaced
manual matches are excluded only for those exact input drawings. Changed input
hashes invalidate their applicability but retain historical evidence. Capacity128
reviews per guide/64 retained operations refuses instead of deleting history.

Separate local worker and packed envelopes retain content/subject identities,
deterministic recomputation, tamper/replay/cancel and explicit review contracts.
Guide/layer/review epochs make a dependent edit then undo stale; unrelated layer
edits remain applicable. Repeated completed-job polling cannot clear pending
decisions or resurrect an already reviewed result. The current pending guide and
matching controls must still agree at application. A reviewed image target feeds
the existing editable motion backend; the source/endpoint keys and protected edits
remain under its existing guarantees. Exact project reopen and actual cancellation
are verified. No automatic acceptance, training, upload or external model execution.

Nine original cases yield 51 source landmarks and 36 downstream motion comparisons.
Translated texture finds its one target exactly; repeated identical texture is
ambiguous; absent texture is poor. Scarf arm: best candidates 8/8 within2px, five
clear; simulated clear-only review gives silhouetteIoU .95032 versus prior identity
guide .90840 and manual translation .79623, equal to the known-target rigid result.
However, rigid/image output differs at1031RGBA pixels versus825 for the unchanged
source: silhouette agreement does not prove better line/texture quality. Occluded
hand: seven visible matches within2px, four clear; the absent hand stays needs-review,
not a proven occlusion label. Palette change yields6/8 correct best targets and four
clear. A new visible patch is not reconstructed. Rotation without target hints finds
0/8 correct; with eight near-target hints it still finds0/8 and one FALSE clear.
That reviewed false match produces sampled fold/inverse failures downstream and
cannot be accepted as a pose. No threshold tuning was used to hide this negative.

Evaluation02 names the input baseline prior-guide because existing target hints
already affect that pose. It also records actual opaque pixels in the authored
absent-hand box and the newly visible unique-color count, separately from IoU.
Of36 authored paint samples,25 remain visible beneath ink in the guide projection;
all source-warp baselines recover0. Image-clear-only output leaves129 opaque samples
in the authored absent-hand box where the guide has0, despite its better IoU.
All inputs/guide/proposal PNGs, settings, candidate alternatives and generator/code
hashes are retained. Clear-only review is an evaluation policy, not UI autoaccept.
No held-out artwork, learned-model comparison result, paper reproduction, artist
time/click/effort/style benefit or general motion/visibility claim. Source point
and optional target-hint counts are explicit. Nearest warp limits remain unchanged.

74 APA sources/full notices. Before trials, read OpenCV4.13 complete template
equation/API page and registered independent implementation scope. No OpenCV
runtime, examples or code copied/installed. Existing local NumPy2.4.1/full notices
reused. Refreshed LayerInbetween full README/requirements and inspected GPL3 header/
sections0..5 through line200, NOT a full license/dependency/checkpoint audit. Candidate
requires raster keys plus prepared first-key SVG, complementary stroke preparation,
flow/depth/SAM2 and own checkpoints in separate environments. No code/weights/data
acquired or executed and no performance reproduced. Repository terms alone do not
clear its checkpoints/transitive assets. Other procedural, existing/adapted/custom
neural approaches remain eligible; no final product license selected. Distribution
audit remains separate from local use. No paid compute, service or deployment.
