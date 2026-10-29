**Latest owner-requested rebuild (2026-10-10):** [Rebuilt chibi8 and integration notes](rebuild/README.md), [new workshop](rebuild/index.html). The preceding renderer and its saved studies remain preserved. The notes below describe that earlier implementation; use the rebuild guide for the new paper construction.

# Current renderer handoff — 2026-10-08

Start here. README retains the development history; earlier projection and Bézier
instructions describe superseded experiments. This is an isolated local art study,
not an integrated game asset or an approved likeness.

Latest mouths: `headBasis.expressionMouths.confused/delusional[0..7]` holds
independent records `{width,height,offsetY,boundary}`. Boundary has eight XY
landmarks around the opening, normalized near-1..1. Width multiplies the authored
mouth anchor half-width; height and offset use fixed-aspect glyph units. Keep
the same point order/count in all eight slots for fractional interpolation.
Rear records collapse to zero. Omit the whole field for the earlier oval mouths.
`outfits.whiteBlouse.expressionMouthOffsets.delusional:-5` gives that head's grin
chin clearance. Circle/rebuilt face/`circleFaceTurn` scope only. Existing face and
hair clips still own visibility; opposite profiles have their own arrays.
The raised front corner interprets the2023 chibi sketch, not confirmed canon.

Current checker: `research/check-expression-mouths.cjs`. Earlier iris-only
whole-image preservation tests describe their preceding source stage; retain
their assertions as historical checks. Actual saved current sailor expression:
`review/saved-expression-mouth-study.json`; verify with
`research/check-saved-expression-mouth-study.cjs`. Its eight SVGs plus selected
SVG reproduce exactly; it is a review snapshot, not a substitute for chibi8.js.
Source backup: `research/chibi8-before-expression-mouths.js`. Current six-by-eight
expression sheets are refreshed and remain selectable in the Reference desk.
Left emergence still exposes a small skin patch in close samples; fix its own
face-cover geometry rather than reflecting the right view.

Current acting-state pupil rule: `headBasis.expressionIris:true` reuses each
anatomical `neutralIris` record for Stare/Confused/Delusional in the rebuilt circle
with `circleFaceTurn`. The original neutral face, Happy and blank Teaser Shocked
drawings stay exact. Missing field preserves older generic acting-state pupils.
Only iris ellipses change, not eye clipping or expression mouths. Current check:
`research/check-expression-iris.cjs`; six-by-eight code sheets for both outfits
are now in the Reference desk. Re-render them with
`node .\prototypes\donbass-art\research\current-expression-directions.cjs`
after future art changes. The sketches guide expression ideas; unseen views and
the adaptation remain provisional. These sheets are renderer output, not originals.

Latest face placement: optional sailor `faceLift:-8` moves circle-local facial
features and matching lower fringe upward. High attachment vertices2 and8 remain
fixed in each authored fringe; profile circular bend overrides move with the
lower boundary. Source coordinates account for the circle's vertical scale.
Head100% controls, skin/ear footprint, side-lock placement, body/collar and flat
materials remain unchanged. Missing field preserves earlier placement exactly;
Previous face and other outfits retain their placement. Current checker:
`research/check-sailor-face-lift.cjs`; frozen before/after study:
`review/sailor-face-lift-comparison.png`. This intentionally updates principal
sailor faces as well as fractional views. Earlier exact-principal claims describe
the prior curved-cover stage, not this face-placement refinement.

Latest right-to-back turn: Brown `headBasis.curvedFaceRetreat:true` retains the
right profile's own skin/ear and circle-local face landmarks behind a moving
native elliptical hair cover. `faceRetreat.start/span` still controls timing.
This affects only fractional views in that sector, with round-circle/rebuilt
face and `circleFaceTurn` enabled. Omit the field to restore preceding drawings
exactly. Principal views stay unchanged; left emergence retains its own rule.
The cover is inferred art geometry, not a canonical turnaround. Inspect the
one-degree sailor/blouse neutral/shocked board `review/curved-cover-close-turn.png`
and `research/check-curved-face-retreat.cjs`. Backup:
`research/chibi8-before-curved-face-retreat.js`. Frozen shrinking-face and
rectangular-window research are rejected alternatives. See CURRENT-STUDY.

Current turn correction: Brown `headBasis.shortLockRetreatSector:7` retires the
short lock toward its own rim in the first half-sector and grows the separately
authored frontal lock from its own rim in the second half. The collapse point
lies beyond the endpoint's circular rim, preventing a floating cheek dot. This
applies to round-circle/rebuilt-face/`circleFaceTurn` drawings; omitted field
retains the old interpolation. All eight principal views remain exact. See
`research/short-lock-edge-turn-review.cjs` and its enlarged/native64 comparison
plus72-angle turn sheet. This is a rendering correction, not likeness approval.
The softer sweep and solid-lock-mask experiments are frozen inactive research.
The preceding eyelid/semantic-leaf helpers' whole-image preservation assertions
describe their earlier source stage after this intentional intermediate-lock
change. Keep those assertions intact; the short-lock helper is the current
before/after check. Current export/parameter and older saved-study checks pass.

## Run and inspect

From the cloudflare workspace root, in PowerShell:

```powershell
node .\prototypes\donbass-art\server.cjs
```

Reuse the existing server if port 8791 is already serving this prototype.
The server binds only to 127.0.0.1 and serves this directory.

- Workshop: http://127.0.0.1:8791/ — characters, original reference comparison,
  eight principal views, fractional turns, enlarged inspection and native sizes.
- Courtyard: http://127.0.0.1:8791/movement.html — WASD/arrows and direction pad,
  eight-way facing, optional intermediate views and simple alternating feet.
- Fixed-camera size comparison: research/movement-fixed-camera.html.

The workshop's Paper step selector freezes the four existing movement phases.
Courtyard size includes SVG padding; a 32px texture is not a 32px visible figure.
The main courtyard size control also changes scene zoom. The fixed-camera study
holds the scene camera still. MOVEMENT.md covers local Three.js provenance and
controls. These previews do not establish performance or lighting in the live game.

Actual keyboard walks now cover all eight directions/four phases each; see
MOVEMENT.md and review/keyboard-eight-live-walks.png/records. Both courtyard
adapters use a40ms heading settle during continued movement to preserve diagonal
facing across staggered key release. Fresh movement and position respond
immediately. This helper is prototype input behaviour, not renderer geometry;
reuse only if appropriate to the game's controls. No complete auto-demo proof.

## Editable source and minimal call

### Save a selected workshop study

Click **Save this study** in the workshop to download a local JSON record. It
contains the effective character parameters, full editable geometry, eight
principal SVGs and the currently selected angle/SVG. Pose, expression, body/head
width, ink and frozen paper-step phase are captured. Reference pictures and
inspection-only guides/cropping are excluded. Supported modes are current brown
sailor/blouse/sketch and teal; historical renderers and the wizard are disabled.

The record is review-only and requires the compatible `src/chibi8.js` engine;
it does not embed engine code or guarantee a source hash. Keep the matching
prototype source beside it. Treat these as trusted local settings, not a public
upload format. After loading the source as a classic script, reproduce a view:

```javascript
const svg = chibi8SVG(savedStudy.character, savedStudy.selected.degrees / 45);
```

`review/saved-workshop-study.json` is an actual browser download of the90% sailor
trial, not a changed default. Its nine stored SVGs matched current code exactly
after normalizing generated IDs. `research/check-saved-study.cjs` verifies that
particular captured example and renders its saved eight SVGs to
`review/saved-workshop-study.png` at240/64px. The example check intentionally
expects the captured90% settings; it is not a generic upload validator.

`src/chibi8.js` is the source of truth. Load it as a classic script; its lexical
globals are `chibi8SVG`, `STUDY_CHARS`, `BROWN_MARIA_GEOMETRY` and
`TEAL_MARIA_GEOMETRY`. They are not ES-module exports or window properties.

```javascript
const character = {
  ...STUDY_CHARS.mariaBrown,
  outfit: 'sailor',
  paint: 'flat', pose: 'relaxed', expression: 'neutral', walkPhase: 0
};
const svg = chibi8SVG(character, 2); // right profile, 90 degrees
```

**Set the outfit explicitly.** The brown source default without `outfit` retains
the earlier scarf/skirt study. The workshop defaults to the referenced sailor.
`whiteBlouse` selects the Teaser outfit; `sketch` selects the earlier body.

The second argument is degrees / 45: 0 front, 1 front-right, 2 right,
3 back-right, 4 back, 5 back-left, 6 left, 7 front-left. Signed, wrapped and
fractional values work. Returned SVG declares its actual viewBox and
`data-foot-y`; read both. Nominal foot anchors are sailor 212, blouse 217.8,
earlier body/teal 234. Ink extends below these anchors.

## Construction and extension

Sailor `circularFringeSweep:true` now constructs the central strand with two
native circular arcs through semantic points4/5/6 and6/7/8 of each independently
authored fringeEdge. The plateau, outer fringe and pointed tip keep their own
landmarks. Fill, fringe ink and all hair ownership clips share the same contour.
`circularSweepBends:{'2':[122,94],'6':[96,96]}` authors the two profile inner bends
independently to avoid excessive curl; neighbouring views interpolate toward
them. Only rebuilt circular/circleFaceTurn sailor drawings use this extension.
Missing circularFringeSweep preserves preceding SVGs exactly. Circumcircle
helper is also used by the native leaf; no Bezier or raster input is introduced.
Comparison/native64: review/circular-fringe-sweep-comparison.png;72five-degree
turn: review/circular-fringe-sweep-full-turn.png.
research/circular-fringe-sweep-review.cjs is the current before/after
check. My judgment: more fluid front, reduced profile curl after correction;
overall resemblance and hidden-side interpretation remain for owner review.
Earlier lower-eye/short-lock helpers' full-image comparisons are historical
after this intentional hair change; preserve their assertions.

Brown `paperEyeOpening:0.84` deepens the lower white opening beneath the neutral
upper lid. Upper-lid path/weight and iris anchors/geometry stay exact; lower white
and its clip, brow curvature and outer corner adjust with the eye depth. This
character override applies only to rebuilt circular neutral eyes. Missing field
uses the geometry's earlier0.68 opening, so older study downloads reproduce.
See research/deeper-neutral-opening-review.cjs and the0.68/0.76/0.84 five-view
inspection sheet review/neutral-lower-opening-study.png. The reference-aligned
head board and actual enlarged/native browser screenshots were inspected.
My judgment is closer to the original white/blue exposure; owner approval remains
pending. Earlier short-lock helper whole-image comparisons are now historical
after this intentional face change; retain their assertions.

Brown `circleSleepyLids:true` makes the rebuilt round-circle neutral eye's upper
edge a shallow downward circular arc. `headBasis.faceStyle.lidDip:[0.08,0.065]`
sets each anatomical eye's sag as a fraction of its half-width. Iris geometry,
corners, endpoints and lower eye boundary stay fixed; the white eye shape/iris
clip share the upper arc, preserving the heavy1.45 ink and0.68 opening.
False/omitted flag exactly preserves preceding straight paper lids. Other
expressions/characters and Previous face are unchanged. Workshop **Neutral
eyelids** selects Gentle droop or Previous straight lids and saves that effective
flag in study downloads. It is enabled for neutral brown/current circular face.
`drooping-paper-lids-review.cjs` checks1024 disabled-flag drawings and208 other
expression/character outputs; comparison PNG includes enlarged facial crops,
96px before/current and64px current samples. Those were displayed/inspected.
No new border/device/performance proof from this face pass; aesthetic feedback
is pending. Older saved study without flag still reproduces its original SVGs.

Character `bodyScaleX` defaults to1. Workshop Body width offers80–100% for brown
Maria; it changes body landmarks around each authored torso centre without
scaling ink weight, head drawing or vertical foot registration. It also maps
ellipse radii and manual garment arcs, so shirt details share the body width.
Narrowing changes foot width and arm reach, not foot height. Tested0.8/0.9/1,
including fractional views and poses; wider bodies require their own bounds review.
The courtyard/export defaults remain100%; both courtyard pages now offer their
own80–100% width control for movement inspection. Release it and wait for Ready
as textures rebuild. Captures record width. The body-width reference-desk study
compares three trials at equal head width and24 native64 views; hidden anatomy
remains inferred. Source: research/sailor-body-width-study.cjs and check-body-width.cjs.

Sailor sleeve records now include `trimEdge`, a four-point internal navy strip
along each pale sleeve wedge's inner edge. Each side is authored independently
in all eight views. Missing `trimEdge` falls back to the older `trim` shape.
The strip adds no white silhouette. Eight `sailorTop` contours expose the wedges
and taper gently under the arms; front-fold endpoints stay inside the shirt.
Side/rear continuation is inferred. The selected bodyOffset14 and foot212 remain.
See research/sailor-sleeve-review.cjs and review/sailor-sleeve-comparison.png.

Sailor `poseSleeveTrim:[0.18,0.48,2.6]` carries a small navy band into crossed-arm
and speaking gestures. Values are start/end fractions of the independently
authored shoulder-to-elbow segment and half-width in mapped renderer units.
The band is internal colour with no silhouette stroke; it follows body mapping
and stays within the bare arm's fixed width. Hidden-side continuation is inferred.
Omit the field for exact earlier pose drawings. Resting/alarmed and other outfits
are unchanged. See `review/sailor-pose-trim-study.png` (before/current body crops,
96px full sprites and48px native samples) and `research/check-sailor-pose-trim.cjs`.
At32px the prior raster already has faint filter alpha at some bounds; this pass
proves unchanged edge alpha there, not full transparency.64/256px tested edges
are transparent. Tiny trim is still subtle; these checks do not establish likeness.

Sailor `crossedGeometry:true` selects eight independent `views[].sailorCrossed`
records (`right`, `left` shoulder/elbow/wrist lines; two `palms`; front `coverage`).
The compact lower arm fold leaves the collar clearer and uses the existing
rear/body/front clipped drawing order. Rear records hide the front redraw;
fractional records interpolate their own landmarks/coverage. Omit the outfit
flag to reproduce the preceding crossed pose exactly. Resting, speaking,
alarmed and other outfits remain unchanged. Gesture anatomy is inferred.
Before/current enlarged/96px/native48 samples are in
`review/sailor-crossed-rebuild-study.png`; focused verification is
`research/check-sailor-crossed-rebuild.cjs`. The earlier pose-trim whole-output
test is historical after this intentional arm change; its assertions are retained.

### Rejected circular tuft experiment

`research/chibi8-sailor-tuft-arcs-trial.js` is an inactive experiment. It replaces
the sailor leaf's polygon edges with native circumcircle arcs through authored
points. Front/rear arcs soften the leaf, but they jump at135/315 because existing
`paperBoundaryMatch` rotates polygon vertices during turns. Arc endpoints need
semantic root/tip/bend correspondence, which a cyclic polygon permutation cannot
preserve. Do not copy this trial into game code. The polygon renderer was restored
at that checkpoint; the semantic method below now supersedes it for sailor.
`tuft-arc-boundary-diagnosis.cjs` reproduces the
problem against the frozen before source; PNG/JSON are under review. At100px
crown-crop scale,134.99→135 changed855 pixels in trial vs247 in baseline;
314.99→315 changed987 vs232. Counts include the entire crown crop, not just
tuft or a likeness score. A future curved tuft should have eight separately
authored semantic root/outer-bend/tip/inner-bend records with consistent order.

### Current semantic curved leaf

Sailor outfit `leafViews` now contains eight independent20-number records:
base, outer root, outer bend, spare outer point, tip, spare inner point, inner
bend, notch, stem bend, base return. `leafInbetweens` supplies112.5 and292.5°
records using the same order. These interpolate without cyclic vertex matching.
Only outer root/bend/tip and tip/inner bend/notch construct the native circle
arcs; the stem stays straight. Spare points retain the20-number editing layout.
Collinear points fall back to straight segments. No Bézier controls or shading.
Omitting `leafViews` exactly restores preceding polygon drawings, including
older saved JSON; blouse/scarf/teal are unchanged. The circle/head face and body
are unchanged apart from tuft colour and its white underlay. Hidden planes remain
inferred; near-edge-on intermediate leaves become thin and need owner review.

`research/semantic-leaf-review.cjs` verifies1536 only-tuft/missing-field cases,
176 other drawings and144 transparent64/256px border samples; it creates
`review/semantic-leaf-full-turn.png` with72 five-degree crown views. Full sheet
was displayed and inspected. Final boundary crop changed208/200 pixels near
135/315 vs247/232 polygon baseline, eliminating the earlier855/987 trial jumps.
Counts include other crown pixels and are not a smoothness or likeness score.
See semantic-leaf-boundary-diagnosis PNG/JSON. No new32px transparency claim.

Sailor `collarInsideTop:true` clips neckline, front collar/tie, front folds and
rear flap to the independently authored shirt contour, including their underlays.
Missing/false preserves the earlier drawing. Eight `sailorCollarDepth` slots are
1 on front/quarter/profile views and 0 on rear views. Fractional interpolation
shortens front neckline/collar/tie toward source y141 as they turn behind; it
does not change principal-view depth. Rear/side continuation remains inferred.
Comparison: review/sailor-collar-containment.png; check: research/check-collar-containment.cjs.

Sailor `shirtCorners:0.48` uses tangent circular fillets at the same shirt landmarks
for a softer cloth edge. The collar clip uses that same contour. Missing restores
the prior0.25 corner fraction; other outfits retain0.25. This does not resize the
shirt or alter sleeve/foot/head shapes. Review: review/sailor-shirt-softening.png.

Current schema: `paper-xy-v1`; drawing style: `primitive-sticker-v3`.
Eight independent screen-XY view records define silhouette, feature positions,
costume and layer visibility. Opposite finished images are not mirrored.
Fractional turns interpolate corresponding landmarks, with explicit coverage and
drawing order. Rear directions do not receive frontal eyes or costume details.

The head uses a native circular basis. Ellipses, straight segments and circular
SVG A fillets construct the flat cutout; no Bézier drawing commands, gradients
or bitmap character artwork are used. The white head rim belongs to the complete
circle; internal pieces are clipped. Tuft, visible ear and body retain their own
underlays. Brown `circleRimInk:true` draws the white disc and final circle ink in
normalized head coordinates, giving the circular rim a fixed renderer-unit weight
through turns and custom head scales. Interior ink, ear and tuft retain their
existing transforms. SVG viewport scaling still affects all strokes; this is not
a constant CSS-pixel outline or a claim that every hair stroke has uniform weight.

Brown circle-local `headBasis` contains eight face slots, heavy-lid settings,
profile shocked-mouth centres, long-lock placement/visibility and provisional
rear strand paths. Left near lock moves back to preserve the clear cheek; right
far lock has independent visibility. PRIMITIVE-GEOMETRY.md explains the fields.

To extend, copy an appropriate geometry record, author all eight views and supply
`geometry` explicitly on a character record. Keep matching landmark counts for
interpolation; review each side's feature identity, overlap and layer order.
Do not infer that reflecting a finished drawing preserves anatomy or costume.
The experimental greybox wizard has not had a fresh full acceptance pass.

Current brown options `rearHairLines`, `circleFaceTurn`, `circularBorder`,
`circleRimInk` are true
in STUDY_CHARS. Missing/false flags retain prior behavior for older hand-built
records. `faceForm: 'previous'` preserves the preceding face for comparison;
older head forms remain selectable. `circleRimInk` requires the new circular face
and `circularBorder`; false restores the preceding transformed rim. Width and
height remain 1 / 1 (100%).

Poses: relaxed, crossed, explain, alarmed. Expressions: neutral, happy, stare,
shocked, confused, delusional. Brown alarmed acting borrows Teaser construction.
`walkPhase` is a cycle fraction: 0/.5 resting, .25 first foot lifted, .75 second
foot lifted. Only feet move; this is a draft gait, not a complete walking rig.
Parameters are trusted local inputs, not a validated public upload format.

Owner requested more collar and sleeves beneath the round head. Sailor
`bodyOffset:14` moves the existing short body down in every view, keeping
`bodyScale:0.6` and the head geometry. Zero restores the tucked-under placement.
The foot anchor and texture height change accordingly; alarmed head registration
follows its existing foot-anchored lean. All other outfits default to offset zero.
Sailor `frontFolds:true` uses two shallow A arcs from each view's
`sailorFrontFolds` slots, at `frontFoldInk:0.65`. Exact profiles/rear slots collapse
the folds; quarter-view continuation is inferred. False omits the new folds.

## Reproducible review exports

```powershell
node .\prototypes\donbass-art\export-review.cjs
node .\prototypes\donbass-art\research\check-outfit-export.cjs
node .\prototypes\donbass-art\research\check-parameter-export.cjs
```

- `review-svg/manifest.json`: 16 default-character views (brown earlier costume,
  teal provisional), preserving previous export semantics.
- `review-svg/outfit-manifest.json`: 16 explicit brown sailor/blouse resting views,
  with each outfit, angle, bounds and foot anchor recorded.
- `review-svg/outfits/`: saved vectors for those two reference outfits.
- `review-svg/character-parameters.json`: generated geometry snapshot and source
  SHA256. Regenerate after source changes; never edit it as a second source.

Review PNGs are rasterized from editable code. Historical research helpers may
assert exact output from a preceding method and remain diagnostic history;
read their baseline before running them against a newer renderer.

## Reference status and eventual integration

Owner choices: brown 2018 Maria first, separate teal Maria, flat colours, round
circle, 100% head scales, heavy sleepy lids, clear cheek with lock farther back,
white outer stroke and eight distinct flat views. Owner has final aesthetic call.

NewCanvas3 supports sailor/front construction; Teaser supports blouse and alarmed
expression. TheTwoMarias supplies brown/blue palette context. The olive sailor
reference is not a replacement canon palette. Original side sketches and older
Touhou-era art provide style context. Unseen rear costume/hair details and turn
geometry are provisional; teal is also provisional. Prior book and Project Ovi
notes distinguish canon from discussion; selected novel passages were consulted,
not the whole manuscript. Original references are preserved. The workspace folder
is named `handoff`, rather than the requested `handout`.

Any image-model experiments stay under internal research and are never read by
the renderer or used as final assets. Final geometry is editable code.

For a future authorized game integration, use this source and explicit settings,
maintain common world-unit scale and foot anchors, generate/cache texture frames
from SVG, and decide how the game's lighting acts on the flat palette. Current
Three.js sprites use unlit materials. Check native game sizes and all eight
facings in the actual game before acceptance. Nothing here changes the live game,
backend, portfolio or deployment configuration. No integration or publication
has been performed; deployment requires explicit owner authorization.

Left-turn continuation (2026-10-08): optional headBasis.curvedFaceReveal is
{radius:1.45,prepareEnd:0.65}. It prepares view6's own fringe/rear-strand endpoints
with a smoothstep before faceReveal begins, then reveals its full-size profile
anatomy under a moving native circular cover. Only225–270 fractional angles
change; all eight principal SVGs remain exact. Missing this whole field restores
preceding turn behavior exactly. Keep independent views2/6, existing long-lock
placement and other geometry. Current check: node research/check-curved-face-reveal.cjs.
Its 20736 missing-field/finite samples and368 border samples are technical checks,
not likeness or perfect-continuity metrics. Earlier stage-specific mouth-only
assertions now describe their frozen preceding source, not the whole new drawing.
Current exports and both actual saved-study records still reproduce exactly.
Run curved-face-reveal-comparison.cjs for96 before/current enlarged heads plus
96 native32/96 native64 samples. Frozen full-cap/morphed-cap trial sources are
rejected research evidence; use src/chibi8.js for the current editable renderer.

Workshop body close-up (2026-10-08): “Focus on collar and body” changes only
inspection framing, keeps real head overlap and is mutually exclusive with head
focus. Current Brown renderer only; acting poses retain full horizontal bounds.
Its UI setting is intentionally absent from character parameters/saved study
SVGs. All eight views and gameplay samples remain full sprites. Current body
pose sheet is selectable in the Reference desk, with explicit code provenance.
Run research/current-sailor-body-poses.cjs after source changes to refresh it.
Profile speaking-hand overlap remains an aesthetic issue for the next review.

Sailor speaking override (2026-10-08): outfit.speakingViews[0..7] has optional
{elbow,wrist,palm,crease} records in existing body XY coordinates. Null falls
back to geometry.views[index].speaking. Slots2/6 are authored separately to put
raised hands forward beside their own collars. Other poses/outfits stay exact;
missing whole field preserves preceding speaking output. Inspect intermediate
angles as well as native sprites; these side gestures are inferred, not canon.
Current verification: research/check-sailor-speaking-profiles.cjs; actual saved
270° study: research/check-saved-speaking-profile-study.cjs. Prior stage-specific
left-emergence full-image test is historical after intentional speaking-body
changes; retain its assertions. Current speaking-head comparison verifies head
geometry unchanged across72 sampled angles/six expressions. Review record and
export files remain review-only; no integration performed.

Current speaking palms (2026-10-08): profile slots2/6 use broader independent
mitten boundaries with20 XY values each. Same reaches/other hand slots and all
runtime drawing order retained. Foreground-arm experiment is rejected/inactive;
its frozen comparison helper/source are research only. Current hand comparison
helpers: sailor-speaking-mitten-detail.cjs and sailor-speaking-mitten-comparison.cjs.
Current saved default study: check-saved-speaking-mitten-study.cjs. Existing
speaking-profile checker remains applicable and passed after the data change.
Reference identity checks now read owner root references/drive/oddities instead
of missing former Downloads paths; strict hash equality to preserved local
originals is retained. Update those explicit inspection paths on another machine.

Finished brown Maria review (2026-10-08): current-finished-maria-review.cjs
renders the unchanged original head crop beside current Sailor neutral,
historical scarf neutral, and Sailor stare, plus nine native32/64/96 sprites.
It checks original copy identity, source stability and exact raster heights;
writes PNG and SHA256 provenance JSON. Enlarged code view framing was corrected
after the first inspected PNG clipped tuft tips; final PNG displayed/scrutinized.
This is a visual comparison, not proportion fitting or a likeness score.
The painted original has a tilted eye line and bent nose, while the shared
current face uses the round base and simple pout supported by NewCanvas3.
Those reference differences do not establish an owner-approved face change.
No renderer geometry or default was changed. Historical head-reference-study
uses old projected anchors and should not be used as a current fitting metric.
Workshop Reference desk now offers the finished/current comparison, explicitly
labelled as mixed original pixels and code adaptation. Browser image loaded;
8 principal/16 intermediate views and12/32/48/64/96/124 CSS heights verified.
Screenshot: review/finished-maria-review-browser.png. No new motion test here.
Run from prototype directory: node research/current-finished-maria-review.cjs.
Longer sailor bang (2026-10-08): retained fringeEdge Y indices11/13/15 deltas
in own slots0[4,8,3],1[4,7,3],2[2,3,1],6[2,4,1],7[4,7,3].
Roots, round head100%/100%, face/lids, body/collar/feet/palette/order unchanged.
Native circular sweep renderer unchanged. Rear slots3/4/5 untouched; side
continuations inferred. Frozen before: chibi8-before-longer-sailor-bang.js.
sailor-central-bang-study.cjs reproduces16 before/retained heads and48
native32/64/96 sprites with provenance. sailor-central-bang-turn.cjs renders
32 current Neutral/Shocked heads and32 native32/32 native64 samples.
Both PNGs actually displayed/scrutinized. My judgment longer bang closer,
native32 effect subtle; owner aesthetic approval pending.
One-off5-degree check:8640 unaffectedSVGs exact;10368 finite primitiveSVGs.
Export refreshed;16 outfit and504+504 parameter round trips pass. Actual
older saved mitten record9SVGs reproduces with its own older geometry.
Earlier whole-image speaking-only check is historical after this head edit.
Current sourceSHA3259b71fb37a64203da603380a9d3b307fa4ea8829e12b7a396c5ce91321460f.
Browser longer-sailor-bang-browser.png shows unchanged frontal original1x.
Exact12/32/48/64/96/124 CSS heights and8/16 views; courtyards Ready8/foursteps.
No new movement-input/device/backend validation or owner-approved turnaround.
Far-eye depth turns (2026-10-08): optional headBasis.farEyeDepthTurns has
sector1 eye1/reversefalse and sector6 eye0/reversetrue. With rebuilt circular
face/continuous turns, only that far eye's depth follows1-t or t; its authored
width already narrows. No opacity fades or reflected view. Happy lids unchanged.
All eight principal drawings are exact; missing field restores older outputs.
Before source: research/chibi8-before-far-eye-depth.js.
Run node research/check-far-eye-depth.cjs:1152 principalSVGs exact,5184
missing-field restores exact,9408 unaffectedSVGs exact,10368 finite native
primitiveSVGs at5-degree samples. This is compatibility/scope, not likeness.
far-eye-depth-comparison.cjs renders96 before/current heads plus96 native32
and96 native64 samples for Sailor/Blouse Neutral/Shocked; actually inspected.
My judgment: less vertical far-eye sliver, subtle at gameplay sizes. Profile
anatomy remains inferred; no owner approval or full continuity metric.
Current sourceSHA4f130af902e7de18f1557fb2093f7448af8d7395d6daf3304731d3d618da8704.
Actual saved-far-eye-depth-study.json captures67.5/Sailor/Neutral, current rule;
one-offVM check reproduces eight principalSVGs and selectedSVG exactly.
Older saved records retain their own geometry and omission compatibility.
Export and current comparison/body/expression boards refreshed; outfit16 and
504+504 parameter checks pass. Earlier longer-bang comparison is a frozen
checkpoint; its alternative predates this turning rule, not current turn proof.
Browser screenshots far-eye-depth-browser.png and far-eye-depth-native-browser.png.
Native12/32/48/64/96/124 CSS heights inspected; courtyard/fixed reloads Ready8/
foursteps. No new movement-input/device/backend check. Original files intact.
Brighter brown iris (2026-10-08): Brown STUDY_CHARS iris now#428ff0 from
#598add. Only this solid fill changed; no geometry, painted shine, shading or
new palette canon. Teal iris unchanged. Frozen source before-brighter-iris.
iris-palette-study.cjs uses that frozen source for explicit previous/retained/
cyan alternatives,12 head crops and36 native32/64/96 sprites beside original
painted head crop. First board had cramped row labels; corrected spacing and
displayed/scrutinized final1150px-high board. Two hand-selected iris regions
filtered for blue pixels yielded painted medianRGB[89,147,249] and[67,135,250].
These include shading; not exact flat-base extraction or a Krita layer claim.
My judgment retained brighter blue closer than cyan trial; owner approval pending.
Current sourceSHA7d2837f51c02077f26cea0b175ab15fbbcd125d73d5c10406df093d49e5cdebd.
One-off five-degree scope check:5184 BrownSVGs differ only by iris fill and
restore exactly with iris:'#598add';5184 TealSVGs exact;10368 finite/no-gradient.
Root export0, outfit16 and504+504 parameter checks pass. Current comparison/
body/expression/two-outfit boards refreshed. Older far-eye whole-image checker
is historical after intentional default-colour change; assertions not weakened.
Workshop Reference desk offers original/flat-blue comparison with truthful
paint-sample provenance. Browser front iris fill#428ff0 twice, exact12–124px
height series,8/16 directions; palette board loaded1500x1150.
Screenshot brighter-iris-browser.png actually displayed; enlarged reference
remains painted/tilted, not frontal or profile canon. Both courtyards refreshed/
Ready8/foursteps. No new movement-input/device/backend or global likeness proof.
Step preview (2026-10-08): main/fixed courtyards now expose Live movement,
Resting, First foot lifted, Feet down/middle, Second foot lifted. Live remains
default; frozen choices reuse four existing SVG-derived cached textures and
do not stop position movement. Paper steps off disables selector/forces rest;
capture caption correctly says Resting (paper steps off) regardless of stored
choice. No renderer geometry/colour/foot-lift amplitude changed.
Actual main front4 captured937x446 PNGs and DOM records retained. Source foot
groups/bounds/anchors match; resting/middle images identical. Only foot-area
pixels change for lifted states:59 at460,215,10x8 and58 at467,215,10x8.
check-step-preview-captures.cjs reproduces contact board/provenance and verifies
16 actual idle observations (each lifted foot in8facings) against source groups.
contact-board native crops +3x nearest enlargement inspected; not an animated
walk recording. Fixed-camera UI all4/restoredLive and off-state caption checked.
One800ms d-key hold after Live restored moved x2.015/z0 and settledRight90/idle.
No timed speed/all-direction-input/full live phase/device test claimed.
Both script syntax0; existing movement math40 camera/input/wrap/collision cases0.
Renderer source remains7d2837f51c02077f26cea0b175ab15fbbcd125d73d5c10406df093d49e5cdebd.
Evidence: step-preview-controls-browser.png, step-preview-contact-board.png,
step-preview-front-records.json, step-preview-eight-facings.json, contact-check
JSON, fixed-records JSON and step-preview-live-right.png. Prototype only.
My judgment: subtle paper foot lift, body/head stable, full rig still a draft.
Use Live movement after inspection to restore normal animation. The control is
inspection UI; integration still passes walkPhase fractions to chibi8SVG.
Body white border (2026-10-08): optional character.bodyWhiteBorder overrides
white underlay thickness only for body paths/ellipses. Brown default4 versus
whiteBorder6 head/general fallback. Existing black ink is added to both sides:
body underlay stroke=inkWidth+2*4; head keeps inkWidth+2*6. whiteBorder0 still
turns off white silhouettes; omitted body override restores old full outputs.
Colour-art geometry, both-sided authored views, foot anchors/bounds unchanged.
Before source: chibi8-before-body-white-border.js. body-white-border-study
renders24 cropped bodies/48 native32/64 sprites for2outfits/4directions/rims6/4/3
beside unchanged Idols construction reference, with SHA provenance.
First row-label spacing tightened awkwardly; expanded spacing/finalPNG inspected.
Current body-pose32 crop/32 native32/32 native64 sheet also inspected.
check-body-white-border.cjs:10368 unchanged colour-art SVGs/stable bounds+anchors,
5184 unchangedTeal,5184 omitted-override exact restores. Source syntax0.
SourceSHA4d5193972985317b3b5c6cd63639c87722fe577ede4fa673397789ddd9e562cd.
Export/outfit16/504+504 parameter checks0, older saved-mitten9SVG record0.
Actual new browser saved-body-white-border-study.json records body4/head6;
one-offVM reproduces8 principal+selectedSVG exact. Current browser body-focus
beside original sailor1x and courtyard front captured/displayed. Native12–124
height series and8/16 counts checked; both courtyard reloads Ready8/foursteps.
Earlier frozen-step screenshots are historical body6. Their checker now loads
frozen capture-time source, retaining all assertions and honest7d2837 source
provenance, rather than assigning newer defaults to older pixels. Re-run passes.
No new walking-input/full-step/device/backend test in this border pass.
My judgment medium body rim retains sticker contrast with less white around
sleeves/feet; final resemblance remains owner's call. No AI pixels/deployment.
### Sleepy eye-opening comparison (2026-10-08)
Owner's exposed collar/sleeves, round100%/100% head and current renderer retained.
Research/sleepy-eye-opening-study.cjs renders current .84/.6, narrower .74/.52,
and deeper1.05/.75 opening/iris-depth parameter alternatives. Heavy upper-lid
anchors/droop/ink stay fixed. Initial cramped row labels spaced apart; final
12 head studies +36 native32/64/96 sprites displayed and scrutinized beside
unchanged NewCanvas3 and2018 painted reference crops. Narrower reads as a slit;
my preference deeper below heavy lid is an interpretation, not owner approval.
Default renderer source unchanged SHA4d5193972985317b3b5c6cd63639c87722fe577ede4fa673397789ddd9e562cd.
Workshop Eye opening study applies only Brown/neutral/rebuilt round-circle;
clones geometry for trial irisHeight, never mutates global records. Save now
retains an explicit selected geometry instead of unconditionally substituting
Brown/Teal defaults. Before app/index copies preserved. Reference option/provenance
note added. Other expressions disable the control and ignore its trial values.
Actual browser:8 principals/16 intermediates;12/32/48/64/96/124 CSS heights;
Happy disabled check;67.5/292.5 turn labels observed. Fullpage and original1x
front comparison PNGs saved/displayed. This is not new full movement/overlap
coverage. Courtyard source/defaults untouched. Browser warning/error log empty.
Actual download retained at original returned Downloads path, exclusive copy
review/saved-sleepy-eye-study.json. Checker initially compared generated clip-ID
counters literally and failed; normalization of only study-number IDs (existing
project convention) then passed8 principal+selected exact geometry/paint SVGs,
trial1.05/.75 and unchangeddefaults. Source assertion fixed to capture-time hash.
app syntax0, study generator0, saved-record checker0. No renderer rewrite or
new AI experiment this pass. Local isolated prototype only; no deployment.
### Eye studies in motion / 2026-10-08
Optional Eye opening study is now shared by workshop, movement.html and the
fixed-camera research courtyard through src/eye-study.js. Load after chibi8.js.
chibiEyeStudy(character, 'current'|'narrow'|'deep') returns unchanged character
for current or unsupported state, otherwise a new object with cloned geometry.
Deep opening1.05/irisHeight.75; narrow.74/.52. Heavy lid geometry unchanged.
Brown neutral round-circle/rebuilt only. Workshop explicitly limits to mariaBrown;
courtyards disable choice for other expressions/Teal. Current remains default.
Example: chibi8SVG(chibiEyeStudy({...STUDY_CHARS.mariaBrown,outfit:'sailor',
expression:'neutral'},'deep'),yawIndex). Save records the selected clone. This
review adapter is optional; integration does not require adopting its choices.
Both courtyards rebuild existing direction/four-step textures when changed.
Capture captions/filenames include the applied choice. Scene zoom/fixed camera,
movement equations, original art, live game and renderer defaults unchanged.
Renderer SHA4d5193972985317b3b5c6cd63639c87722fe577ede4fa673397789ddd9e562cd.
Before HTML/JS copies retained as *-before-eye-courtyard; app copy was made mid
shared-helper refactor and already calls helper (not standalone pre-change app).
Earlier app-before-eye-opening.js remains the pre-eye-controls backup.
Turn-study:64 enlarged heads/128 native32/64 sprites across two outfits and two
separately authored side sweeps. Increased row spacing; both final PNGs actually
shown and scrutinized. Far-eye-order experimental source changes only1sector;
16 enlarged face crops/16native64, only2of8 paired crops differ (70degree both
outfits). Drawing far eye first does not materially solve apparent ink crowding,
so rejected; retained only in research, never loaded into previews/runtime.
Shared-helper check0: actual prior saved study9 SVGs reproduce (clip-ID counters
normalized only); current same-object identity; ignored Happy/Shocked/previous
face/flatter head/Teal; clone mutation leaves caller/source unchanged. Existing
saved-eye checker0 and movement math40cases0. app/helper/main/fixed syntax0.
Actual browser both courtyardsReady8/foursteps; main current/deep front scene
captures937x446 differ167pixels only bounds450,183,36,11 (face), not aesthetic
score. Deeper trial800ms d-key hold movedx2.058/z0, settled90/idle/restframe0.
This is one-input smoke proof, not all8live phases/speed/full walking rig proof.
Happy/Teal disable checks true, fixed deeper/frozen firstfoot observedframe1.
All3 browser warning/error logs empty. Scene/control PNGs actually displayed;
workshop/main/fixed left Brown neutral deep, courtyard steps restoredLive.
No new AI/deployment/default geometry changes. Owner's choice remains pending.
### Deeper sailor sleeve wedges / 2026-10-08
Source SHA0f1d97a61b5db600c29ae2dc017a6ba8f50029a3b75d968e95f2a71a874b8d89.
Previous4d519 source frozen research/chibi8-before-sleeve-depth.js. Retained middle
of three depth variants after actually rendering/displaying comparison and poses.
Only48 skin/trim/trimEdge arrays in8 views.sailorArmStubs changed: localY about
each own shoulder root,3decimal readable landmarks. AllX/rootY fixed. Front
right(anatomical/viewer-left)factor1.3, left1.2; other independently specified
factors in research/sailor-sleeve-depth-study.cjs. Frontal cue lower viewer-left
wedge in NewCanvas3; side/rear continuations are inferred, not traced/canon.
Native circles/lines only. Head100%/100%, eye default.84/.6, collar/bodyOffset14,
torso/bodyScale.6, pointed feet, ink/body rim and pose order unchanged. The data
change affects relaxed resting arms and the resting arm beside Speaking gesture;
Crossed/Alarmed and whiteBlouse/Teal remain unchanged. No runtime scaling hook.
Study compares frozen previous / retained / extra-depth. Rows spaced further
apart before final display.12bodycrops/36native32/64/96/24native64full8views.
Current body poses32crops/64native sprites regenerated/displayed; two-outfit,
expression and finished-reference boards refreshed. Original identity verified.
New workshop reference choice labels the sleeve comparison; earlier eye board
note now identifies its historical body and latest live sleeve draft separately.
New check-sleeve-depth0:16records; onlystubY arrays changed; exacthead outline/
colour groups for affected poses;1728finite stablebounds/foot anchors;
1584unrelated fullSVG exact;144old fullgeometry restored exact. First draft head
check matched no explicit data-piece=head group; corrected before final result
with nonempty outline/colour-group assertions (no vacuous undefined comparison).
Source/app syntax0; shared-eye adapter check0 using actual saved geometry across
new defaults, clone nonmutation/currentidentity/ignoredstates retained. Historical
saved-eye checker loads frozen capture-time4d519source, keeps source assertions;
re-run0. Current helper still reproduces9actualold savedSVGs without weakening.
Review export0; outfit16/hash/uniqueviews/bounds/anchors0;504+504parameter0.
Actual workshop bodyFocusfront beside originalconstruction1x PNG displayed;
12/32/48/64/96/124 CSS heights and8/16 counts verified. Main/fixedReady8/foursteps;
currentfront scene PNG displayed. No new keyboard input or full phase sweep in
this pass. Logs empty all3. Save returned Downloads/...study (4).json, preserved;
exclusive review/saved-deeper-sleeve-study.json copy matchescurrentstubgeometry,
eye.84 and9SVG exact (per-call clipIDs normalized only). Previews retained.
My judgment fuller wedges closer to original; owner aesthetic approval pending.
Prototype only; no AI generation, live-game/backend/config changes or deployment.
### Far sleeve ownership in profile — 2026-10-08
The retained draft tucks the far resting sleeve behind the shirt in the two full
profiles. Only views[2].sailorArmStubs.left and views[6].sailorArmStubs.right
changed, six skin/trim/trimEdge arrays total. Local X moves inside each own torso:
right profile centre113/gain0.3; left profile centre88/gain0.22. Local Y, near
sleeves, collar, torso, feet and head stay fixed. Separate records preserve
character-side ownership; no mirrored images, opacity fade or drawing-order swap.
Corresponding landmarks interpolate through adjacent sectors, exposing the far
sleeve gradually. Side/rear sailor anatomy is inferred, not canon from a drawing.
The inspected232429 sketch shows a different outfit, not a sailor turnaround.
Before source: research/chibi8-before-profile-sleeve.js (0f1d97... stage).
Current source SHA256:
d03fb075a1ec20a41953e7b70028c6cc5517aad15ff2a24dcde75215b5375f6e.
Research/sailor-profile-sleeve-study.cjs compares preserved before and retained
trial geometry:56 body crops and112 native32/64 sprites across two side sweeps,
relaxed and Speaking. Both PNGs actually displayed/scrutinized before adoption.
Current body-pose sheet refreshed/displayed; two-outfit, expression and finished
comparison sheets refreshed. New workshop reference options expose each side
sweep and state inferred ownership. Earlier depth-board note labels its stage.
check-profile-sleeve.cjs passed: only two far sleeve X records differ;5184 finite
renders with stable bounds/foot anchors;5031 unrelated full SVGs exact;153 changed
profile-sector SVGs with exact real head outline/colour groups;153 old full-geometry
restores;9 actual previous saved-draft SVGs reproduce. Coverage: two characters,
three outfit settings, four poses, three expressions and5degree samples. This is
scoped technical evidence, not a universal aesthetic/continuity guarantee.
Historical check-sleeve-depth now reads the frozen0f1d97 checkpoint, retaining all
prior assertions (1728 scoped outputs); re-run passed. Shared eye adapter saved
geometry/nonmutation check passed. Source/app syntax passed. Export passed;
outfit16/hash/bounds/anchors passed;504+504 JSON round trips passed.
Browser: workshop8 principal/16 intermediate and exact12/32/48/64/96/124 CSS heights.
Right body-focus/original front reference1x and left full-page PNGs displayed;
reference is for garment style, not proof of profile anatomy. Main/fixedReady8
views/four steps. Actual right-facing courtyard scene captured/displayed through
UI; no new keyboard or full live-phase test. All three warning/error logs empty.
Actual Save returned Downloads/...study (5).json. Original retained; exclusive
review/saved-profile-sleeve-study.json copy matches current geometry, selected270,
and8 principal+selected SVGs exactly after normalizing per-call clip-ID counters.
All three tabs retained. No AI generation, deployment or live-game changes.
My judgment: one visible resting sleeve makes profile body facing clearer.
Final resemblance and hidden-view interpretation remain the owner's call.
# Foot depth order — 2026-10-08

`BROWN_MARIA_GEOMETRY.outfits.sailor.rightFootForeground: true` selects foot order [1,0] on 0 < view index < 4; foot 0 remains anatomical right and foot 1 anatomical left, including their original phase signs. All other cases use authored array order. Missing flag restores previous outputs. Source before this change is `research/chibi8-before-foot-order.js`; historical profile checker now uses that capture-time checkpoint.

Run `node research/check-foot-order.cjs` from this prototype for 3,840 renders with identical primitive/lift records and stable bounds/anchors, including 3,536 unchanged full SVGs, 304 right-side order cases, 1,920 omitted-field restores and nine actual prior saved SVGs. Run `node research/check-foot-order-courtyard.cjs` to validate the 32 actual frozen browser PNGs/visible SVGs and eight separately observed held inputs. Recreate captures via the courtyard controls before reusing those assertions after future renderer changes. The checker normalizes only browser empty-tag serialization and clip counters. Review exports and current comparison boards were refreshed. No game integration or deployment occurred.


## Sailor fold readability comparison — 2026-10-08

Compared current folds (frontFoldInk0.65), lighter folds (0.35) and a plain shirt (frontFolds=false), using existing editable geometry parameters. Only front-fold paths differ; source and canonical geometry remain unchanged. The generated board has24 enlarged body crops and72 exact32/48/64 raster-height sprites, plus the unchanged-pixel original construction crop. Actual displayed PNG inspection favored keeping the current shallow folds because they echo NewCanvas3; removing them did not clearly improve the small silhouette. This is the assistant's judgment, not owner approval. The frontal32px changes affect five pixels for either alternative; pixel counts measure change, not resemblance.

Run node research/sailor-fold-readability.cjs from this prototype. Exit0 checks that only fold paths differ and that canonical geometry/source bytes are untouched. Manifest: review/sailor-fold-readability.json. Board: review/sailor-fold-readability.png. Workshop Reference desk now includes Sailor cloth · current, lighter and plain; its note labels the comparison and inferred side/rear evidence. This rendered comparison is inspection material, not another shipped character. App syntax passed; actual browser selection/modal/screenshot were verified and warning/error logs were empty. The modal scales the comparison to its available area; exact native sizes refer to the standalone board's source rasters. No current character defaults changed, no live-game integration or deployment.

## Equal-head-width body-height comparison — 2026-10-08

review/sailor-body-height-study.png aligns the unchanged original construction crop and three editable code variants at approximate320px colour-head width: bodyScale0.60(current),0.66,0.72. The owner-selected round head remains; the original is flatter.24 native64px views cover eight directions at each height. No canonical default changed; owner choice is pending. This helper derives from the earlier body-width comparison, with height cloned into outfit geometry. Body widths/colours/ink stay fixed; body landmarks grow vertically about y144 plus offset14. Resulting foot anchors are212,217.4,222.8. Conservative SVG bounds adapt.

Run node research/sailor-body-height-study.cjs. Exit0: source bytes unchanged,192 finite principal/intermediate renders across four poses; correct per-variant foot anchors;144 upright-pose head groups exactly preserved after clip-counter normalization. Alarmed head placement follows body foot anchor by design and is excluded from the exact-head assertion. The initial checker wrongly tried its upright transform matcher on Alarmed; corrected to this explicit scope before success. The generated board only depicts relaxed pose. This is a comparison, not a verified complete movement implementation of a newly adopted height. UI reference/provenance added; before index/app copies preserved; app syntax exit0. Actual browser selected/modal rendered/screenshot displayed, warning/error logs empty. No current renderer edit, game integration or deployment.

## Flat tapered neutral brows — 2026-10-08

Retained the thicker brow trial after viewing review/brow-taper-study.png against the original NewCanvas3 head crop:15 enlarged faces/45 native32/64/96 sprites. Only neutral rebuilt circle-face brows change. BROWN_MARIA_GEOMETRY.headBasis.faceStyle.browTapers contains two independent anatomical [upperShoulderX, lowerShoulderX, thicknessInInkUnits] triples: [[0.35,-0.25,0.7],[0.2,-0.35,0.65]]. Each flat four-point filled glyph uses its own eye's current endpoints and brow rise; no mirror operation, Bézier path or raster artwork. Missing field retains previous circular-stroke brows exactly. This is the assistant's provisional style judgment; owner approval remains pending.

Before source: research/chibi8-before-brow-taper.js. Current SHA25689660de4d18644627f22464d9e323255a94c3e17d7fda22aed7c4ca095a54a62. Run node research/check-brow-taper.cjs: exit0,1728 finite principal/intermediate renders, only brow paths differ,1677 full SVGs unchanged,51 neutral changed views,864 omitted-field restores,9 actual prior saved SVGs reproduce. Historical check-foot-order and check-foot-order-courtyard now load their actual2b2323 capture-time source from the frozen before-brow file; assertions retained, courtyard checker re-run0. The historical browser board is not relabelled as new-brow output.

Source/app syntax0, explicit-outfit16/export hash/unique views/bounds/anchors0,504+504 parameter round trips0, shared eye-study identity/nonmutation/actual saved reproduction0. Current body/expression/two-outfit/finished boards and SVG exports refreshed. Original identity checks pass. Browser workshop/main/fixed reloads verified; workshop current front/reference and actual96px courtyard plus fixed-camera32px scene captured; workshop/32px PNGs actually displayed. Three warning/error logs empty. Save this study downloaded study(7).json, preserved and copied to review/saved-brow-taper-study.json; current full geometry and9SVGs reproduce after clip-counter normalization. No new keyboard/live-gait/device/backend check this pass. Both eye-opening and body-height owner choices remain pending, defaults unchanged. No integration/publishing/deployment.

## Narrow-eye ink during turns — 2026-10-08

Retained existing eye-corner arcs after displaying27 face crops/54 native32/64 sprites comparing current, shorter and omitted corners against NewCanvas3. The comparison exposed thick narrow far-eye outlines in intermediate turns. Separately displayed16 enlarged face crops/48 native32/64/96 sprites comparing prior ink and proportional ink; retained the proportional draft. Optional headBasis.faceStyle.farInkMinWidth=10 scales neutral rebuilt-circle eye-white, iris, drooping-lid and corner stroke widths by min(1, authored eye half-width/10). Coordinates/colours remain fixed. Principal eyes either meet the threshold or are hidden, so all eight principal outputs remain exact. Missing field gives prior ink. No opacity fade, Bézier or mirrored finished image. Resemblance remains the owner's decision.

Source SHA43786507434f092b74a15a6ab4f011859dddafd697c30643e8101ecc5662540b. Before source research/chibi8-before-far-eye-ink.js. New check-far-eye-ink.cjs exit0:5184 finite renders (two characters/three outfit settings/six expressions/two face modes/5degree samples, relaxed pose), only stroke-width attributes differ,576 principal SVGs exact,42 neutral intermediate changes,2592 omitted-field restores,9 actual prior saved views exact. Historical brow checker now uses its capture-time89660d source, retains assertions/re-run0. Source/app syntax0; export/outfit16/current hash/bounds/anchors0;504+504 parameter round trips0. Current review boards refreshed; original identity checks pass.

Workshop selector includes corner and ink comparisons with provenance. Actual workshop67.5 view/reference screenshot displayed; eight principal/sixteen intermediate/gameplay samples visible. Main/fixed reloadedReady8/foursteps; all three warning/error logs empty. Actual Save study(8).json preserved and copied to review/saved-far-eye-ink-study.json; eight principal+selected67.5 SVGs and full current geometry reproduce exactly after clip-counter normalization. No new keyboard/gait/phase/real-device/backend check. Pending eye-opening/body-height choices and their defaults remain separate. No integration or deployment.

## Hair-cover progress through profile/back turns — 2026-10-08

A fixed-scale five-degree sweep exposed an abrupt left reveal: prior flat skin coverage rose from1 exact-colour pixel at255° to4275 at260°. Prior right retreat fell from2508 at105° to0 at110°. These counts describe coverage, not resemblance. An initial full-sector reveal exposed early isolated skin patches and was rejected after viewing its PNG. Revised headBasis.continuousCoverProgress:{revealStart:0.5} retains preparation time: left cover progress=max(0,(t-start)/(1-start)), right retreat=1-t. Start is clamped0–0.95/default0.5; missing field keeps preceding cover timing. Only the existing face-wipe clip ellipse's centre travel changes. All anatomy, colour, ink, geometry landmarks, layer order, bounds and foot anchors remain fixed. No Bézier, raster substitution or mirrored view.

Before source research/chibi8-before-cover-progress.js. CurrentSHA05f09035dc1689dc9a0a0ad9cd7322ef288a751e4accd8f71f2305b7f4dd0349. Current five-degree and one-degree sweep PNGs were displayed; dense left250–259° coverage1,1,396,1036,1798,2469,3030,3526,3933,4280. Connected cheek emergence is the assistant's visual judgment, not owner approval or proof of continuous motion. Slight coverage variation after fully visible reflects the separately authored profile mapping.

Run node research/check-cover-progress.cjs: exit0,5184 finite renders (two characters/three outfits/six expressions/two face modes/5degree samples, relaxed pose), only face-wipe clip definition differs,576 principal SVGs exact,216 changed intermediate clips,2592 omitted-field restores,9 actual previous saved SVGs reproduce. Historical far-eye ink checker now loads437865 capture-time source; not re-run this pass. Source/app syntax0; export/outfit16/hash/unique views/bounds/anchors0;504+504 round trips0. Current boards refreshed/original identity checks passed. Helpers profile-cheek-before/continuity/dense recreate preserved previous/current sweeps; earlier trial files remain internal experiments. Initial experiment typo left a backtick and failed syntax; fixed before rendering or canonical adoption.

Workshop includes previous/current/dense references with limitations. Actual254° workshop screenshot and current one-degree PNG displayed; main/fixed reloadedReady8/foursteps, three warning/error logs empty. Actual Save study(9).json original retained/copied to review/saved-cover-progress-study.json: full current geometry,8 principal+selected254 SVG reproduce exactly after clip-counter normalization. No new input/gait/video/device/backend check. Pending body-height/eye-opening preferences remain separate. No integration/publishing/deployment.

## Focused art review — 2026-10-08

Open http://127.0.0.1:8791/review.html on the existing local server for the simpler owner-facing review. New review.html/review.css/review-app.js consume canonical src/chibi8.js directly, with no experiment helper, alternate eye/body proportions, AI bitmap or archive renderer. Character, brown-Maria clothing and expression selectors; large draft beside three unchanged original references; all eight principal buttons; adjacent-direction buttons; continuous one-degree slider; exact32/48/64/96 CSS-height SVG samples. Teal remains separate/provisional and brown clothing selector is disabled for her. Original auto-selection follows character/outfit; drawings remain manually selectable. The detailed workshop and courtyard are linked; existing workshop now links to this focused page. Large reference/draft panels fit independently; they are not calibrated equal-head overlays.

Source unchanged SHA05f09035dc1689dc9a0a0ad9cd7322ef288a751e4accd8f71f2305b7f4dd0349. New script syntax0. Actual browser checks cover five settings: Brown Sailor/front, Brown Blouse/right, Brown Sailor shocked/315, Teal neutral/45, Brown Sailor neutral/254. Run node research/check-focused-review.cjs: exit0,65 actual visible SVGs match canonical source after browser empty-tag/clip-counter/height-style normalization; eight directions per setting; four exact CSS heights; original image dimensions match local originals; Teal clothing disabled;254° Next selects270/Previous225. This is representative UI coverage, not exhaustive six-expression/pose/device or movement verification. Screenshot review/focused-art-review.png actually displayed; browser warning/error logs empty. No renderer or live-game changes/deployment. Before index copy preserved; original files unmodified.

## Optional reference head-width framing — 2026-10-08

Focused review now defaults to Match head width where supported. Only Brown Maria beside the NewCanvas3 construction crop is eligible; its earlier approximate crop anchors x36…2230 in2260px are reused from the body-width study. The current rendered circle-edge width drives reference-image CSS size, preserving original aspect/pixels and fitting within the panel. On load/resize/reference/character/view changes it recalculates. Uncheck to restore independent panel fit. Tilted Teaser and teal references disable calibration. This does not align facial landmarks or establish an exact traced likeness; matching one dimension retains the original flatter head and owner-selected circular adaptation.

Before focused HTML/CSS/JS copies preserved under research/*-before-head-match.*. Renderer SHA remains05f09035dc1689dc9a0a0ad9cd7322ef288a751e4accd8f71f2305b7f4dd0349. Browser front and254° reference anchor widths match the actual circle-edge width within0.05 CSSpx rounding. New check-focused-head-match.cjs exit0: five observed states, toggle/reference changes leave SVG exact, current source correspondence, native32/48/64/96 sizes unchanged, unsupported fallbacks, original crop SHA unchanged. Existing65-SVG focused review checker re-run0. Script syntax0. Actual focused-head-match.png displayed/scrutinized. No mobile/resize screenshot, character geometry, movement or deployment change this pass.

## Sleepy face spacing comparison — 2026-10-08

Run node research/face-spacing-study.cjs from this prototype. review/face-spacing-study.png shows current, 12% broader eyes with a 1.5x caret, and that variant lowered three units. Five visible directions per variant; 15 enlarged crops and 45 native32/64/96 padded-height rasters. Cloned headBasis.faceViews only: own anatomical widths/centres and caret points about their own mouth anchor. Head/hair/outfit/eye-opening/lid/iris parameters remain fixed. No mirrored image or AI pixels. Original head crop unmodified. The source SHA remains05f09035dc1689dc9a0a0ad9cd7322ef288a751e4accd8f71f2305b7f4dd0349.

Helper exit0:576 finite trial renders across two outfits, six expressions and16 angles; current clone identical; no geometry outside faceViews differs; source bytes unchanged. Enlarged PNG displayed/scrutinized. Assistant judgment: bigger caret resembles the frontal reference better, but wider eyes approach hair in quarters. No trial adopted; owner aesthetic decision remains pending. This trial is not exhaustive all-pose or overlap verification. Workshop Reference desk includes it; image1500x1180 actually loaded, selection/note verified, screenshot saved/displayed, warning/error logs empty. Native rasters refer to standalone board, since fitted browser reference scales it. Script syntax0. One erroneous shell attempt ran browser app.js directly and failed with document undefined; corrected to node --check, exit0, and verified actual browser afterward. No character/default or live-game change, publishing or deployment.
## Moderate neutral caret draft — 2026-10-08

Retained1.35x neutral caret from the displayed review/caret-size-study.png comparison(previous/1.35/1.65):15 enlarged faces and45native32/64/96 sprites beside original unchanged head crop. Only five visible headBasis.faceViews caret arrays change, independently scaled about each authored mouth anchor. Hidden rear points remain collapsed. Eyes/acting mouths/head/hair/body/collar/sleeves/foot anchors and layer order unchanged. No Bézier, AI pixels or mirrored image. Assistant visual judgment, not owner aesthetic approval. Current sourceSHA5615d8d965970e2ea829578b435c94ed8d44286c507ebba32fd900f25c4ca552. Previous source preserved research/chibi8-before-caret-size.js.

Run node research/check-caret-size.cjs:2304 finite renders(two characters/three outfits/six expressions/four poses/16angles); only neutral-caret paths differ,2172 fullSVGs exact/132 changed,1152 old full-geometry restores,9 actual previous saved SVGs reproduce. Export/outfit16 source-hash/unique views/bounds/anchors checks0;504+504 parameter roundtrips0. Current body/expression/two-outfit/finished boards refreshed; original identity verified. New node research/check-caret-browser.cjs:52 actual visible SVGs match current source across sailor0/90/254 and blouse315; eight principals/four exact32/48/64/96 CSS heights per setting. Focused current screenshot and actual front courtyard PNG displayed. Four browser logs empty; all tabs retained and existing server reused. No new walking/input/phase/device/backend proof.

Older check-cover-progress, check-cover-orbit, check-focused-review and check-focused-head-match now explicitly use their actual05f capture-time checkpoint. Assertions unchanged, not re-run this pass; don't mistake those old captures for this mouth draft. face-spacing-study helper also frozen to05f; workshop note calls it earlier. caret-size-study uses same checkpoint; its baseline source-byte assertion refers to that frozen source. Workshop exposes the new mouth comparison/provenance. Before app/index copies retained. No game integration/publishing/deployment; pending eye/body-height preference remains separate.
## Face/hair interior ownership review — 2026-10-08

Run node research/face-hair-ownership.cjs. review/face-hair-ownership.png shows18 current sailor face crops(neutral/Stare/shocked,0/22.5/45/67.5/292.5/337.5) and36 native32/64 sprites beside unchanged original head crop. Actually displayed/scrutinized; no default geometry change. Assistant judgment: neutral brows stay clear of hair, narrow far Stare eye merits separate follow-up. Current sourceSHA5615d8d965970e2ea829578b435c94ed8d44286c507ebba32fd900f25c4ca552.

Raster helper exit0 covers864 render pairs: two outfits/six expressions/every5degrees, relaxed pose,128px padded height. Removes facial path/ellipse shapes while keeping hair, skin and clip definitions; compares actualRGBA pixels. Qualifying solid hair pixels require exact hairRGBA in their complete3x3 baseline neighbourhood. Zero qualifying interior changes. Shared ink, one-pixel boundary neighbours and antialias edges excluded. Initial exact-colour-only assertion failed with43 changes because it included resampled boundaries; corrected the stated interior definition to an explicit neighbourhood and re-ran. This is not proof of untouched boundaries, all poses, continuous motion or likeness. JSON records864 cases; removedShapes counts1866 primary eye-white/brow/caret tags, not every stripped feature. Source unchanged verified.

Added Hair framing entry/provenance to workshop; before app/index preserved. Actual browser image1440x1030 loaded/selected/note verified; screenshot saved/displayed; workshop warning/error logs empty. App/helper syntax0. Four tabs retained/server reused. No new movement/input/device/backend check, no AI output, integration or deployment.
## Stare far-eye ink — 2026-10-08

Optional headBasis.faceStyle.stareFarInk=true extends the existing min(1,halfWidth/farInkMinWidth) ink gain to rebuilt-circle Stare iris/lid/brow strokes. Geometry, colours and every principal view remain fixed. Missing flag gives previous output. Other expressions/Teal/previous face unchanged. SourceSHAf6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c; previous5615 source frozen research/chibi8-before-stare-ink.js. Trial source retained separately and equals canonical.

Displayed/scrutinized review/stare-ink-study.png(previous/trial):12 face crops and36native32/64/96 sprites at60/67.5/75 and285/292.5/300. Assistant judgment: far eye less knotted near fringe; owner aesthetic approval pending. Run node research/stare-ink-study.cjs:1728 finite renders(two characters/two outfits/six expressions/every5degrees, relaxed), only stroke widths change,192 principal SVGs exact,28 changed Stare intermediate views. node research/check-stare-ink.cjs:1152 missing-flag restores across three outfits/six expressions/four poses/16angles;9 actual previous savedSVGs exact;canonical matches displayed trial. Historical check-caret-size now uses5615 checkpoint, assertions retained/not rerun. Previous neutral-browser checker re-run0 against current source:52 unchanged neutral SVGs. Exports/outfit16/hash/uniqueviews/bounds/anchors0;504+504 JSON roundtrips0. Body/expression/two-outfit/finished/hair-framing boards refreshed; original identity checked. Hair-interior raster checker re-run0:864pairs/zero solid interior changes with stated boundary exclusions.

Actual focused Stare67/292 browser observations:26 SVGs match current source,32/48/64/96 CSS heights; node research/check-stare-browser.cjs0. Current focused screenshot displayed. Four tabs reloaded/logs empty/retained; workshop comparison selected/note verified; server reused. No new movement/input/device/fullpose/browser or backend coverage. App/source syntax0. Only isolated prototype changes; no integration/publishing/deployment.
## Courtyard background contrast — 2026-10-08

Main and fixed-camera courtyards now offer Original courtyard(default), Light paper and Dark night. Shared courtyard-background.js edits scene background/floor material/grid uniform only. Character SpriteMaterial/textures/geometry and existing lights/props/shadow remain fixed. Original palette stays default. Capture captions and filenames include selected background. Fixed camera remains sprite-only scaling; main size still zooms scene. Before HTML/JS copies preserved. Initial PowerShell string substitution expanded dollar syntax in an inserted handler; corrected explicitly to the existing by-ID helper before browser execution.

review/courtyard-contrast-board.png contains32 actual fixed-camera PNGs: eight idle sailor facings at64/32px padded sprite heights on two contrasting floors.96x120 crops enlarged2x nearest for inspection. Actually displayed/scrutinized; assistant judgment white border reads strongly on dark floor, small garment details difficult at32px on both. No geometry change. Run node research/check-courtyard-contrast.cjs:32 source-matching visible facing SVGs, correct directions/size/background/stable centre/idle frame0, identical SVG per paired background, actual scene background pixels differ.937x446 scene captures verified. This does not prove canvas sprite pixel equality, complete motion, input speed, other outfits/poses or likeness.

Shared/main/fixed/app syntax0. Actual main dark palette/capture caption/background filename/Ready8 status verified; whole-page PNG displayed. Workshop board selected/note checked; workshop/main/fixed warning/error logs empty. Four tabs retained/server reused. Main left96px/front/night; fixed restored64px/front/night. Source renderer remainsf6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c. No game integration/AI output/publishing/deployment. No backend tests needed or run.
## Outfit-stable fixed camera and white-blouse contrast — 2026-10-08

Actual source review found fixed-camera framing still depended on current texture bounds, so changing clothing/character changed the world frame. Corrected research/movement-fixed-camera.js: baseline padded height from canonical neutral sailor0; fixed mode uses that single camera frame and adjusts uniform sprite ratio by baseline/current padded height. Requested padded32/64 remains exact without stretching; existing sprite foot-centre computation stays. SceneZoom path retains per-current-bounds framing. Before JS preserved. Main courtyard and renderer unchanged. RendererSHAf6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c.

review/blouse-contrast-board.png:32 real fixed-camera PNGs, eight idle white-blouse directions at64/32 on paper/night.96x120 crops enlarged2x nearest; displayed/scrutinized. Assistant judgment sleeves clearer at64, white torso details remain difficult at32, especially light floor. No character geometry adopted. Run node research/check-blouse-contrast.cjs:32 source-exact facingSVGs/correct direction/size/background/centre/idleframe0; constant observed cameraViewHeight15.193408125 and calculated padded64/32; background pixels differ. Run node research/check-outfit-framing.cjs:32 paired sailor/blouse scene PNGs exact outside96x120 character region, stronger actual scenery framing evidence. This does not prove sprite pixel equality, all poses, motion or likeness.

Actual Teal64/32 observations also report same cameraViewHeight and exact calculated padded64/32; representative character check only. Restored Brown/WhiteBlouse/front64/night; current capture caption/Ready8 verified, whole-page PNG displayed. Workshop board selected/note verified; workshop/fixed warning/error logs empty. Four tabs retained/server reused. Fixed/app syntax0. No new main input/device/backend check or deployment. Historical statements that fixed camera already stayed constant across outfits were inaccurate; latest correction is authoritative.
## Garment ink comparison — 2026-10-08

Internal research/chibi8-garment-ink-experiment.js derives from current renderer; c.garmentInk1/1.2/1.4 scales only selected clothing path strokes(outfit-top/collar/trim/tie/neck/folds). Outer white outline retains original stroke widths; head/bare arms/feet/body proportions fixed. No canonical renderer edit. Run node research/garment-ink-study.cjs:48 enlarged body crops and144 native32/48/64 sprites across both outfits/all eight directions; current trial exact; only the permitted garment paths' stroke-width attributes differ; entire other SVG content including white border/head exact. Source bytes unchangedSHAf6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c. Relaxed/neutral comparison only.

Comparison PNG actually displayed/scrutinized; original NewCanvas3 construction crop re-displayed. Assistant judgment keeps current ink: heavier collar/tie crowds colour without clear native32 improvement. This is not owner aesthetic approval. No default gain adopted; experiment separate from deliverable renderer. Workshop entry/provenance added, before app/index retained. Browser1440x1680 board loaded/selection/note verified, screenshot saved/displayed, warning/error logs empty. Experimental/app syntax0; helper0. Four tabs retained/server reused. Native raster sizes refer to standalone board, since fitted browser reference scales it. No new input/device/movement/backend check or deployment.
## Sailor tie colour-area comparison

research/tie-area-study.cjs clones full current Brown geometry and widens each principal sailorTie around its own upper middle anchor by1/1.15/1.3. Head/collar/sleeves/body positions and stroke widths stay fixed; the tie's matching white underlay follows its contour. Canonical source remains f6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c. No default adopted. Comparison24 body crops/72 native32/48/64 sprites actually displayed: assistant judgment wider tie adds little32px benefit and crowds collar gap. Owner aesthetic call pending. Run node research/tie-area-study.cjs; output/source byte checks exit0. Only tie/matching underlay paths differ; gain1 exact. Relaxed neutral/principal directions only, not intermediate/poses/movement coverage.

Initial helper incorrectly assumed STUDY_CHARS held full geometry, then omitted the matching white-underlay change and absent tie in rear views. Corrected explicit cloned geometry, precise matching underlay exclusion, and rear-view handling before successful run. Workshop entry/note added with before app/index copies preserved. Actual1440x880 browser image loaded/selected/note verified; review/tie-area-workshop.png saved/displayed; warning/error logs empty. App/helper syntax0. Four tabs retained/server reused. Native raster dimensions refer to board images, not fitted browser reference. No new input/device/backend checks, AI output, integration/publishing/deployment.
## Live sailor collar placement study

Workshop now offers current bodyOffset14 and optional lower18/22 for Brown sailor only. selectedDrawing clones full geometry only for nondefault placements; the shared short body size, head proportions and stroke widths stay fixed. No canonical renderer/default change. Control disabled for whiteBlouse/Teal/other renderer modes. Save this study includes the selected full geometry; older/current settings remain compatible. Before app/index preserved.

research/collar-placement-study.cjs derives from existing body-height board but varies bodyOffset instead: original unchanged construction crop beside three approximate equal320px head-width frontal samples and24 native64px principal sprites. Displayed/scrutinized original and board. Assistant judgment lower placements expose more collar but lowest makes head appear detached; kept14 default, optional aesthetic studies available for owner call. Source SHA f6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c unchanged. Helper exit0:192 finite principal/half-angle pose renders; correct own foot anchors198+offset;144 non-alarmed head groups exact. Alarmed head placement follows changed foot anchor by existing design. These are not approved turnarounds/back canon.

Real workshop observations captured90 SVGs:three placements,8principal+16half-angle+6native CSS heights12/32/48/64/96/124. Actual Save this study download copied unchanged to review/saved-collar-placement-study.json(18 placement). research/check-collar-placement-browser.cjs exit0:90 visible SVGs source-exact/heights exact/nine saved SVGs reproduce from full editable geometry. UI observed whiteBlouse disabled/foot217.8 and Teal disabled. Restored Brown/sailor/current14/front, comparison selected; screenshot saved/displayed; logs empty. App syntax0. Four tabs retained/server reused. Only workshop supports this new study control; no new courtyard input/device/backend tests. No AI, integration/publishing/deployment.
## Saved workshop geometry in the movement courtyard

Main movement.html now opens a local workshop study JSON and renders its full character geometry through canonical chibi8SVG. Saved SVG/raster fields are ignored. saved-study.js checks supported format/Maria key/paper geometry/eight views, finite parameters/unsupported markup text, and16 renderable angles before use. No network upload. Import locks character/outfit/width/eye selectors, preserves saved face/head/body settings, allows expression and pose changes, and builds existing eight/sixteen direction/four paper-step texture cache. Clear restores current character settings. Capture caption identifies saved face parameters/geometry and filename has saved-study suffix. Before main HTML/JS preserved. Fixed-camera research page does not yet support import. Canonical renderer/default remains unchanged SHA f6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c.

Use: save chosen parameters in the workshop, then open the downloaded JSON with Try a saved workshop study in movement.html. This keeps optional collar/eye/body changes visible during motion without changing shared defaults. Current local page left Brown sailor18 imported, relaxed/front/live paper steps/8directions/64px/night. Source parameters remain unapproved.

Actual imported-collar-64/32-0..7.png captures16 principal scenes with frozen first lifted foot(.25). review/imported-collar-courtyard.png contains96x120 crops enlarged2x nearest, displayed/scrutinized. Assistant judgment collar still difficult at32; lower placement stays optional. Scene zoom changes world frame between sizes; not fixed-camera comparisons. check-imported-collar.cjs exit0:16 real visible SVGs match full saved geometry/phase and size/direction; crossed67.5/.5 actual SVG exact plus saved caption/filename; two malformed/unsupported-file parser cases rejected. Pixel equality of canvas sprite/likeness is not asserted.

Actual held Walk-right UI600ms moved imported Maria to x1.529,z0/direction90 and idle after release. One direction/input check, not all-speed/device motion coverage. Clear UI restored enabled selectors/current settings/Ready8. Reloaded updated caption code and reimported: first chooser observation timed out during reload; inspected same live tab, retried chooser after ready successfully.16-angle crossed67.5 actual observation then restored8/relaxed/front/live. Fresh capture and whole-page screenshot saved/displayed; logs empty. Module/main syntax0. Four tabs retained/server reused. No new fixed-camera/backend/device tests, AI output, game integration/publishing/deployment.
## Fixed-camera saved study comparison

research/movement-fixed-camera.html/js now share saved-study.js parser and the main courtyard's import/clear behaviour. Full editable geometry drives textures; saved SVG/raster fields ignored. Saved face/head/body parameters retained; expressions/poses adjustable; character/outfit/width/eye controls locked until Clear. Existing fixed normalization uses canonical sailor baseline/current texture bounds, so saved geometry changes retain one world frame and requested padded texture height. Before fixed HTML/JS preserved. Main/renderer unchanged.

Actual32 PNGs: current14/saved18 collar placements, all8principal views,64/32 padded heights, night/resting. review/fixed-collar-courtyard.png crops96x120 enlarged2x nearest actually displayed/scrutinized. Assistant judgment lower placement shows a little more collar at64, little improvement at32; current14 default remains. These sizes describe padded drawing/texture height; visible coloured figure is smaller. Hidden rear costume details remain inferred; owner aesthetic approval pending.

Run node research/check-fixed-collar.cjs(exit0):32 actual browser SVGs exact against respective full geometry/current source; own feet/positions resting; observed calculated sprite heights64/32; cameraViewHeight identical15.193408125;16 paired whole-scene PNGs exact pixels outside96x120 character region. This proves stable scenery framing, not canvas sprite pixel equality or likeness. Clear UI observed current foot212/study current/enabled selectors. Fixed restoredcurrentBrownSailor/front64/night/resting, fresh capture/screenshot saved/displayed; logs empty. Fixed JS syntax0. Four tabs retained/server reused. No new input/device/intermediate/backend checks this pass; main previous motion check remains historical.

Use http://127.0.0.1:8791/research/movement-fixed-camera.html and open a saved workshop JSON to compare without scene zoom. Previous statement that fixed page lacks import is superseded. Canonical renderer SHA remains f6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c. No AI output/live-game integration/publishing/deployment.
## Visible figure size calibration

Fixed-camera review now offers padded drawing(previous/default) or visible figure envelope sizing. visible-figure.js scans existing browser-rasterized SVG alpha at the courtyard's .15 alphaTest threshold, including white rim; cache entries store top/bottom in SVG units. One union envelope across all turns/four paper steps determines uniform sprite scale, avoiding size breathing. Individual views may be shorter than the union. Canvas filtering/antialiasing means this is a raster-envelope estimate, not exact final pixel segmentation. Source SVG/geometry/anchors/foot centre unchanged. Fixed world frame retained; sceneZoom disables this option and keeps its existing sizing. Capture filename has visible-figure suffix and caption identifies the selected basis. Before fixed HTML/JS preserved. Main courtyard/workshop use previous padded sizing still.

Observed Brown sailor: previous padded32 gives calculated visible envelope25.5413; padded64 gives51.0826. New visible32/64 require padded40.092/80.184 respectively. This corrects the interpretation of prior small-size comparisons, not the game integration. Actual32 scene PNGs(two bases/two sizes/eight principal idle directions) and review/visible-size-courtyard.png displayed/scrutinized. Assistant judgment costume/face more readable with calibrated larger figure; still small detail remains at32. No geometry/default adopted or aesthetic approval implied.

node research/check-visible-size.cjs(exit0):32 visible SVGs source-exact/unchanged between modes, requested calculated envelope sizes32/64 exact, one world frame,16 PNG pairs exact outside96x120 character region. Alpha scanner fixture checks threshold38discard/39survive and empty rejection. Actual scene light-pixel heights(RGB all>160 in character crop) grow in all16 paired views; visible64 measures59..61, visible32 measures28..30. This heuristic excludes darker edge pixels and is not the entire silhouette; report does not equate it to exact requested pixels. Initial white>230 measurement assertion failed on filtered small borders; corrected to explicit light-pixel heuristic and passed, not a renderer fault. Pixel records saved separately. Native crops enlarged2x for inspection.

Module/fixed syntax0. Actual sceneZoom option disables height basis; restoredfixed/currentBrownSailor/front64/night/resting/visible. Initial capture label lost its interpolated basis during shell replacement; fixed with explicit sizeLabel before final screenshot. Reloaded and actual caption correctly64px visible figure envelope; filename mode marked. Fresh screenshot saved/displayed; earlier logs empty. Four tabs retained/server reused. Saved-study sizing support follows same cache path but not newly browser-tested this pass. No new input/device/backend/AI/game integration/publishing/deployment.
## Moderate sailor cloth corners — 2026-10-09

Canonical Brown sailor outfits.sailor.shirtCorners changed .48 to.25 after a code comparison(.48/.25/.12). Less rounded hem/shoulder contour better matches the flat cloth in NewCanvas3 in assistant judgment; .12 seemed stiff. This is a prototype refinement, not owner aesthetic approval. Head/face/limbs/collar geometry/body placement/scales/stroke widths unchanged; shirt path, matching white underlay and sewn-detail clip only differ. WhiteBlouse/Teal/Scarf unchanged. Source SHA7b992f8288ff05fe4dfbbb2163003054c1dfd96b96cae4796e083094d0e629c2. Previous f6fab2 source preserved research/chibi8-before-cloth-corners.js.

cloth-corners-study.cjs uses frozen previous source/full cloned geometry to compare24 body crops/48 per-view alpha-trimmed native32/64 sprites. Original drawing was construction authority; displayed/scrutinized comparison. Board labels previous/current/flatter; source checkpoint explicit; selectedDefault.25 recorded. Static trimmed sprite sizing is distinct from browser family union sizing. Initial derivation accidentally retained tie adjustment because a newline replacement did not match; helper assertion caught it; explicitly fixed shirtCorners change before successful render/run. No mistaken geometry shipped.

check-cloth-corners.cjs exit0:2304 finite renders(two characters/three outfits/six expressions/four poses/16angles);384 Brown sailor contours changed, all other SVG content exact after excluding shirt/matching underlay/clip;1152 explicit prior-full-geometry views reproduce exactly;9 actual saved collar-study SVGs still exact. Exports refreshed:16default+16explicit outfit SVGs; outfit export checker0 hashes/uniqueviews/bounds/foot anchors;504+504 full parameter JSON roundtrips0. Current body poses/expression/two-outfit/finished-Maria boards refreshed with helpers0; original identity preserved. App/source syntax0.

All four local preview tabs reloaded current renderer. Workshop comparison selected/note verified; PNG screenshot saved/displayed. Actual16 new fixed-camera PNGs/all eight principals/neutral relaxed/resting/two visible envelope sizes32/64. check-cloth-browser.cjs0:16 source-exact visible SVGs/size/frame settings;16 paired before/current scene PNGs identical outside96x120 character region;all16 scene images differ inside. review/cloth-corners-courtyard.png enlarged2x scene crops displayed/scrutinized. This does not prove canvas sprite pixel equality/likeness/all poses/motion. Browser warning/error logs empty for workshop/main/fixed/focused. Fixed restored64/front/night/visible/resting/freshcapture. Main import cleared by purposeful reload, now default renderer. Four tabs retained/server reused.

Six prior-browser checkers frozen to f6fab2 checkpoint rather than mislabel historical captures as current: check-fixed-collar/check-visible-size/check-imported-collar/check-collar-placement-browser/check-caret-browser/check-stare-browser. Before checker copies preserved; assertions retained; six reruns exit0. Current authoritative checks are check-cloth-corners/check-cloth-browser plus refreshed export checks. Existing older boards keep their captured-source provenance; no broad historic test claims. No new input/device/backend/AI/game integration/publishing/deployment.
## White blouse visible-size standing and acting study — 2026-10-09

Studied unchanged original Teaser and actual blouseTop/neckline/alarmed source. Original is a tilted acting illustration, not a neutral or rear turnaround. Assistant judgment: hem/bare midriff distinction retained; current neckline is almost hidden by circle head while reference shows a small angled opening. This is the next geometry correction to investigate, not canon for unseen sides. No blouse geometry/default changed this pass; sourceSHA7b992f8288ff05fe4dfbbb2163003054c1dfd96b96cae4796e083094d0e629c2 unchanged.

research/blouse-visible-acting.cjs derives separate board from earlier padded acting exporter, preserving earlier helper. Uses actual main-root references/drive/oddities/Teaser.png for original byte-identity check instead of stale Downloads location. Original re-displayed; comparison1200x960 actually displayed/scrutinized:16 directions/poses,32 per-view trimmed32+64 sprites, enlarged neutral/alarmed fronts beside unchanged Teaser.64height asserted;32 explicitly resized. Per-view alpha trim is separate from courtyard family union measurement. Metadata hashes/reference identity preserved. Helper/app syntax/run0; source unchanged. Workshop reference entry/provenance added; before app/index preserved. Actual1200x960 image loaded/note selected; whole-page screenshot saved/displayed.

Actual32 fixed-camera PNGs:WhiteBlouse neutral/relaxed and shocked/alarmed, all8principals,32/64 visible family envelopes, night/resting phase. review/blouse-visible-courtyard.png contains96x120 crops enlarged2x nearest, displayed/scrutinized. check-blouse-visible.cjs0:32 actual browser SVGs source-exact/respective expression/pose; calculated envelope sizes32/64; common cameraViewHeight15.193408125;16 paired whole-scene images exact outside96x120 character region. This proves scenery frame consistency, not exact silhouette pixel height/likeness/canvas sprite pixel equality/all motion. Pose envelopes measured separately, not identical body scale between poses. Assistant judgment: neckline disappears at small size; acting mouth and pose read better at64 than32. No geometry adopted from that judgment yet.

Workshop leftWhiteBlouse/shocked/alarmed/front/comparison; fixedWhiteBlouse/shocked/alarmed/front64/visible/night/resting/freshcapture. Workshop/fixed warning/error logs empty. Four tabs retained/server reused. No new input/intermediate/device/backend checks; no AI output/game integration/publishing/deployment. Current renderer remains authoritative moderate sailor corners from prior pass.
## Optional blouse neckline — 2026-10-09, 00:18 EDT

Workshop **Blouse neckline study** selects previous/default, shallow or deep for Brown Maria white blouse. Save this study stores full editable outfits.whiteBlouse.neckViews; import review/saved-blouse-neckline-study.json into either courtyard to try the shallow opening. Current src/chibi8.js supports the optional field; older renderer versions do not. Each direction has own points/visibility, interpolated and clipped inside shirt; omitted field preserves the old arc. No default geometry change. Shallow is assistant-favored for standing; deeper looks too pronounced and acting visibility remains limited. Owner aesthetic judgment pending.

Current renderer SHA5590df51832a3efabba5d08830ce2f86f233688fc7b8495830b13029381ee266. check-blouse-neckline.cjs:2304 old/default SVGs exact,512 trial JSON roundtrips. check-blouse-neckline-browser.cjs:90 actual workshop SVGs/nine saved/16 imported courtyard facing SVGs exact, calculated32/64 visible envelopes and fixed frame verified. Static board48 body/96 trimmed sprites; actual scene16 PNGs; screenshots displayed. No new motion/device testing or canvas pixel-equivalence claim. Defaults retain moderate sailor corners and more-visible collar/sleeves. No game integration or deployment.

## Acting comparison and simple pose controls — 2026-10-09, 00:23 EDT

The simple review.html now supports Standing/Crossed arms/Speaking/Alarmed plus explicit optional blouse opening choices. Brown only for Alarmed; Teal resets to Standing. Current neckline remains default and source geometry unchanged5590df. All sheets/intermediate turns/native padded sizes follow the selection. Compare Alarmed/Shocked/White blouse/Shallow angle beside Teaser. Tilted construction is adapted to the owner's round circle and flat colors; unseen directions are inferred.

research/blouse-acting-opening.cjs is a frozen5590 checkpoint comparison:24 body crops/48 native trimmed32/64 sprites,192 finite opening-only fractional renders. Shifted/lower openings were rejected by assistant judgment. Current shallow opening is visible enlarged; earlier mostly-hidden characterization was overly broad. Detail remains subtle at small sizes. No geometry adoption or owner aesthetic approval.

check-focused-pose.cjs verifies272 actual review SVGs across two costumes/four poses/optional openings/five intermediates/four padded CSS sizes;Teal control/reset/source check. Two actual saved-shallow alarmed-front courtyard SVGs/calculated32/64 visible envelopes/fixed frame also verified. Source-exact SVGs are not canvas pixel-equivalence or aesthetic proof. Screenshots focused-acting-review.png and acting-opening-movement.png actually displayed. No new motion/device tests or deployment. UI before-copies preserved; helper src/blouse-neck-study.js required by focused review.

## Acting arms comparison — 2026-10-09, 00:27 EDT

Workshop reference **Acting arms · current, tapered and shorter** shows24 full views/body crops +48 native trimmed32/64 sprites. Frozen5590 helper keeps separately authored anatomical sides. Tapered/shorter trials rejected by assistant judgment: less rounded weight and weaker small-size outstretched gesture. Current source/default unchanged. Owner whole-body feedback pending.

check-arm-turns.cjs checks70 actual focused-review SVGs against saved shallow/alarmed geometry:14 selected angles/four padded CSS sizes. blouse-arm-turns.png is a rasterized browser-SVG body comparison, not a courtyard canvas capture. Inspection found connected shoulders in sampled turns; no new motion/device coverage. Comparison board and workshop screenshot actually displayed. No deployment. Before workshop app/index preserved.

## Actual rotated-camera walks — 2026-10-09, 00:31 EDT

review/orbit-walk-records.json/32 scene PNGs record400ms held pad inputs, all8 directions at four camera orientations.90/-90 tested64px visible envelopes;0/180 tested32px. Not a fully crossed size/orbit test. Saved shallow blouse, neutral/relaxed/live steps; captures after release at phase0. check-orbit-walks.cjs verifies displacement direction/facing/retained diagonal/idle/source SVG/calculatedsize/worldframe. No exact speed/all live phases/collision/device claim.32 native200x190 scene crops in orbit-walks.png displayed. Source geometry/movement unchanged5590. Workshop comparison selectable; fixed restored centred64/front/orbit0. No deployment.

## Small-size iris outlines — 2026-10-09, 00:36 EDT

Current .65 ink retained. Frozen5590 iris-small-size.cjs compares.65/.35/0 full cloned geometry across two outfits:48 face crops/144 trimmed12/32/64 sprites,384 finite fractional renders; iris ellipse outline only. Original finished Brown Maria supports outlined blue eyes; colour-only rejected and lighter.35 remains a separate optional experiment, no default adoption.

review/iris-035-study.json contains full editable lighter geometry and regenerated nine SVGs; load with courtyard saved-study chooser. Original saved-blouse-neckline-study.json preserved. check-iris-scene.cjs verifies20 actual browser facing SVGs/two visible32/64 sizes/five own views and nine saved SVGs.10 paired scene images exact outside figure area,12..39 altered pixels inside. iris-scene-comparison.png shows native80x90 crops +2x nearest enlargements, actually displayed. Modest colour change does not establish aesthetic improvement. Workshop both comparison boards selectable; courtyard restored current .65 original saved-shallow. No deployment/source defaults changed.

## Current gentle sailor fringe — 2026-10-09, 00:46 EDT

Canonical source SHA2011c8e9af32831d100e3c734d3d98376ddf9f0e1b57c83cc51a068f3fb536e1. Six fringe Y landmarks in own sailor headViews0/1/7 slope gently toward the finished original; no finished-image mirroring. All other geometry/source bytes unchanged. Exact circle/flat palette/heavy lids/locks/body remain. Original NewCanvas3 straighter fringe remains a reference distinction; this is assistant prototype judgment, not owner approval. Internal AI04 prompted the hypothesis but all art remains code paths, no AI pixels. AI prompt/output isolated research/ai-internal/ and never consumed by previews/assets. Full slope remains trial; .6 gentle adopted.

check-gentle-fringe.cjs:4608 finite views,360 changed BrownSailor only,2304 old full geometry outputs exact. check-gentle-fringe-browser.cjs:120 actual workshop SVGs across four poses/principal/intermediate/native CSS samples and16 actual current-default scene SVGs/eight directions/calculated64+32 visible envelopes;16 scene pairs exact outside figure area,six changed front/quarters. Native scenes and2x board displayed; not aesthetic or exhaustive motion proof. Current export16+16/504+504 parameter checks pass; primary current boards refreshed/original identity preserved. Four earlier checkers frozen5590 with before-copies:cloth-corners,cloth-browser,focused-pose,blouse-neckline; historic results kept separate.

Before source research/chibi8-before-gentle-fringe.js; source change procedure apply-gentle-fringe.cjs is one-time and asserts5590. Workshop reference fringe-slope-study.png labels previous/current gentle/full trial. Main/focused/workshop/fixed use updated renderer; old saved geometry intentionally retains old fringe. No integration/deployment. Further reference and aesthetic assessment remains.


## Optional Teal ponytail study - 2026-10-09, 00:58 EDT

Canonical source SHA9d5ab48516570cc2978cc0c413cf39f9bcdc21ee22c82ff22585b1811bbed90c. Added optional geometry.ponyViews: eight independent records with boundary XY array, band XY array and round fillet fraction; palette requires ponyTie or trim. Hair and coloured band draw behind the circular crown, with matching white underlay. Existing geometry without ponyViews retains the complete previous output. Current Brown/Teal defaults unchanged; Brown larger sailor collar/sleeve exposure retained. Before source research/chibi8-before-teal-pony-api.js preserves2011. No Bezier paths or image-model pixels.

research/teal-pony-study.cjs builds separate full editable review/teal-pony-study.json,16 current/trial principal drawings,32 alpha-trimmed32/64 samples and16 fractional inspection views. Load JSON through the saved-study chooser in research/movement-fixed-camera.html after Ready; wait for Ready again after import/size changes. It rerenders geometry rather than stored SVG/raster. Current local server remains127.0.0.1:8791; run instructions remain in README. No integration authorized.

Original TheTwoMarias displayed/scrutinized. High pony hair mass/pink band and flat teal/copper/cream/ochre palette have visible support. Adult proportions are deliberately adapted to shared chibi circle, not an original chibi turnaround. Hidden pony placement remains inferred. All comparison/native/fractional/courtyard boards and actual movement screenshot displayed/scrutinized. Assistant judgment: pony/band more identifiable64px, band subtle32px, high mass still stiff. Existing Teal face/hair overlaps at intermediate angles also need further reconstruction. Trial NOT adopted as default or approved likeness. No AI generated this pass.

Checks exit0: renderer/app syntax;3456 whole default SVGs exact versus2011;1152 finite trial fractional drawings(six expressions/three Teal-supported poses/64angles); source-hashed16default+16explicit outfit exports;16explicit outfit/export bounds/feet;504+504 parameter roundtrips. Gentle fringe checker4608 finite/2304 old Brown full-geometry exact retained. Four current board helpers refreshed with current source hash, original copies byte-identical. Existing gentle-fringe browser checker rerun0:120 recorded actual workshop SVGs/16 recorded scene SVGs remain current-source exact; those historical browser captures were not newly recorded this pass.

Actual new fixed courtyard:16 scene PNGs/eight facings at64/32 visible-envelope settings, neutral/relaxed/resting/orbit0/centre/original floor. research/check-teal-pony-browser.cjs verifies16 actual facing SVGs and8 saved SVGs exactly against current renderer, recorded frame/size settings/PNG dimensions. It does not independently measure final silhouette pixels or prove canvas-SVG pixel equality, exhaustive continuity, motion or real-device behavior. Exported JSON creation time refreshed on final helper rerun; geometry/SVGs retained. Current caption's disabled Brown outfit label still says Earlier scarf/skirt study for Teal; this is a known UI label limitation, not Teal costume canon.

Workshop reference desk contains current/trial and actual-scene boards; before app/index copies preserved. Fixed preview left imported trial64/front/resting, main/focused reloaded defaults, workshop left currentTeal beside optional comparison. Four tabs retained, warning/error logs empty; server reused. Only isolated prototype renderer/API/research/review/exports/UI reference notes/docs and root append touched. Originals, archives, existing user changes, live game/backend/portfolio/deployment configuration preserved. No new backend/motion/device tests, publishing, deployment or integration. Goal active; owner aesthetic feedback pending. Next: continue Brown face/body reference assessment with visible collar/sleeves, or refine Teal connected swept hair/face before considering a default change.


## Teal head reconstruction trial - 2026-10-09, 01:06 EDT

Previous turn was progress: optional pony API/study with preserved defaults and actual browser evidence. This pass reconstructs Teal's head in a separate full editable study, review/teal-rebuild-study.json. Own eight face ellipses/fringe outlines/feature planes, calm neutral eyes and five-landmark smile, existing curved opaque cover algorithm, round circle/flat palette/white border. Raised pony softened about each own band root; long tail/band landmarks retained. Initial left-front long-lock record traversed the face, corrected to independently placed far-rim geometry. No opposite finished-image reflection. Hidden/profile/back hair/face remains inferred; original adult Teal proportions are deliberately chibified.

Canonical renderer gains optional geometry.fringeInkSkinOnly: clips fringe-edge ink to skin even at principal views, eliminating the trial's unrelated wavy line across rear hair. Missing flag retains old outputs. Source SHA3256019b6ebd44ad5422e7450148ca7828704fcb4a9d894d849a859189b11996; before research/chibi8-before-teal-fringe-clip.js preserves9d5a. Current Brown and Teal default geometry/palette remain unchanged. No AI generated or used in this pass; trial is circular arcs/ellipses/straight vectors, no Bezier or raster assets.

research/teal-rebuild-study.cjs:1152 finite trial views(six expressions/three supported poses/64angles),16 previous/rebuilt principal comparisons/32 per-view trimmed32+64 sprites,32 fractional11.25-degree inspection drawings. Final helper asserts source hash unchanged during export. All boards/current actual movement screenshot displayed and scrutinized. Assistant judgment: clearer cheek and calmer face, corrected long lock no longer slides across face in sampled left-front turns; high pony still provisional and exact resemblance unresolved. Owner aesthetic approval pending. Trial not adopted as default.

Actual fixed browser16 final corrected trial scene PNGs,8facings at64/32 visible-envelope settings,neutral/relaxed/resting/orbit0/centre/original courtyard. check-teal-pony-browser.cjs now accepts optional teal-rebuild argument (before copy preserved), verifies16 actual facing SVGs/8 saved SVGs against current source, recorded sizes/frame/settings/PNG dimensions; exit0. Actual courtyard PNG board and whole-page screenshot displayed. Not final silhouette pixel measurement/canvas-SVG pixel equivalence/exhaustive continuity/motion/device proof. Prior preliminary pre-clip scene records were replaced by final corrected captures; only final captures support these results.

Compatibility: teal-pony-study.cjs rerun0 verifies3456 whole default SVGs exact vs2011 plus1152 prior pony trial finite; previous pony browser checker0 confirms16 historical captures/8 saved SVGs remain compatible. Source-hashed16default+16explicit exports refreshed, outfit checker0/504+504 parameter roundtrips0. Four current Brown board helpers refreshed0, sourcehash current/original copies identical. Renderer/app/main movement/fixed movement syntax0. No broader backend/motion/device tests.

Capture captions now say Teal costume study rather than disabled Brown scarf selection; both movement scripts backed up. Disabled outfit selector still displays its Brown-only selection; it does not change Teal costume. Workshop adds head comparison/turns/actual-scene references with accurate notes, before app/index preserved. Fixed left imported reconstructedTeal64/front/resting; workshop currentTeal beside reconstruction comparison; main/focused reloaded current source. All4 tabs retained/warning-error logs empty/server reused.

To inspect: open http://127.0.0.1:8791/research/movement-fixed-camera.html, wait Ready, choose review/teal-rebuild-study.json with saved-study control, wait Ready. Geometry rerenders locally; stored SVG/raster fields are not used as textures. Requires current optional ponyViews/fringeInkSkinOnly API; preserve character flags circleFaceTurn/circularBorder/circleRimInk/circleSleepyLids and full geometry on export. Current run/integration instructions remain in README/RENDERER-HANDOFF; no game integration authorized.

Only isolated prototype API/research helpers/review JSON+PNG/UI captions/reference entries/backups/exports/docs and append touched. Prior history prefix preserved; originals/archives/existing user work/livegame/backend/portfolio/config preserved. No publishing/deployment/integration. Goal active. Next useful step: evaluate this substantial separate reconstruction against original and actual movement before deciding a default adoption; keep Brown first-character face/body/collar assessment central.


## Current Teal head and costume — 2026-10-09, 01:29 EDT

Teal is now the current selectable code prototype, with full own head/face/ponytail and costumeViews geometry; no saved-study import is needed. Brown remains unchanged, including visible sailor collar/sleeves, circular100% head and heavy lids. Canonical source SHAf89fbce588fc5cca56846da4f5b0706acd669f3efa03da2eedd0030b2d3b0f61. Before-default source preserved research/chibi8-before-teal-default.js (f5bb), before costume API research/chibi8-before-costume-views.js (3256). Full adopted geometry equals review/teal-costume-study.json. No Bezier or image-model pixels. This is assistant prototype refinement, not owner aesthetic approval.

Optional geometry.costumeViews has eight records: top/neck/topTrim/hemTrim; arms sleeve/cuff; legs thigh/stocking/boot/sole; nearFoot and folds. Anatomical right is index0, left index1. Own foreground ordering and inherited paper-step groups remain. Missing costumeViews retains prior body output. Flat palette comes from original TheTwoMarias: teal, cream, pink pony band, copper eyes, dark stockings and ochre boots. Hidden rear geometry and chibified adult proportions are inferred. Teal supports relaxed/crossed/explain; alarmed remains Brown-only. Legacy SVG outfit metadata/disabled selector still carries a Brown-only label; caption says Teal costume study.

check-teal-adoption.cjs exit0:9216 Brown full drawings exact vs before-default;2304 Teal current drawings equal verified full study;96 old full saved-study drawings preserved. check-teal-default-browser.cjs exit0:16 actual default scene SVGs source-exact,16 full PNGs pixel-identical to imported costume study,31 actual workshop SVGs exact including intermediate views and CSS12/32/48/64/96/124. Captured visible-envelope32/64 size is a shared family measurement, not exact individual silhouette height.

check-teal-costume-motion.cjs exit0:32 actual selected-step SVGs and anatomical lift groups exact,32 PNG pairs unchanged outside figure area,16 phase0/2 pairs identical,8 held400ms walks correct displacement/facing/retained idle. Captures after release do not prove every live phase, speed, device or exhaustive continuity. Actual native scenes/steps/walks/enlarged comparisons/default workshop/default movement PNGs displayed and scrutinized. Assistant judgment: cream trim and boot shafts clearer64, detail reduced32; pony and likeness remain provisional.

Current exports16default+16explicit, outfit checker and504+504 parameter roundtrips passed earlier this pass. Four primary current Brown boards refreshed with current source hash; original copies byte-identical. Historical pony/rebuild/costume study helpers and gentle-fringe checker frozen f5bb with before copies, preserving earlier comparison semantics; use adoption/default-browser checks for current coverage. Historical full JSONs still rerender their own geometry. No AI generated this pass.

Run local preview per README, currently http://127.0.0.1:8791/. Select Maria teal study in workshop or movement; fixed camera at /research/movement-fixed-camera.html is useful for32/64 assessment. Source/src chibi8.js is isolated; preserve full geometry plus circle flags on saved export. Integration requires deliberate game-side compatibility work and owner authorization; no copying into live game. Four preview tabs retained, logs empty at last browser check, fixed currentTeal64/front/resting/centre/orbit0. Prior originals/archives/user changes/livegame/backend/portfolio/config untouched. No publishing/deployment/integration. Continuous task remains active; next assess Brown face/body and Teal likeness against originals, awaiting owner aesthetic feedback.


## Brown sailor sleeve-span comparison — 2026-10-09, 01:33 EDT

Previous turn was progress: full selectable Teal adopted/verified. This pass returns to Brown frontal body reference. Separate review/sailor-sleeve-span-study.json contains full editable20% sleeve-span geometry around each own shoulder root. Eight own sleeve arrays retained; profile far anatomical-left(view2)/right(view6) unchanged. Current and40% alternatives remain comparison only. No canonical renderer/default change (sourcef89f); head100% circle/collar/torso/bodyOffset14/feet unchanged. Only sleeve X landmarks changed; all Y values/root positions fixed. No finished image reflection or AI generation.

research/sailor-sleeve-span.cjs exit0:2304 finite fractional drawings(three versions/four poses/six expressions/32angles),24 enlarged body crops/24 native32/24 native64 sprites beside unchanged original crop. check-sailor-sleeve-span.cjs exit0:all geometry apart from sleeve records exact, sleeve Y/root positions exact, two far profile sleeves exact,384 crossed/alarmed drawings exact. This does not prove exhaustive overlap or aesthetic resemblance.

Actual file chooser imported the full study into fixed courtyard.16 actual scene PNGs/eight directions at visible-envelope64/32;check-sailor-sleeve-span-browser.cjs exit0:16 facing SVGs/8 saved SVGs source-exact, recorded sizes/frame/centre/resting/settings/937x446 dimensions checked. Actual courtyard board/workshop/movement screenshots displayed and scrutinized. Assistant judgment: moderate wedges slightly easier to see64, little difference32; broad version increases lower width without improving collar. Default retained; owner aesthetic approval pending. No new live walking/device tests.

Workshop adds two labelled comparison references and accurate provenance note; before app/index backups preserved research/app-before-sleeve-span.js/index-before-sleeve-span.html. App syntax0. Minor verification selector #outfit failed in workshop because actual control is #costume; observed state confirmed sailor already selected, corrected workflow without source change. Workshop currentBrownSailor beside comparison; fixed imported20% trial64/front/resting/centre/orbit0; main/focused unchanged. Four tabs retained, workshop/fixed warning-error logs empty, loopback server reused.

Another chat can run per README and inspect http://127.0.0.1:8791/; optional trial imports via saved-study control at /research/movement-fixed-camera.html. Full geometry rerenders rather than using stored raster/SVG pixels. No game integration authorized. Only isolated research/review/UI reference/backups/docs/root append changed; originals/archives/existing user work/livegame/backend/portfolio/config preserved. No publishing/deployment/integration. Goal active; next useful step assess Brown whole-body silhouette and expressions rather than treat a small sleeve change as finished reconstruction.


## Optional lower-eye outline — 2026-10-09, 01:39 EDT

Previous turn made progress through editable sleeve-span study/browser evidence. Current renderer adds optional headBasis.faceStyle.lowerInk, neutral flat-eye opening outline only, fallback.70 retains all defaults. Before source research/chibi8-before-lower-eye-ink.js preservesf89f. Current SHAaca5f0d6c10ba020f9e4680e4ade89fc9842ac4d13766ddabd516f073ac4322d. Heavy upper lids, iris, corners, brows, mouth and all geometry unchanged. No Bezier or image-model pixels.

research/lower-eye-ink-study.cjs: current.70/moderate.45/light.30,24 enlarged face crops/48 native32+64 sprites,1152 finite views(two outfits/six expressions/32angles/three choices). Original head crops displayed unchanged. Full moderate editable geometry saved review/lower-eye-ink-study.json. Inline VM compatibility check exit0:4608 default full SVGs exact versus before API(two characters/three outfits/six expressions/four poses/32angles); cloned geometry differs only lowerInk;64 neutral drawings match after omitting eye-white paths. Defaults retained.

Actual browser32 scenes/current+moderate/eight facings/visible envelopes32+64/resting/centre/orbit0/courtyard. check-lower-eye-ink-browser.cjs exit0:32 source-exact facing SVGs/8 saved SVGs,16 image pairs identical outside96x120 character region; visible-facing pairs changed13..63 pixels, rear pairs unchanged. Actual static comparison/courtyard board/workshop screenshot displayed/scrutinized. Assistant judgment: lighter lower rim emphasizes retained heavy lid enlarged, modest native effect. Not whole-face reconstruction or owner aesthetic approval; no live-motion/device proof.

Exports refreshed16default+16explicit; outfit export checker0/sourcehash/bounds/feet; parameter504+504 roundtrips0. Four primary current Brown boards refreshed0, original copies identical. Renderer/app syntax0. Initial wrong research/export-review path failed1; corrected root export-review.cjs succeeded0. Filechooser initially timed out during reload preparation; waited for authoritative Ready on same tab and import succeeded.

Workshop two reference entries/accurate notes; app/index before-copies preserved. Fixed left CURRENT BrownSailor64/front/resting; workshop current beside actual outline comparison; main/focused reloaded current source. Four tabs retained; workshop/fixed warning-error logs empty. Localserver reused. To try moderate: saved-study chooser at /research/movement-fixed-camera.html, wait Ready, load review/lower-eye-ink-study.json, wait Ready. Preserve full geometry+circle flags/source API. Stored raster/SVG fields are not textures. Run/integration instructions remain README; integration not authorized.

Only isolated prototype API/research/review/UI/backups/exports/docs/root append changed. Originals/archives/userchanges/livegame/backend/portfolio/config preserved. No AI generated, publishing, deployment or integration. Goal active. Next address overall facial construction against original; do not treat small ink comparison as completed resemblance.


## Central fringe code trial — 2026-10-09, 01:47 EDT

Default unchanged (aca5); full optional longer1.0 geometry review/reference-sweep-study.json. Current/moderate/longer,32 sampled fractional turns and actual32/64 courtyard comparisons selectable in workshop.16 new trial scenes compare16 prior current captures; browser/source/locality checks pass. Only own sailor0/1/7 fringe tip/bend/return coordinates change; profiles/rear, face/body remain. Intermediate eye/hair tangencies and owner preference unresolved. Import full JSON locally after Ready in fixed-camera preview; stored rasters not used. Internal AI05/prompt/provenance isolated research/ai-internal/, displayed/scrutinized, no generated pixels consumed. See internal README/root history for evidence/rejections. No game integration or deployment.


## Optional authored intermediate hair and selectable turns — 2026-10-09, 02:02 EDT

Current source SHA256 b962a24ef2bf22e62f7779a9b378e1173f6338bc4d23225fefeda34bde6f556d. Before API preserved research/chibi8-before-head-inbetweens.js (aca5f0d6c10ba020f9e4680e4ade89fc9842ac4d13766ddabd516f073ac4322d). Default geometry retained. Optional geometry.outfits.sailor.headInbetweens['6.5'] supplies a 24-number fringeEdge array matching endpoint landmark order; own intermediate record blends independently on either half of the segment. Its bend point5 also overrides circularSweepBends during that segment. Missing record preserves previous output. No finished-image reflection, Bezier or AI pixels.

Full editable review/fringe-half-turn-study.json extends previous reference-sweep-study with only sailor6.5 fringeEdge; tip/bend/return lifted away from near eyelid. Previous and higher variants remain static comparisons. Import locally via saved-study chooser in research/movement-fixed-camera.html after Ready. Select Sixteen-angle comparison, then292.5 degrees; both movement pages now expose sixteen actual facing buttons (eight-mode remains eight). New direction controls use actual texture indices and active state. Saved rasters/SVGs are not consumed as textures.

check-head-inbetweens.cjs exit0:4608 default full SVGs exact versus before API;768 principal full SVGs exact versus previous longer trial across expressions/poses/phases;32 whole blouse draws exact;2184 finite dense left-front draws. check-fringe-half-browser.cjs exit0:12 newly captured source-exact scenes at270/292.5/315,64/32; six pairs scenery unchanged outside character area; four principal pairs wholly pixel-identical; two intermediate pairs changed137/54 pixels within figure. Four actual UI records verify8/16 facing counts,270/292.5 selection and exactly one active card on both pages. Not new held walks/device/exhaustive overlap proof.

Default/explicit exports refreshed16+16; outfit checker/source hash/bounds passed;504+504 parameter roundtrips passed. Four current Brown construction/expression/body/outfit boards refreshed, original copies identical. Renderer/movement/fixed/app syntax checks exit0. Static sampled turn/courtyard boards and actual workshop/movement screenshots displayed and scrutinized. Assistant judgment: moderate lifted half-turn clears sampled near lid; native32 effect subtle. Default longer-fringe preference and owner likeness approval remain pending.

Run local server per README (existing loopback8791 reused). Fixed camera retains imported lifted trial16facings/292.5/64/resting/centre/orbit0. Workshop retains current defaults with comparison reference. Main/focused current code, four retained tabs and empty inspected warning/error logs. API extension is isolated; deliberate game compatibility work and owner integration authorization still required. No AI generated this pass, publishing/deployment/integration.


## Current sailor tapered-body construction — 2026-10-09, 02:15 EDT

Canonical src/chibi8.js SHA199a7f36d9064c9a825d1ed4af4089e22d94909c3882df26625dfa3f9e696405. Before source preserved research/chibi8-before-sailor-taper.js (b962). Current Brown sailor bodyScale .74 from.60; eight own sailorTop outlines taper towards narrower hem, retaining shoulder points and Y landmarks. BodyOffset14 and sleeve/trim/collar/tie/fold/feet geometry records unchanged; their rendered Y follows the new bodyScale. Round head100%/face/hair geometry unchanged. Alarmed head's translation follows existing body-lean rig, so its full transform changes intentionally. No Bezier or AI pixels. Assistant reference-grounded prototype choice, not owner likeness approval.

NewCanvas3 frontal shirt supports the taper; hidden rear/acting cloth inferred. Previous .60 and taller .82 remain comparison only. Full current geometry review/sailor-taper-construction-study.json matches current default. No import is needed for current sailor. Historical saved studies still rerender their own older bodies; do not mistake them for current parameters. Taper comparison/pose helpers frozen before-source for reproducible previous versus current contrast. Their sourceUnchanged means the frozen comparison file, not current-source validation. New adoption/current-browser checks supply current coverage. Older no-change assertions such as check-head-inbetweens default-equality cover the preceding API pass, not this intentional body change.

Alignment: current sailor data-foot-y224.6 from212, blouse217.8 retained. Use each export's anchor or bodyY234; do not hardcode the old212. Explicit export checker updated expected sailor224.6 with before copy. Fixed inspection camera now has an explicit preceding-frame REVIEW_PADDED_HEIGHT327.033; reload must not resize scenery when current character bounds change. At existing937x446 stage this yields cameraViewHeight15.193408125. Main movement camera behavior untouched. Preserve visible-figure family measurement and white border when comparing native sizes.

Checks: check-sailor-taper-adoption.cjs0:3072 current sailor full SVGs equal full study across6 expressions/4poses/4phases/32angles;6144 other Brown blouse/scarf SVGs exact;3072 Teal SVGs exact; flat finite circular arcs/lines only and224.6 anchor. Comparison helper0:3072 finite draws,32 blouse draws preserved, only8shirt arrays/bodyScale differ. Browser/pose checker0:768 head primitive-art sets exact,576 non-alarmed complete head groups exact;16 NEW imported-study scenes32/64 source-exact against16 PRIOR current captures;scenery outside character area exact. First overbroad full-head assertion failed on alarmed rig translation; scope corrected to distinguish artwork and actual pose, before checker retained.

Current-default browser verifier0:8 NEW actual default64 scenes source-exact and completely pixel-identical to corresponding imported-study captures. Initial default-frame check failed15.843824791666668 versus15.193408125, exposing geometry-coupled frame across reload. Preserved eight mismatched-frame captures/records and before camera source, fixed frame then recaptured8 on same tab; final checks passed.31 actual workshop SVGs exact (hero8principals16intermediates6size sprites), CSS heights12/32/48/64/96/124 verified. No new live walking/device/exhaustive overlap proof.

Source/app/fixed-camera syntax0. Refreshed16default+16explicit exports, source hash/16outfit anchors and504+504 JSON roundtrip checks0. Four current Brown boards refreshed0/original copies identical. Actual static construction/pose/courtyard and workshop/movement screenshots displayed and scrutinized; initial enlarged alarmed crop clipped, fit corrected and re-inspected. Assistant judgment: moderate taper gives shirt more space beneath collar;32px detail remains limited. Face/body likeness incomplete and owner final call. No AI generated this pass.

Run per README, current loopback8791 reused. Workshop currentBrownSailor beside construction comparison; fixed currentDefaultBrownSailor64/front/resting/centre/orbit0, no import; main/focused refreshed. Four preview tabs retained, inspected warning/error logs empty. Source/UI/research/review/exports/docs/backups isolated; originals/archives/existing user work/livegame/backend/portfolio/configuration preserved. No publishing/deployment/integration. Integration remains separate owner-authorized work. Continuous goal active; next tackle overall face construction against originals and continue gameplay-size/acting review.


## Optional coordinated sleepy-eye construction — 2026-10-09, 02:23 EDT

Current canonical renderer/defaults unchanged199a7f36d9064c9a825d1ed4af4089e22d94909c3882df26625dfa3f9e696405, including current tapered sailor body. Full editable review/sleepy-opening-balance-study.json changes only character.paperEyeOpening and headBasis.faceStyle neutral settings: opening1.00, lidDip .12/.105, irisHeight .68, lowerInk .55. Current .84/.08/.065/.6/.70 and deeper1.10/.16/.14/.72/.70 remain labelled comparisons. No new API, Bezier or AI pixels. Colour/eye anchors/brows/pout/head/hair/body geometry retained; own views are not mirrored. Original NewCanvas3 head crop re-displayed unchanged, supplying sleepy-expression evidence; palette and hidden sides remain adaptations.

research/sleepy-opening-balance.cjs0:1152 finite drawings(three choices/two outfits/six expressions/32angles);1280 other-expression full drawings exact across two outfits/four poses. Comparison PNG has24 enlarged face crops/48 native32+64 sprites and unchanged original. check-sleepy-opening-browser.cjs0:full char differs only opening/faceStyle;1024 neutral body groups exact(two outfits/four poses/four phases/32angles);16 NEW actual imported-study scenes source-exact at32/64 compare16 PRIOR tapered-body scenes(8default64,8imported32), prior SVGs source-exact; changed pixels only in each size's eye band, six rear-view pairs entirely pixel-identical. Counts visible pairs26..151 changed pixels.32 fractional code face crops/64 native sprites inspect turn ownership. Not32 newly captured scenes, new live walking/device tests or exhaustive overlap proof.

First capture attempt used stale73 AX text instead of current72 slider, failed before saving new scenes; inspected full state and corrected on same tab. Initial pixel assertion incorrectly used64px eye band for32px grounded figure and failed; measured full difference bounds before adjustment, then separate64/32 eye-region assertions passed. Before checker preserved. Initial comparison bottom annotation was too near native sprites; spacing corrected. Source helper and checker final exit0; app syntax0. No renderer change or export refresh this pass.

Actual comparison/turn/courtyard/workshop/movement PNGs displayed and scrutinized. Assistant judgment: middle trial reveals more blue below retained heavy lids enlarged/64, subtle32; deeper version makes lower cup too prominent. Residual far-eye shape near left-front intermediate turn remains a limitation, not proven reference likeness. Current face retained and no owner approval inferred. Next improve far-eye corner/upper-lid construction using original rather than adopt this as finished face.

Workshop adds three code study references/accurate note, before app/index backups preserved. Current default character beside comparison; fixed imported middle trial64/front/resting/centre/orbit0. Four tabs retained and inspected warning/error logs empty; loopback server reused. To try full middle geometry locally: saved-study chooser at research/movement-fixed-camera.html after Ready, load review/sleepy-opening-balance-study.json, wait Ready. It rerenders geometry, never stored raster/SVG pixels. Run instructions remain README; source/style in RENDERER-HANDOFF. Full study is internal local review and not shipping assets; deliberate game integration needs separate owner authorization.

Only isolated research/review/UI/backups/docs/root append changed. Original drawings/archives/user changes/livegame/backend/portfolio/configuration preserved. No AI generated, publishing/deployment/integration. Goal remains active.


## Current left-front neutral far-eye depth — 2026-10-09, 02:41 EDT

Current src/chibi8.js SHA256 dcc66d6731a4abf85c9d32860656f32bdbd868f9e25720edf3e2f0b6abe21745. Brown headBasis.farEyeDepthTurns['6'].neutralDepthPower=2 makes the far eye emerge shallower between270 and315 degrees; upper-lid sag is capped at40% of opening height in that targeted neutral interior turn. Missing power defaults1, preserving older full saved studies. Right-front turn, eight main drawings and other expressions retained. No Bezier, finished-image mirroring or AI pixels. Current tapered sailor body remains .74 scale/offset14, with224.6 foot anchor; blouse217.8. Hidden turn anatomy and overall likeness remain provisional.

Before sources preserved research/chibi8-before-neutral-depth-power.js and chibi8-before-neutral-depth-default.js. Full editable current trial review/neutral-depth-power-study.json; previous linear version neutral-depth-power-previous.json. Comparison helper frozen before-default for reproducibility. Use current character without import; saved JSON still rerenders editable geometry locally. Run and integration instructions remain README; no game integration authorized.

Technical evidence: check-neutral-depth-adoption.cjs exit0:6144 full drawings match current study,1536 principal drawings exact before default change,6048 other-expression/sector drawings exact,1728 other-character drawings exact,160 old saved-study drawings exact. Dense comparison helper1086 finite left-turn samples. Twelve NEW browser comparison scenes source-exact: four principal PNG pairs entirely pixel-identical;292.5-degree pairs change17 pixels at64 and7 at32, only eye region. Six additional NEW current-default scenes source-exact and whole PNGs identical to trial. First height assertion used string equality for64.00000000000001; corrected to numeric tolerance1e-9, before checker preserved.

Actual workshop31 SVGs source-exact at292.5 hero/eight principals/sixteen intermediates/six native heights12,32,48,64,96,124. Full workshop and movement screenshots displayed and scrutinized. Initial screenshot capture failed; same-tab viewport captures then full workshop capture succeeded, no server restart. Four tabs retained and inspected warning/error logs empty. Fixed preview current defaults,64 visible-family height,292.5 degrees,resting,centre/orbit0; main movement and focused art review refreshed. Existing loopback8791 reused.

Exports refreshed16default+16explicit, outfit/source-hash checks and504+504 parameter roundtrips exit0; four current construction/pose/expression/outfit boards refreshed and original copies identical. Source/app syntax exit0. New workshop reference entries and notes; before app/index copies retained. Assistant judgment: squared emergence reduces the little round far-eye cup, cubic trial too shallow. This is a modest continuity correction, not owner aesthetic approval, live-motion/device or exhaustive overlap proof. No new AI generation. Continuous task active; next improve whole face/body resemblance against originals. Only isolated prototype and append-only root handoff changed; originals, archives, user changes, livegame/backend/portfolio/deployment configuration preserved. No publishing, deployment or integration.


## Selectable whole-body proportions — 2026-10-09, 02:53 EDT

Added optional Body construction control to workshop, focused review and both movement pages: Current, Broader compact, Broader taller. src/body-construction-study.js returns unchanged character for Current/Teal/unsupported costume; otherwise clones full geometry, coordinates bodyScaleX116% or128% with sailor vertical scale.82/.88 and blouse.90/.96. Underlying eight own XY records/head/face/hair/palette retained. Compact sailor foot231.8/blouse225; use actual export anchors rather than current-default224.6/217.8. Canonical src/chibi8.js and defaults unchanged SHA256dcc66d6731a4abf85c9d32860656f32bdbd868f9e25720edf3e2f0b6abe21745. Current remains default on reload. Saved full studies bypass/disable preset control, preventing double application. Other optional face/neckline helpers compose before body helper. Save this study records resulting full editable character.

research/whole-body-proportion-study.cjs produces current/compact/taller PNG, both outfits/eight principal views/32+64 padded-frame samples and unchanged original. Six full editable review/whole-body-{current|compact|taller}-{sailor|whiteBlouse}-study.json files; generated source hash retained. Initial board used geometry-dependent bounds; corrected to common inspection frame so head scales match (before helper preserved). Final helper exit0:2304 finite flat arc/line renders across choices/outfits/poses/expressions/16 angles; source unchanged. Inline body-turn board32 enlarged resting samples displayed; native and enlarged boards self-scrutinized. No new AI image generation or AI pixels.

32 NEW actual courtyard compact-trial captures: eight main directions, both outfits,32 and64 visible-family envelope. check-whole-body-browser.cjs exit0 verifies32 recorded SVGs equal editable studies, constant scene frame, centred resting position, finite native sizes, actual937x446 PNGs; board uses unscaled crops. After controls implemented,70 actual SVGs across four pages source-exact and96 helper draws match six saved studies; Current returns original object. Additional2 NEW64 front captures from selector and imported full study: both source-exact and whole scene PNG pixel-identical; import disables preset control. Cleared import afterwards, compact preset remains active. Does not establish held movement, real-device or exhaustive overlap correctness. Five touched JS syntax checks exit0. Wrong guessed review.js/art-review.js/source-app paths during inspection reported missing; corrected to root review-app.js/app.js without writes to missing paths.

Actual focused-review and movement screenshots displayed/scrutinized. Assistant judgment: compact has clearer shoulder mass at32/64 but exceeds original frontal shoulder width at matched head size; taller blouse looks stretched. Trials remain optional, no owner aesthetic approval inferred. Head stays chosen100% circle, original is flatter, so matching width is approximate. Face/body likeness unfinished. Next useful step compare vertical collar/sleeve room independently of whole-body width, respecting original silhouette.

Run existing local8791 server per README; choose Body construction directly at review.html or movement.html. Import optional full studies via fixed-camera saved-study chooser after Ready; geometry rerenders, stored raster/SVGs not consumed. Workshop adds comparison/native courtyard references. Full backup copies of eight modified UI files retained in research before control changes, plus previous reference/board versions. Four tabs retained; inspected warning/error logs empty. Fixed left compact preset without import, sailor/front/64 visible-family height/resting/centre/orbit0. Main courtyard, workshop and focused review compact preset available; current remains selectable. No export refresh needed since canonical defaults unchanged. Integration instructions remain RENDERER-HANDOFF; no game integration authorized.

Only isolated prototype helper/UI/research/review/backups/docs and root append changed. Original drawings/archives/user changes/livegame/backend/portfolio/configuration preserved. No publishing/deployment/integration. Continuous goal remains active. Previous turn was progress: current far-eye API/default correction and actual browser evidence; this turn adds inspectable whole-body alternatives and interactive access.
