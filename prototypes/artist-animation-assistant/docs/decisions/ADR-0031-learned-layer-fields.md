# ADR-0031 — Optional learned fields with editable layers

Updated 2026-10-21 21:03 EDT. Full master and all twenty requirements remain ACTIVE and unfinished.

EXP0035 adds an optional, explicitly configured local RIFE4.6/ncnn CPU route.
The selected standalone App and joint GUI are unchanged. This increment supplies
engine APIs, an owned hidden worker, a private-study CLI and a Session controller
route; it does not yet supply a learned-method GUI selector or unified learned
candidate/budget editor. Strict acceptance recomputation is synchronous at the API;
move it into background preparation before any Tk button invokes it.

Pinned components were audited and registered in APA CREDITS with full notices
BEFORE runtime import or artwork inference. RIFE converted graph/weights are from
nihui/rife-ncnn-vulkan a7532fc3f9f8f008cd6eecd6f2ffe2a9698e0cf7.
Practical-RIFE bbfd2ea90910789a860ea3e2b32a240cd577b75e author README explicitly
licenses trained models under MIT. The cp313 Windows ncnn1.0.20261020 wheel SHA256
6d7a6572d289d508f03f0fa490a2c6702f6d4efac56ead2d1c454a6d1e3e68c9 is isolated under
ignored models/, with only core Python/binding/DLL/dist-info files extracted.
Model-zoo/utils are not extracted/imported. Global Python/dependencies are unchanged;
no Torch, CUDA, OpenCV, requests, tqdm or portalocker installation. NumPy is existing.
BSD3/ncnn third-party notices, pybind11 license and full MSVC local-use EULA retained.
Compiled wheel internal header revision is not independently build-attested.
Components are cleared for this local execution only, distribution_allowed=False;
dependencies_audited=False prevents treating this as a distribution-ready package.
Exact model/runtime artifacts and publisher hashes are retained in manifests.

engine/rife_fields.py independently implements the graph's border/bilinear custom
Warp. CPU2threads, Vulkan/FP16/BF16/packing off. Final backward fields327, sigmoid
weight332 and RGBout0 are extracted; they reconstruct the model's RGB exactly in
the authored smoke and actual study (max error0). This validates graph adaptation,
not optical-flow truth or calibrated confidence. Inputs32..1024 and786432pixels
maximum, explicit working resolution and RGB matte, edge padding to32multiples.
Model workspace/total process RSS are not measured. Native transported outputs
retain canvas dimensions; model fields are explicitly upsampled per axis.

engine/field_transport.py shares both fields and weight across ordered ink/fill
layers. It mixes visible premultiplied contributions then reconstructs editable
per-layer RGBA under retained opacities. Independent scalar compositing oracle
passes within3/255. Fully occluded/zero-opacity/hidden RGB survives identity tests.
Unlike model RGB border padding, artwork sampling outside the canvas is transparent.
Protected nearest RGBA/transparent erasures override interpolation; conflicting
protected key values or missing protected key samples refuse approval. Flags and
artwork travel together. Tile64 traversal, shared unique output pool<=256MiB,
two shared source-coverage bool arrays (32MiB at4096square); no total RSS guarantee.
Partial-opacity isolated groups and managed regions explicitly refuse this route
pending hierarchical/two-key handling. No metadata or group opacity is discarded.

engine/learned_motion.py uses two approved keys and explicit content phase,
separately declared exposure insertion. It preserves original source keys, events,
required samples and protected holds; it refuses insertion over mandatory states.
All preview assets approved=False. Strict public accept AND reject independently
recompute before trusting external pixels/signatures. Worker review validates outer
and inner settings, model/runtime artifacts, source epoch, output hash and complete
current result; reviewed-marker replay refuses. Rejection memory survives equivalent
regeneration; unrelated corrections survive one-commit application/undo. Edit+undo
of selected art stales results. Owned worker disables Python sockets during proposal,
has cooperative checkpoints including custom Warp, retains failure/cancel states,
and never autoopens a window. Cancellation produces no installed partial proposal.

Actual study uses all nine retained visible raster layers at2560x1440 from the
first175-slot/180-drawing native part. Only75 and81 enter the model, at960x540 on
explicit black matte. Actual78 is a comparison, never training/model input.
Content phase0.5 and insertion76..78 are separate; original78 is preserved.
Nine new native-size editable assets are saved UNAPPROVED in a private .aaa;
worker and independent parent each infer once (2backend evaluations). Exact reopen,
original drawings/native payloads/originals/shot and every exposure outside76..78
are verified; actual generated drawing paint/undo passes. Source file unchanged.
Actual output tile pool17,285,120bytes; shared coverage7,372,800bytes, not peak RSS.

At768x432 RAW view proxy, source hold alphaIoU0.902001, learned0.939418; alpha128
IoU0.901024 versus0.933683. RawRGBA MAE17.626588 versus12.988882; premultipliedRGBA
mean absolute error0.071596 versus0.053636 (0..1scale). End hold is also retained.
These whole-frame metrics are evidence for this one transition, not a general
artist-quality result. Visual inspection shows blurred/doubled facial contours,
incorrect eye/expression and other shape differences from the actual middle.
Apparent new visibility is appearance mixing, not semantic surfaces/intent proof.
No artist acceptance, anatomy understanding, line-weight or effort benefit inferred.

Verification: 368unit tests pass in199.285s, exit0, including12new focused
checks (final focused12pass2.006s). Real optional CPU worker ran, not skipped on
this configured machine; clean environments skip optional runtime-specific test.
Independent layer oracle, hidden ink, masks, native flow scaling, finite/budget/
cancel guards, exact reopen, events/groups, tampered accept/reject, stale undo,
rejection history, one-commit undo and replay are covered. 145Python sources
AST-parse and exact final snapshots retained. All33original samples checked
full streamed SHA256/size/mtime unchanged; master/base App/all selected UI unchanged.
137APA sources, credits/build/check, selected existing EXP0034
source-bound UI proof and both headless --credits entry points pass. No new mapped
UI/native editor/OS accessibility/tablet/24fps acceptance is claimed.

Failures preserved: first guessed upstream custom-op path returned404, canonical
warp.cpp located. Initial ncnn smoke used Mat(array.copy()) with a temporary NumPy
buffer; Mat borrows that storage and corrupted the smoke. Retaining arrays through
clone fixes it; output reconstruction and optional real-worker checks now pass.
Direct rejection initially trusted supplied signature with source scope only;
strict re-inference and tampered-rejection regression added before final suite.
No safety/resource thresholds were relaxed. No new training, artwork upload or
distribution, paid compute, public service/deployment, foreground app/browser,
Git reset/commit, subagent, other-chat message or scheduler.

NEXT: background learned review/comparison in selected host, explicit method/working
size/matte controls and source-bound CREDITS extension proof; preserve correction
adoption, event/budget scheduling and one-undo semantics. Then representative
multi-transition/occlusion/face quality with hold baselines, explicit part/donor
guidance and region bindings. Rough contour intent/medium, native fidelity/export/
other five archives, semantic references/color, accessibility/packaging and full
twenty-requirement artist task evaluation remain unfinished. All approaches remain
eligible by evidence; optional learned backend does not replace other required work.
