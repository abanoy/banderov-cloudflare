# ADR-0033 — Budget-aware learned pose pools

Updated 2026-10-21 21:40 EDT. Full master and all twenty requirements remain ACTIVE and unfinished.

engine/learned_schedules.py combines optional learned candidates with the existing
event-preserving exact editable actor-content scheduler. It preserves the separate
MLS/trajectory route and all existing methods. Requests declare1..16disjoint learned
sample holds plus an actor-level maximum/exact-target/preference drawing budget.
Each two-key request is validated against original approved anchors and the complete
selected actor. Mandatory source keys, guide anchors, explicit events and protected
holds may not be overwritten. Partial-opacity groups and linked managed regions
still refuse learned inference pending coherent hierarchical/two-key support.

Preflight counts exact required per-layer pixel-content bundles. If required states
already fill/exceed the requested budget, no learned inference or runtime loading
occurs. Hard budget conflict remains explicit; preference honors mandatory states.
A feasible source-only schedule can be reviewed without computing unusable extras.
If optional capacity exists, requested samples are generated; additional model
outputs can later add protection/content conflicts and still refuse. Preflight does
not predict semantic usefulness or guarantee that all requested target counts exist.

Every fresh candidate is computed against the ORIGINAL approved keys, never a
generated candidate. A validated single-sample installation supplies new unapproved
drawings and metadata, then only its disjoint interval is spliced into the private
pool from right to left. Original holds/keys/drawing versions/native bytes survive.
Previously rejected individual learned samples refuse pool inclusion. All asset/
history/metadata/tile budgets remain unchanged; capacity errors leave source intact.
Hash-bound candidate eligibility admits these assets to timing search without
pretending they are approved. Greedy strategies remain heuristic exact per-layer
content removal, not perceptual/anatomical optimization or artist preference.

Preview strictly regenerates pool/search and keeps EVERY computed asset unapproved,
including unused ones. Acceptance strictly regenerates then approves ONLY generated
assets exposed by the chosen schedule. Unselected versions remain stored/unapproved;
operation approval is true only for that selected complete per-layer pose. Rejection
history survives equivalent deterministic regeneration, and timing rejection reason
is retained in project history. Forged counts/assets/inner settings/current-source
changes refuse. Selected edit+undo remains stale; one Session commit gives one undo.
Direct edited-candidate correction adoption is still NEXT, not silently inferred.

Selected Learned motion tab adds Review a pose pool and drawing budget, sample count,
actor-state budget/mode and three labelled schedule choices. Pool content phases run
evenly from a positive fraction up to the explicit Content phase, independently of
the declared hold partition. Example2samples, final phase0.5: phases0.25/0.5at the
two partitioned holds. The comparison includes input anchors and the selected timing,
with supplied detail bounds. Changing parameters/choice invalidates comparison and
pending work. Acceptance still requires explicitly opening the current comparison.
No result completion opens/raises a window. Single learned poses and geometric joint
controls retain existing behavior. No implicit denser animation or artist preference.

LearnedScheduleJobs inherits the owned hidden CPU process lifecycle. Each evaluated
sample uses a separate existing learned worker; strict comparison/review repeats
the same per-sample checks in fresh processes. No ncnn inference or socket patch
runs on the Tk thread/editor process. Cancellation at any phase discards the partial
pool, keeps private diagnostics and preserves artwork. Per-process240sdeadline,
10scooperative cancellation grace/owned handle kill, close cleanup and existing
private storage threshold remain. There is no new total-time or process-RSS claim.
Successful result counts are per pass. Status distinguishes attempted sample calls
from completed pool samples; failed/cancelled completion count may be unknown.
Two samples cost2evaluations for generation,2for comparison and2for acceptance;
sparse displayed drawings do not imply compute savings except the explicit zero-work
budget-floor case. Each pose may have many per-layer assets; these are not extra poses.

scripts/study_learned_schedules.py SOURCE.aaa SETTINGS.json NEW_PRIVATE_DIR supplies
one chosen unapproved private preview (default sampled_change), retained workers,
provenance/full credits and counts. It never accepts. Hard budget conflicts are
retained as reports rather than replaced by a silently relaxed budget. Ctrl+C stops
the owned worker. Settings are bounded64KiB; source/settings identity is checked.

Actual full visible character study uses all9raster layers at2560x1440 with the full
175-slot/180-drawing source project, native payloads/originals retained. Source75 and
end81 are inputs; actual78 remains an exact mandatory source key. Developer phases
0.25/0.5are inserted at76/77, with explicit960x540black-matte model input. These are
experimental hypotheses, not artist timing choices or new expression understanding.
Budget2conflicts with3required actor states and starts0model processes. Budget3
returns source-only timing and also starts0model processes. Budget4computes2samples/
18raster assets, has5available actor states, and selected timing exposes1generated
pose/9assets plus3source states. All18assets remain UNAPPROVED in the saved preview,
including9not exposed. All true75/78/81keys, old drawings/native bytes/originals and
source file stay exact; full .aaa reopen and explicit withdrawn full/detail clock
comparison pass. Generation+comparison actually perform4model evaluations total.
Private hidden-host.json retains phase-specific generation/comparison time and pump
gaps; synchronous harness file audits are separately identified, not counted as
background-only latency. No OS/tablet/focus/24fps or artist usefulness acceptance.
Underlying EXP0035fields/layer reconstruction are unchanged, including visible face/
expression smearing. This increment improves schedule control, not model quality.

Verification: final384unit tests pass210.148s, exit0. Ten new tests cover
budget-floor no-inference, hard conflict/source-only/dense capacity, explicit event/
source/overlap refusal, source-only rendering, never-approved previews/selected-only
approval, exact reopen/one undo, strict tampered accept/reject, source edit+undo,
rejection memory, refused unsafe/previously rejected sample, cancel/no partial result,
attempt/completion counts, hidden real per-sample processes, controller reason/history,
choice epoch, explicit compare gate and missing/tampered learned-pool UI evidence.
An injected receipt-write disk failure after a successful commit originally yielded
an incorrect refusal message. Reproduced on an authored withdrawn fixture and fixed:
the accepted/rejected change stays committed with one undo, pending work clears, and
the diagnostic explicitly says the receipt could not be saved. Source artwork is
not rolled back or silently re-applied. Final regression covers this post-commit path.
The first reproduction event was correctly refused because its cancelled flag was
still set; fixture corrected to a current trusted event before reproducing the bug.
New-test teardown cancels pending idle render; this removes a stale Tcl callback
warning from the first focused run without changing the product renderer/base App.
Existing single learned/joint/provenance regressions pass. 152product Python
sources AST-parse with exact final snapshots. All33original samples full
streamed SHA256/size/mtime and master/base App/NativeApp/entry/models/scheduler hashes
are unchanged. 138APArefs/full notices, build/check, both headless
--credits routes and fresh10role selected-host source-bound proof pass. Optional
runtime test ran on this configured machine; no automatic dependency acquisition.
Earlier focused25tests pass11.214s before the receipt correction; earlier383full
tests also pass and are retained as unit-tests-before-receipt-fix files. An authored
source-only CLI generate/preview case
also exits0, reopens exactly, preserves source and starts0model processes.

Research: primary OpenToonz Editing animation levels sections6–112rechecked for
stored drawings versus exposure references and hold/step distinction. First guessed
docs.opentoonz.org URL failed; registered opentoonz.readthedocs.io canonical worked.
Python3.13subprocess ownership contract rechecked. Existing APA sources/model/
runtime/compositing notices reused; new feature use registered BEFORE trials. No new
model/runtime/package, code/figure/art copy or training. Independent budget preflight,
staging, review policy and source binding. Final status label refinement distinguishes
attempts from successful samples; actual study predates that metadata-only change,
which final tests cover. Model/staging/preview numerical behavior is unchanged.
One automatic permission-review deadline expired before a final file copy started;
the explicitly permitted retry succeeded. No unsafe-action finding or unresolved
approval blocker remained. The copied counter/test changes and final proof pass.

NEXT: source-bound corrected-candidate adoption and regeneration across learned and
geometric candidates, preserving masks, independent edits/rejections and one undo.
Broader actual transitions/occlusion/face/parts/donor controls remain, along with rough
intended contours/medium, semantic references/color, stylized shape/new surfaces,
native RGB/profile/mask/vector/export/other5parts, packaging/accessibility and whole-
task effort. No foreground app/browser, art training/upload/distribution, paid compute/
public service/deploy, Git reset/commit, subagent/other-chat message or scheduler.
