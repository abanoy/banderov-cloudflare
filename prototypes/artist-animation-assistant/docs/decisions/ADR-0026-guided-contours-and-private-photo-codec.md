# ADR0026: Explicit guided geometry and optional local photo preparation

Accepted scoped experiment.

# Guided contours and private photo preparation

Updated 2026-10-21 19:18 EDT. Full master/all20requirements remain ACTIVE and unfinished.

EXP0030 adds engine/guided_contours.py, scripts/study_guided_contours.py and an
optional scripts/decode_photo.py. The selected host/UI files remain byte-identical
to EXP0029. Headless CLI experiments only; no foreground app/browser/Tk launch.

Independent guide-ribbon second-order dynamic path search keeps supplied endpoints,
limits offset jumps and reports five alternatives: direct guide, pixel following,
regularized, stronger smoothing and explicit2.5px stroke-family support. Exact
equivalent geometry is labelled. Source pixels never change. The new transparent
one-pixel colored geometry is an unapproved separate paint layer, not reconstructed
pencil medium, native vector editing, semantic cleanup or recovered pen history.
Editable guide/path JSON is saved; no automatic acceptance/replacement. API<=512px
crop/1024samples/33offsets, CLI<=256pxROI, full source<=4096px; no raised host bounds.

Actual2992square photo preparation applies EXIF orientation6 and explicit embedded
ICC to sRGB relative-colorimetric conversion. Exact original JPEG/EXIF, source and
generated target ICC, original PNG preview and source hashes are retained/embedded.
No camera/paper/lighting calibration. Target ICC generation metadata can vary;
actual bytes/hash persist, not a cross-run bitwise-profile claim. Earlier exploratory
PNG declared intent0; final PNG declares1 matching chosen relative intent. Pixel
RGBA is exact between these retained runs; original JPEG is unchanged.

Existing desktop bundled Python3.12.14/Pillow12.3.0/libjpeg-turbo3.1.4.1/LittleCMS2.19.1
execute locally only after identity/license/notices registration. Core decoder,
color DLL and interpreter DLL are pinned by SHA. No download/install/upgrade,
runtime binary redistribution or distribution clearance. Full installed notices
and SBOM retained. Main application remains existing3.13.1/NumPy2.4.1/Tk8.6.15.
Current numerical docs2.5 do not change that installed runtime.

Three actual pencil ROIs (hair and two crossing sleeve branches), five alternatives
each, preserve original planes and exact editable .aaa reopen. Actual paint on a
proposal and one-action undo preserve source/originals. Guides are DEVELOPER HINTS,
not owner-reviewed intended contours. Curves were visually inspected as local crop
overlays, not OS screenshots or aesthetic acceptance. One sleeve regularized/smooth
pair coincides. No confidence/quality ranking inferred from raw support costs.
Dense construction rays/circles from earlier study are intentionality-unknown and
remain untouched; do not call them unwanted overdraw or claim improvement.

Synthetic identical-pixels counterexample: if two lines at29/33mean one intended
family center31, pixel/regularized/smooth MSE4; direct guide and bundle-center MSE1.
Bundle does not beat direct guide there. If those same lines are both intentional,
the bundle lies between legitimate detail. This is evidence AGAINST automatic
semantic adoption. Repeated-mark refinement, pressure/texture and general artist
usefulness remain open. All procedural/pretrained/adapted/custom neural routes
remain eligible. Learning-to-Simplify restrictive repository license differs from
page label; no model/runtime acquired/executed. StrokeStrip requires clustered
vectors and separately licensed Gurobi; no solver acquired/executed.

Verification: full324tests pass in180.059s; it started before the additive bundle
option/cusp check. Final9focused contour checks cover final contour code, including
exhaustive small-path optimality, source/endpoint/tube bounds, cancellation,
transparency, deterministic smoothing and paired-intent counterexample. Optional
codec3checks cover all8EXIForientations by independent coordinate permutations,
ICC retention/intent, CMYK/oversize/badEXIF/badprofile/output-exists refusal.
128Python files AST-parse. Exact final-source hashes retained. All33original
inputs (including actual animation) full streamed SHA/size/mtime unchanged; master
and selected CREDITS/UI host unchanged. 118APA references; build/check,
selected CREDITS proof and --credits pass. Supplemental NumPy API citations split
after initial trials; general NumPy component/reference was cleared beforehand.

Failures retained: first tagged-photo decode refused instead of dropping ICC;
explicit color handling added. Integer zero continuity produced integer transition
storage/Infinity error; floating storage fixed and regression retained. First study
harness called nonexistent Session.undo; corrected to travel() and drawing-content
comparison (monotonic epochs intentionally persist). Codec fixture emits getdata
deprecation warnings, not a product failure. Earlier outputs remain unchanged.

Private review: private-projects/owner-studies-exp30/index.html. Existing actual
animation samples/animation/full175visible-frame import and native RGB gap remain
as EXP0029; this increment does not alter or reclassify that evidence. No training,
art upload/distribution, compute purchase, public service/deployment, native editor
launch, settings change, Git reset/commit, subagent or unattended scheduler.

Decision: retain unapproved alternatives and exact medium-bearing source; never erase crossing/construction marks automatically. No semantic cleanup or general artist quality acceptance. Broader methods remain available.
