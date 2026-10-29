# ADR0028: Candidate eligibility is separate from artist approval

Accepted scoped joint backend; host/quality acceptance remains incomplete.

# Joint unapproved motion pool and sparse schedule review

Updated 2026-10-21 19:47 EDT. Full master/all20requirements/goal remain ACTIVE and unfinished.

EXP0032 adds engine/joint_motion.py, scripts/study_joint_motion.py and controller/
worker routes. Motion.stage generates into a private scratch project with every
new drawing approved=False/origin=unreviewed_motion_candidate. It never pretends
the dense pool was artist-approved. Explicit hash-bound candidate eligibility is
separate from approval; ordinary schedule processing still refuses these drawings.
Public motion.accept still strictly recomputes external results. Internal stage
generates once from a request and installs that fresh result, not external data.

Up to16disjoint candidate holds from original approved anchors. Right-to-left
staging preserves those anchors, source/target keys and relevant regional geometry.
Base required source/key/event/protected-hold samples may not be overwritten by
pool generation. The existing event/budget search selects exact actor-content
bundles; hard maximum/target/preference distinctions remain. Unsafe geometry refuses
the pool with repair reasons; partial unsafe-pool review remains unfinished.
Existing512drawing/256MiBtile/512MiBasset/8MiBmetadata/64occurrence limits stay intact;
legacy0.1remains64drawings/32MiBserialized and is not silently migrated.

Preview keeps ALL computed drawings unapproved. Explicit joint acceptance approves
only computed assets actually exposed by the selected schedule; unused assets stay
stored and unapproved. Source drawings/original snapshots/other holds survive.
Staged region status/warnings say candidate, not reviewed; selected regions gain
joint-reviewed status. Geometry, palettes, domains, seeds and ink/fill timing follow
the selected schedule. Recolor and exact legacy/packed save/reopen are tested.
One controller commit provides one-action undo. Rejection memory survives deterministic
pool regeneration; equivalent timing proposals remain labelled. Local dependency
epochs reject selected edits and edit+undo while preserving independent corrections.

Worker operation joint_motion_schedule uses existing private snapshots, identity,
state transitions, separate process and cooperative checkpoints. A forged inner
settings object cannot differ from the declared job, even if hashes are recomputed.
Counts/hashes are recomputed before review; reviewed jobs refuse replay. Mid-generation
cancel at checkpoint8produces no result. scripts/study_joint_motion.py creates a
NEW private review bundle and three unapproved .aaa previews; it never accepts.
Child process uses CREATE_NO_WINDOW on Windows. --credits needs no artwork.
Session.apply_joint_motion is the controller route; host buttons/path/clock/contact
editors are NEXT. Verification/regeneration must move off the Tk thread before
new interactive adoption. No new GUI/OS/tablet/artist acceptance is claimed.

Actual animation study retains exact native75/78/81small mouth-raster pair and
developer bbox/arc guides. New76/77samples use normalized1/6and2/6clock phases.
Per generation pass:2motion samples,4new per-layer raster assets,5available joint
actor states (3source+2proposed),3schedule hypotheses. Budget2conflicts with3mandatory
source states. Budget3keeps only source states; budget4exposes1generated pose plus
the3source states (2generated raster assets); budget5exposesboth generated poses.
All three heuristics coincide in this case and are labelled, not fake diversity.
All true source keys,7slots and24fps remain exact. Crops were visually inspected;
a multi-image display initially appeared blank at77, but independent PNG decoding
and repeated rendering prove76/77identical with4,186nontransparent samples, and
a separate image view confirmed visible pixels. No renderer change was warranted. Candidate copies reopen exactly;
every generated asset remains unapproved. An ephemeral engineering acceptance+undo
check verifies selected-only approval without saving an artist-approved file or
marking the actual review job reviewed. No owner acceptance is inferred.

The budget4CLI bundle performs8motion backend evaluations total:2in the worker and
2each in3deterministic preview recomputations. Sparse artist-facing drawings do NOT
imply reduced internal computation. Acceptance incurs another generation pass.
Counts describe samples, per-layer assets and actor-content states separately.
These are existing explicit MLS/trajectory hypotheses on a small complete part,
not solved full-character anatomy/action/new surfaces, native effects or usefulness.

Verification: final343unit tests pass in190.698s; earlier342pass212.996s predates
serialization-format alignment/extra legacy case. Final9focused pass9.112s.
Coverage: separate real worker, candidate approval separation, hard event/key
conflict, wrong-result/forged-inner-settings rejection, replay, checkpoint8cancel,
rejection retention, independent correction, edit-undo staleness, one-commit undo,
managed-region timing+palette editing, exact0.1/0.2reopen and no silent migration.
133Python sources AST-parse with exact final-source snapshot. All33original
samples full streamed SHA/size/mtime unchanged; master/UI shell unchanged.
120APA sources/full existing notices; current build/check/selected host proof
and CLI --credits pass. No product GUI control changed; no new mapped window.

Failures retained: worker harness initially omitted --job and exited2; corrected.
Replay initially hit an already-changed source-hold guard before its review marker;
marker check moved earlier for a meaningful reviewed-job refusal. Design review
found inner result settings needed explicit binding to outer job; guard and a
valid-but-different forged schedule test added before final trials. Legacy budget
now uses the same indented UTF8serialization convention as its actual persistence.
First guessed OpenToonz/manual URL and raw path failed; registered canonical manual
URL succeeded. No access restriction bypass or approval request was needed.

Current free primary refresh: W3C CSS Easing1 time/progress contract and OpenToonz
Level Strip/held reference distinctions, reusing already registered APA sources.
Independent orchestration/eligibility policy, no copied upstream code/examples or
scientific optimality/artist preference claim. Existing cleared Python3.13.1,
NumPy2.4.1/Tk8.6.15only; no model/package install, training/art upload/distribution,
paid compute/public service/deployment, editor/settings launch/change, Git reset/
commit, subagent/other-chat message or unattended scheduler. All work stays hidden.
