# ADR0020 — Explicit event/budget schedules over retained editable states

Status: accepted experimental implementation.

The master requires separate drawings, slots, holds, events and computation counts.
Uniform thinning can drop a contact/key; flattened-frame counts obscure ink/color
assets. We chose exact editable layer-content bundles as an explicitly named unit,
bounded greedy removal strategies, protected current temporal samples, coherent
region interval cloning and independent paired preview. Maximum and target are
hard constraints; preference is soft. Saved explicit constraints guard manual holds.
Artist originals and corrections remain authoritative; no new poses are fabricated.

Alternatives: uniform stepping (insufficient key/event guarantees); globally optimal
selection (not implemented/proven); learned preference ranking (no suitable artist
feedback yet). Three tested heuristics are not an artistic optimum. Reopen selection
when joint motion candidates, real timing preferences or scalable optimization show
useful measured benefit. Existing job/review/source contracts remain the boundary.

V1thumbnail loss missed HDone-pixel changes. V2uses changed-tile premultiplied integer
layer differences, with a symmetric drawing-pair cache and unchanged-tile skip.
All per-tile sums fit int64 (<=16384channels times65025squared); totals use Python
integers. It preserves fine differences but does not model flattening/occlusion or
perceptual salience. Retain coarse projection loss solely as a diagnostic.

Retimed regions keep stable parent IDs, domains/palettes/bindings/geometry and new
intervals; old region/operation metadata remains in history. Existing motion/part
revision interval rebind and older-build capability/downgrade handling remain open.

Updated 2026-10-21 17:31 EDT. Full master/all20requirements remain unfinished. Phase6 now has
experimental event-preserving schedule proposals; standalone remains selected.

Open Proposal > Drawing schedules / required events. Choose actor and interval;
save additional required keys/events, choose maximum/target/preference and count,
then Propose schedules. Compare current/proposed animation at shot fps, scrub,
and explicitly accept/reject a timing. Original timing diagnostic is available.
Actor states count exact layer pixel-content bundles (ink+color together), with
repeated content once. This named count differs from flattened/perceptual poses,
raster asset versions, exposure occurrences, timeline slots and compute proposals.
The operation reuses current approved/exposed poses and creates no new images.

Maximum is a hard upper bound; target requires that exact available count;
preference is soft. Infeasible budgets explain required states or absent new poses.
Artist/source keys, guide anchors, interval endpoints, added keys, required event
samples and protected corrected holds remain exact. Events preserve supplied
actor samples/times; physical contacts are not inferred. Ordinary Set hold now
refuses changes to saved event/key samples. Three heuristics favor low content
change, earlier poses or later poses; equivalent outcomes are labelled explicitly.

Separate private worker snapshot, deterministic recomputation, local subject epochs,
cancel/replay/tamper/stale/edit-undo guards and explicit review are integrated.
Unrelated layer corrections survive pending schedule application. Paired ink/fill
region intervals, ownership domains, current palette/part bindings and geometry
survive retiming; original metadata/operations remain history. Palette and boundary
regeneration afterward are tested. Earlier motion/part revision intervals may
need explicit rebind. Rejected timing fingerprints are retained/flagged and exact
reapplication refused. Undo/redo and full editable compact reopen are verified.

Verification: full266unit tests pass in165.626s;108Python sources AST-parse.
83distinct native checks in lineage:24general/18motion/24palette at V1;17schedule
rerun at V2 and again with final labels/full-cycle playback. Final15focused tests
pass. Only strategy labels changed after V2; all mathematical/protocol code is
byte-identical. The full-cycle clean-exit native run observed29clock-driven samples
and visited0/12/20 across a complete24slot loop; every displayed slot matched
elapsed time at24fps. Both960x820/900x760control layouts fit; actual paired Tk image
pixels/alpha match expected data. This is own Tk/controller/worker evidence, not
OS/tablet/screen-reader/external-editor or artist quality/effort acceptance.

Eight original cases/18accepted strategy comparisons preserve all required content,
originals/drawings/fps/duration. Scarf9distinct states/12occurrences become4states,
7holds and14reused raster assets with0new images. The six-state budget has2distinct
timings; many other strategies coincide and are labelled. Preferred1retains3required
states; hard1conflicts. Target30refuses because only9states exist. Corrected-hold
and additional-key/two-event variants preserve their exact samples.

Real failure retained: native01accepted a NumPy scalar in metadata and compact save
refused. Fixed explicit Python float and added accepted legacy/packed roundtrip
regression; archive validation remains strict. HD1920x1080one-pixel probe exposed
zero64square thumbnail loss despite8changed slots in an exact10x10ROI. V2ranks with
all premultiplied per-layer RGBA via tile hashes/changed-tile integer differences;
it reports2.937522644820052e-7loss for that proposal. The two-state proposal still
changes8slots as expected; protected samples force hard conflict or soft repair.
Thumbnail cost remains a diagnostic. Layer loss is not flattened composition,
geometry/semantic importance, expressive readability or a global optimum.

Only existing cleared Python3.13.1/Tk8.6.15/CPU NumPy2.4.1 execute.83APA references
and full local notices include current official Krita/OpenToonz timing precedents;
no upstream code/images/assets copied. The scheduler/cost are project designs,
not a novel scientific claim or learned timing preference. No package/model/data
acquisition, training, owner-art use/upload, paid compute or public deployment.

Exact tested source: experiments/EXP-0024-event-preserving-schedules/final-source-v3/;
verification.json gives V1/V2/final-label lineage. V1 and V2 outputs/preimages/failures
remain intact. Final full-cycle helper first lacked source import path, then had
a duplicate entry after a successful run; corrected helper exits0 and earlier
harness failures remain. These were not new application failures.

Current limits:64source state occurrences/selected interval,600shot slots,1..64budget,
32events/actor,64extra key slots,128rejections/actor,64timing operations. Source-layer
dependencies are conservative across the whole actor. Event preservation is sample
evidence, not a physical contact solver. Older prototype downgrade/capability gates,
broader native formats and explicit retimed motion/part rebind remain incomplete.
Greedy schedules are experimental; artist timing preference/whole-task benefit
has not been measured. The input pool currently consists of exposed approved poses.

NEXT: add explicit pose-progress/trajectory controls and event-boundary-aware hold
editing, keeping spatial path separate from timing/easing. Prepare a single joint
motion-candidate/schedule preview so artists need not accept a dense sequence first;
record internally computed vs selected poses and preserve current review/lock rules.
Then optional anticipation/overshoot/smear geometry and actual playback comparisons.
Keep automatic correspondence/visibility/new surfaces, intended contour/construction/
medium/overdraw/gap inference, semantic reference/color tracking, protection release,
proof-bound migration/Paeth performance, native formats/export, packaging/accessibility
and representative artist usefulness open in the complete master matrix.
No user answer blocks the next engineering action. No public service/compute purchase
is authorized; no unattended runner is implied.
