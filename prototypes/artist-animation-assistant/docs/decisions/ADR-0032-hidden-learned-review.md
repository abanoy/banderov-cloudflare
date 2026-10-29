# ADR-0032 — Hidden learned-motion editor review

Updated 2026-10-21 21:15 EDT. Complete master and all twenty requirements remain ACTIVE.

Selected NativeApp now has a Learned motion tab alongside geometric Joint motion.
Choose an existing compact0.2actor/layer or use the selected layer/group, input
source/end keys, an interior exposure hold, explicit content phase, model working
width/height and RGB matte. Outputs stay at native canvas dimensions; working-size
fields are explicitly upsampled. Optional detail bounds affect comparison only.
Local existing pinned CPU model is optional; no auto-download/install/account.
The tab warns about blurred lines/incorrect expressions. Missing runtime, unsafe
protection, unsupported groups/regions and invalid source/event/hold choices refuse.

LearnedJobs keeps all inference in an owned CREATE_NO_WINDOW local subprocess,
including strict recomputation for comparison and accept/reject. Snapshot creation,
serialization, layer assembly and full/detail rendering run off Tk in a controller
thread. Only the Tk caller consumes the returned event, checks source/session/
parameter identity, and performs one commit. No worker calls Tk. Socket blocking
stays inside the owned inference process, not a monkeypatch of the editor network.
No upstream executable/model-zoo/import/download or new runtime is introduced.

Cooperative cancellation writes the owned worker's cancel request. After10seconds
without exit, only that owned Popen handle is killed/reaped. An owned inference
deadline240seconds initiates the same stop protocol. Closing the panel/editor
also kills its published owned process, and a spawn-after-cancel race kills before
continuing. Final real-process shutdown/cancel tests prove the handle is terminal;
this is not a hard universal cancellation latency or OS process-tree guarantee.
Private logs, process/job identity, status and source/component/credit provenance
remain; status-write errors are delivered to the caller, never silently accepted.
Existing private-root1.5GiB and all document/model/tile/metadata bounds remain.

Generate returns an unapproved proposal; completion never opens/raises a window.
Prepare comparison strictly regenerates in a fresh hidden process and compares the
entire result before saving a separate unapproved editable .aaa. Paired full/detail
clock playback spans source through end key inclusive, preserving actual exposures
outside insertion. Detail crop is explicit; it is not automatic face recognition.
Only Open comparison creates its read-only window, withdrawn when parent withdrawn.
Acceptance requires explicitly opening that current comparison. Editing inputs,
parameters, selected source epochs or source edit+undo invalidates proposals;
independent edits can survive review via the existing guarded three-way merger.
Comparison context changes require preparation again. Rejected signatures remain
labelled, cannot be approved without corrected inputs/settings, and artist reason
is saved. Accept/reject independently recompute in a fresh process. Each operation
costs1model evaluation; generate+compare+accept costs3, not a compute-saving claim.

Three-way merging now supports bounded learned operation/rejection histories as
well as existing history/geometry/schedule histories. It preserves independent
paint/mapping order and both compatible append-only suffixes; conflicts refuse.
No controller worker commits. Acceptance approves exactly that chosen pose's
per-layer assets, preserving source keys/original versions; undo is one action.
Direct editing/adopting an unapproved candidate before approval and joint learned
pool/budget selection remain unfinished. The existing sparse schedule backend can
recognize reviewed_learned_motion as optional, but that is not a unified pool UI.

Source-bound CREDITS proof now binds all9roles: entry, host, native panel, report,
joint jobs/panel/comparison and learned jobs/panel. Changed/missing learned files
fail closed. The eight tested base CREDITS methods and base App are untouched;
fresh withdrawn offline proof reads all138APA sources and full
notices, suppresses private links and does not open a browser. No new OS/focus/
screen-reader/physical layout/artist acceptance is claimed. Old HTML owner report
and earlier native evidence remain historical and unchanged.

Actual hidden selected-host study uses the full visible nine-layer2560x1440first
animation part, keys75/81, model960x540black matte, content phase0.5 and insertion
76..78. This is an explicit developer hypothesis, not artist-selected timing.
One generation and independent comparison inference (2evaluations), all9new assets
unapproved. Source/original/native retained drawings stay exact; separate .aaa
reopens exactly. No completion-opened window; explicit full/detail comparison stays
withdrawn, reads both anchors/proposed interval, and clocks through own controls.
Actual timings/phase-specific pump gaps in private hidden-host.json, also retained
in verification. File reopen audits are separate and must not be confused with
background-only loop latency. No24fps/focus/tablet/physical performance guarantee.
No new quality improvement is claimed: underlying EXP0035model is unchanged, and
the retained one-transition proxy still visibly smears face and misses expression.
Independent CLI/editor audit confirms exact generated pixels/protection for all9
layers, both unapproved, with exact originals/shot despite differing operation IDs.

Verification: full374tests pass204.837s, exit0. Six new tests cover strict
worker/preview/review, separate real CPU process, real cancel/shutdown, tampered
result refusal, independent merge/history/one undo, detail bounds, status disk
failure, missing/tampered learned credits, withdrawn controls/no autoopen,
acceptance-before-comparison refusal, source edit+undo and parameter invalidation.
Existing joint/provenance tests also pass. 148product Python files AST-parse
with exact final snapshots, all33original samples full SHA/size/mtime pass,
master/base App/selected entry/learned model algorithms unchanged. 138
APA sources, full local notices, credits/build/check/headless selected --credits and
fresh9role UI proof pass. Optional real-runtime test ran on this configured machine;
clean machines skip that optional case rather than fetching dependencies.

Failures retained: initial shell quoting prevented proof-helper construction;
switched to saved Python script. First test copy used wrong cwd; installed from
absolute managed staging path. First controls test found an overbroad source-edit
replacement changed comparison constructor's default into an undefined variable;
fixed specific replacement/default. Proof fixture lacked evaluation directory;
fixed fixture creation. Earlier actual run preceded final shutdown-only hardening;
final focused real-process tests cover cleanup without changing model/preview code.
No safety threshold, original artwork, test expectation or full scope was relaxed.

Research: Python3.13 subprocess primary docs for list arguments, Popen, hidden
Windows creation, poll/wait/kill and ownership; queue and Tk event/threading primary
docs refreshed. REF-PYTHON-SUBPROCESS-3-13 added before experiments; existing model,
NumPy/compositing/thread/Tk sources reused. No copied upstream examples/art. Latest
generic Tk docs describe newer runtimes; only event-loop contract reused, not a
claim of upgrading installed Tk8.6.15/Python3.13.1. Components remain existing exact
isolated local-use-only artifacts; package/binary distribution audit is incomplete.

NEXT: joint learned candidate pool/event-budget preview and correction adoption,
preserving source anchors/protected events and one-commit undo. Broaden real transition/
occlusion/face evidence with hold baselines and supplied parts/donor constraints.
Rough intended contours/medium, semantic references/color, new surfaces/stylized
shape/contact, native full profiles/masks/vectors/export/other five parts, packaging/
accessibility and whole-task effort acceptance remain. No foreground app/browser,
art training/upload/distribution, paid compute, public service/deploy, Git reset/
commit, subagent/other-chat message or scheduler. Full20goal remains active.
