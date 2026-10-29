# ADR0027: Separate supplied spatial paths, clock and contact constraints

Accepted scoped backend, not full artist-quality acceptance.

# Independent trajectories, clock progress and supplied contacts

Updated 2026-10-21 19:32 EDT. Full master/all20requirements/goal remain ACTIVE and unfinished.

EXP0031 adds engine/trajectories.py and integrates it in engine/motion.py/jobs.py.
Spatial cubic landmark paths are independent of a monotone temporal map. Existing
manual request.progress remains spatial progress; request_at_time explicitly
evaluates clock_time and stores both, refusing mismatched declared progress. Target
hold remains a separately declared interval, guarded by existing artist-key rules.
No automatic mapping of normalized clock to shot slots is claimed. Straight legacy
guides retain exact geometry. Source/target path endpoints remain exact. Existing correspondence controls preserve
independent path/clock/contact settings unless explicitly cleared; edits cannot
silently erase them. Incompatible changed endpoints require explicit path repair.

Up to16landmark paths,1..8segments/path,1..16clock segments and32explicit contact
intervals. Clock knots permit holds and independently controlled accelerations.
Cubic easing evaluates y after inverting x by bounded bisection. Only bounded
monotone0..1subset; no full CSS/SVG conformance, automatic overshoot or smear claim.
Explicit point-contact intervals must match the path continuously: overlapping
cubic segments must have constant control points. Endpoint coincidence with an
interior bulge refuses. Contact/release can be represented by separate segments.
These constrain supplied landmarks, not inferred feet/surfaces/anatomy or exact
resampled contact pixels. Shape change remains determined by existing point MLS;
independent shape-change controls/semantic correspondence/new surfaces remain open.

The same evaluated qfield drives artwork, region masks, domains, seeds/barriers and
later region revision. Existing source/correction/undo/accept/recompute/epoch/lock/
cancel protections remain. Path/clock/contact edits retain source-bound control
history (capacity128) separately from rejected-match history. Worker manifests
include exact method source IDs and request clock provenance. Edit then undo remains
stale. Saves/reopens preserve parameters/history exactly. Selected host/UI files
are unchanged; curve/contact/timing authoring is API/persistent JSON at this stage,
not a new GUI editor. Host controls require an updated CREDITS extension proof.

Actual animation75/78/81: NEW private study selects a complete small raster pair
(visually the mouth),6source raster assets/3joint actor states at2560x1440/24fps.
Both exact native planes and the complete original selected-window .aaa are retained;
original layer locks/document are not unlocked/modified. New study copies are
editable. Developer bounding-box correspondences use75/81endpoints; a fixed6px
arc offset is a developer hypothesis. Native78is excluded from numerical guide
construction, used for evaluation; this is not a blinded held-out dataset/study.
RAW composition only, no native effects. Full-character context previews also retain the75body outside the selected pair,
so they are not generated full-character in-betweens. Full character bbox exceeds
current256square motion ROI; do not substitute this small feature for solved pose animation.

Compared with actual78crop, hold alphaIoU0.469117/RGBpremult-error9.091117;
straight0.573572/5.716486; arc-linear0.654158/4.480556;
arc-delayed0.608256/6.513840; arc-early0.367108/7.382879.
Changing timing changes progress0.5to0.194549or0.805451on the same spatial arc.
Shape still visibly differs from real78; no anatomy/identity/action/usefulness or
artist acceptance inferred from numeric improvement. Generated proposals remain
unapproved, on separate editable preview copies. True keys75/78/81remain exact.
Diagnostic clock0.5samples are staged in a COPY at slots1..2for inspectability;
that staging is not a claim that the predicted pose belongs at native76/77.
Four candidate copies exact-reopen and paint/undo without changing originals.
Budget2refuses because3required source actor states must survive; budget3is feasible
but its three heuristics have no freedom to remove a required state. No invented
strategy diversity or internal-compute savings; six raster assets != three poses.
Joint candidate-pool/budget preview before any dense acceptance remains NEXT.

Verification: final full334unit tests pass in211.257s, including9new trajectory checks;
earlier20focused trajectory+motion checks pass55.871s (before flat-derivative fix).
130product Python files AST-parse; exact final-source retained. Existing affected
motion/region/job/schedule tests run in the full suite. Independent easing oracle,
legacy equivalence, continuous contacts/release, invalid controls, history/reopen,
worker recomputation/source IDs and edit-undo staleness covered. Independent
curved-region oracle additionally verifies all3managed region masks AND regeneration
seeds translate by exact(1,-1), preventing an artwork-only path implementation.
Saved helper/report: curved_regions_check.py/curved-regions-check-02.json. All33original
samples full streamed SHA/size/mtime unchanged. Master and selected CREDITS/UI
source unchanged. 120APA references/full local notices; build/check, --credits
and selected host proof pass. No new visible Tk/native app/browser test.

Failures retained: flat-midpoint-derivative curve[1,0,0,1] at time0.5returned
0.499996392638169because continuing bisection after an exact floating match moved
into a rounding plateau. Stop on exact match; exact0.5regression retained. First
actual harness used unsupported event kind key_pose; corrected to supported custom
while preserving explicit required slots and failure log. No product event gate
weakened. Review found legacy correspondence forms omit new optional fields;
merge-preserve behavior and an explicit-clear/history regression were added before
the final334test run. Earlier333tests pass201.721s and remain retained. Primary Blender motion-path page returned402; unused, no purchase/bypass.

Research: W3C SVG2§9.3.6cubic endpoint/control semantics and CSS Easing1CRD
(February13,2023)§2.1/2.2.1time/progress inversion. Registered before trials.
Independent polynomial/bisection/control policy, no copied examples/figures or
upstream implementation. Existing cleared local Python3.13.1/NumPy2.4.1/Tk8.6.15;
no new runtime/model/download/training/art upload/distribution, paid compute,
public service/deploy, native editor/settings change, Git reset/commit, subagent,
other-chat message or unattended scheduler. Processing stays hidden.
