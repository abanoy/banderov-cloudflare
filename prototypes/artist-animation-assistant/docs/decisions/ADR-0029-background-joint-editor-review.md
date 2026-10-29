# ADR-0029 — Background joint editor review

Updated 2026-10-21 20:10 EDT. Full master/all20requirements/goal remain ACTIVE and unfinished.

Selected NativeApp now adds a scrollable Joint motion tab. Save/edit explicit
correspondences using the existing editor, choose rigid/similarity/translation deformation,
shot interval, disjoint insertion interval, candidate count and maximum/target/
preference drawing budget. The artist can author a cubic arc for one matched
landmark, source point contact then release, and independent linear/eased/initial
hold clock progress. These are supplied geometry hints, not inferred anatomy,
surface contact or exact resampled-pixel contacts. Controls save through validated
motion-guide history with one normal undo; timing preserves spatial paths.

JointJobs performs generation, deterministic preview regeneration, packed preview
save, paired frame render and accept/reject preparation on one cooperative daemon
worker. It makes no Tk/network calls. One bounded outcome queue, progress, cancel,
existing storage threshold and document/serial/choice/scope checks protect the
current editor. Completion only reports readiness; it never opens/raises a window.
All candidate assets remain unapproved in private editable preview copies.

Prepare paired comparison first, then open it explicitly. Acceptance is disabled
until that chosen comparison has been opened. This records opening, not proof of
human inspection or aesthetic approval. The read-only pair shows full visible raw
context or a detail crop enclosing supplied guide regions/handles/path controls
with8pixel padding. It does not infer moving object bounds. Shared PNG cache is
bounded to128distinct context/detail frames and64MiB. Playback uses monotonic
elapsed time and shot rational fps for both sides; late frames may be skipped.
No real-time performance guarantee. Editing remains in the main editor; direct
edited-candidate adoption before acceptance is still unfinished.

Background accept/reject returns a trusted prepared project; the Tk thread validates
current scope and merges independent changes before one Session.commit. Three-way
merge preserves current layer order, independent drawings/layers, layer-separated
exposures and append-only histories. Conflicts refuse. Actor/guide edits and even
edit+undo invalidate old results. Acceptance approves only selected generated assets;
unused assets remain unapproved. Rejection memory survives regeneration. Poll errors
are reported and the poll loop continues. Undo restores artwork/history with newer
epochs deliberately retained. All originals remain untouched.

Withdrawn synthetic own-control checks pass generation separation, paired actual-
clock/scrub, concurrent independent paint during accept, one-action undo, rejection
memory, independent arc/clock/contact authoring, actor edit+undo staleness, cancel,
no socket/browser use and no mapped window. Maximum sampled pump gap
0.043740s. Actual private75/78/81small mouth pair uses
the same EXP0032developer hints/settings:2pose samples/4new raster assets/5available
actor states/3hypotheses, budget4. Source and all candidate approval flags retained;
exact private .aaa reopen passes. Actual timings and loop gaps are in private
report.json and verification.json; they include context setup and vary by load.
No approved actual project was saved and no artist usefulness is inferred.

Read-only alpha inventory of the existing full175frame2560x1440native import checks
9active layers at slots0/75/78/81/174:30of45sampled layer states exceed256pixels in
one dimension. This counts sampled layer states, not unique drawings or inferred
characters. Exact retained input archive hash is unchanged. Private inventory and
docs/SCALABLE_MOTION_NEXT.md ground the next scale investigation; no new guide,
generation, artist approval or full-character quality is inferred from this audit.

Fresh withdrawn CREDITS evidence retains exact eight inherited methods and full
offline notices. NativeApp remains a direct subclass of unchanged base App. Gate
binds entry, native panel, host, report and all3joint modules. Missing bindings or
source tamper refuse; older four-role proof remains valid only for a host without
the joint import. Earlier owner/native visibility/Return/Escape evidence remains
historical; no invented new OS/focus/artist acceptance.

Verification: 348unit tests pass in194.045s; 137Python sources
AST-parse and exact final-source snapshots retained. All33original sample
SHA256/size/mtime checks and master hash pass. 120APA references,
credits build/check and source-bound selected-host proof pass. Existing cleared
Python3.13.1/Tk8.6.15/NumPy2.4.1 only; no new packages/models or copied upstream code.

Retained development failures: first harness checked the UI-selected drawing after
refresh instead of the separately edited drawing ID; corrected explicit ID check.
Harness used a nonexistent Session.undo instead of travel, then expected equal
revision epochs after undo; corrected artwork/exposure/history restoration scope.
Actual settings initially defaulted to rigid while the prior study used similarity;
added explicit artist-facing deformation choice, then exact settings matched.
Full-context thumbnail made the small mouth hard to inspect; added detail view.
Source review caught an unsupported affine dropdown option; corrected to the
existing translation comparison and tested every offered model through the worker.
The PNG regression initially used the legacy256px decoder for a271px preview;
corrected the harness to its existing packed mode; no import policy was relaxed.
A relative staging copy used the wrong cwd once, then was corrected to absolute.
Same-named guides in a replacement document now reload their landmark controls;
the hidden regression checks replacement with changed handle identities.
Status persistence errors are delivered to the caller queue as failures instead
of leaving an apparently finished task without a result; injected disk-failure
regression verifies artwork remains unchanged.
No source-art correction, foreground launch or user question was required.

NEXT: representative full-character/scalable deformation and visibility research,
with evidence-backed existing/adapted/custom neural alternatives still eligible;
edited-candidate correction adoption remains open alongside native document fidelity,
rough-line intent/medium, semantic color/part stability, packaging/accessibility and
whole-task effort evaluation. No training/upload/distribution, paid compute/public
service/deployment, Git reset/commit, other-chat messaging, subagent or scheduler.
