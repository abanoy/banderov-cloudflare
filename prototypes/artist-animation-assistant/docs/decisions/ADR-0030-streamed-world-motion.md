# ADR-0030 — Streamed world-coordinate motion

Updated 2026-10-21 20:31 EDT. Full master/all20requirements/goal remain ACTIVE and unfinished.

engine/deformation_stream.py evaluates the existing independently implemented point
MLS field in bounded bands, without source downscale or reduced sampling density.
Every source center contributes forward clipping/output bounds; every existing
step2Jacobian sample is checked in bands; every output center uses the same bounded
numerical inverse/residual thresholds. No full source RGBA, forward array, Jacobian
array or Python residual list is retained. Index/seen/clipped arrays are capped at
96MiB, exactly reached by a full4096x4096selection. Query bands have at most
16x4096samples; point evaluation still chunks4096. Source reads/output writes use
64pixel tiles. One shared geometry field serves all actor ink/color/protection and
existing managed geometry. Output tile bytes are interned across those planes and
capped at256MiB. These are data-structure bounds, not a measured total-process RSS
claim; existing input/archive/runtime/transient/output budgets also apply.

Large guide rectangles now validate inside the existing packed canvas<=4096. Small
input with a source/output union beyond512also routes through this field; a1000px
small-part translation retains hidden RGB and protected transparent erase exactly.
The retained small-source/small-output renderer stays unchanged. Field cache holds
one geometry only and refuses a different second geometry. Cancellation checkpoints
cover forward, Jacobian, inverse, tile sampling and writes. Geometry/unique tile
budget errors refuse without changing artist inputs. Source/project/drawing counts,
metadata/tile/serialization budgets and original-key restrictions are retained.

Sampled folds/near singularities, unresolved inverse residuals, unselected output
ink/constraints, lost/clipped protected flags and undeclared ink clipping remain
unsafe. Explicit ink clipping does NOT permit protected mark loss. Raw RGBA/alpha,
hidden RGB and boolean correction masks move together. Per-region outside-selection
flag checks now use16row bands, avoiding an extra full-output coordinate expansion.
Managed region bounds remain512square; this does not establish large semantic fill
regions, scalable automatic correspondence or all other methods' input sizes.

Joint motion adds an Allow canvas-edge ink clipping checkbox, default OFF. Changing
it invalidates pending results; protected marks still block clipping. Eight inherited
CREDITS methods/base App remain exact, and a fresh withdrawn source-bound host proof
covers the changed addon. No completed job opens/raises a window. No new native OS,
focus/accessibility/tablet/artist acceptance is inferred from own widgets.

Actual local study: full2560x1440visible character across all9retained raster layers
and175original slots/180drawings; source75/end81with supplied approximate developer
landmarks and fixed boundary hints. Generated content phase0.5is compared against
actual78, while its experimental insertion76..78is separately declared and never
overwrites original78. Translation and nonlinear rigid proposals report real canvas
edge ink clipping on3layers with clipping OFF; those unsafe candidates were not
installed. An explicit developer-only allow_clip=Truehypothesis is saved as9new
UNAPPROVED assets; exact .aaa reopen and ephemeral paint/undo pass. All artist keys,
originals and original native payload/profile/style manifests remain exact.
Grouping/unlocking only occurs in separate private study copies.

Scale works but this hypothesis does NOT beat hold: at768x432raw nearest-view proxy,
hold alphaIoU0.902001/rawRGBA-MAE17.626588, translation0.896179/18.810520,
nonlinear rigid0.894385/18.647358. Whole-frame proxies do not establish aesthetic
intent or diagnose all failures. The viewed output keeps the source expression and
does not create the target expression/new surfaces. No artist-quality improvement
is claimed. Isolated source study took6.772s translation/36.780s nonlinear rigid;
explicit clipped rerun36.236s. These are observed CPU run times, not guarantees.

Full-size withdrawn selected-host joint workflow generates1sample/9raster assets/
4actor states/3hypotheses over75..82with budget4, compares source/proposal, preserves
all unapproved flags and exact save/reopen, and does not auto-open a window. Explicit
clipping in this test is a developer choice, not a user aesthetic decision. Final
generation/comparison times and isolated loop gaps are in hidden-large-host.json.
Earlier overall10.300271sgap included main-thread harness file reopen/save checks;
retained separately and not presented as background-only latency. No24fps/OS claim.

Verification: full356unit tests pass in209.817s, exit0. Final focused8tests
passed9.189s; earlier25deformation/motion checks passed49.919s. Coverage includes
small nonlinear/rotation/translation raw parity, independent HD translation oracle,
4K world coordinates and full16,777,216sample selection, tile-only RGBA reads,
long-range small movement, fold/collision/clipping/protected-loss guards, input
immutability, shared-field reuse, cache/budget/cancel refusal, editable installation
and exact reopen. 139product Python sources AST-parse with exact snapshots.
All33original samples SHA256/size/mtime and master/base App hashes pass.
123APA sources, existing full runtime notices, credits/check,
headless selected CLI --credits and current host/addon source proof pass.

Research: author-hosted MLS paper rechecked; equations reused through existing
credited independent solver, not author code. Current ToonCrafter paper/repository/
Apache license and existing ToonComposer README inspected as research candidates.
Their reported hardware/resolution/interface profiles are not local measurements,
and repository license is not blanket weight/dependency clearance. No model/code/
dependency download, training or art upload. All procedural/existing/adapted/custom
neural routes remain eligible by evidence. See research.md and CREDITS source IDs.
Private hardware-feasibility.json retains read-only local GPU/RAM and selected
interpreter module-spec observations. Intel Arc is reported; Torch/ONNX Runtime
specs are absent in selected Python3.13.1. CIM AdapterRAM is not treated as a
verified dedicated/shared VRAM budget. Next model audit should consider lawful
smaller CPU/Intel-compatible routes instead of assuming stock CUDA execution.

Failures retained: first focused unittest command used the staging cwd; rerun from
canonical project. Initial clipping oracle moved an edge point exactly inside;
changed destination to genuinely outside. Actual undeclared clipping correctly
refused installation, then a separately declared unapproved hypothesis was tested.
First host heartbeat aggregation included harness disk audits; phased recording
separates that cost. No safety threshold or artist data was relaxed to pass tests.

NEXT: improve full-visible-character correspondence/independent shape/visibility
quality against held original keys and hold baseline; investigate explicit parts/
donor sources and lawful learned/hybrid alternatives using current local hardware/
license evidence. Direct edited-candidate adoption,512region metadata, native RGB/
profiles/masks/vectors/export/other5parts, rough intended contours/medium, semantic
references/color stability, accessibility/packaging and whole-task effort remain.
No paid compute/public service/deployment, foreground app/browser/editor, reset/
commit, art training/upload/distribution, subagent/other-chat message or scheduler.
