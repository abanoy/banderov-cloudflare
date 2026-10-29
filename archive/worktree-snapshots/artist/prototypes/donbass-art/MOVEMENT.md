# Three.js movement courtyard

Open http://127.0.0.1:8791/movement.html with the existing prototype server.
From the workspace root, start it with
`node .\prototypes\donbass-art\server.cjs` if it is not already running.
This page needs HTTP and WebGL; unlike the drawing workshop it cannot run by
opening its HTML directly. No npm install, build, backend or deployment is needed.

Held-key verification now covers all eight principal walks in the actual browser:
`review/keyboard-eight-settled-records.json` contains96 moving samples (12 per
heading), all four step frames for each, displacement signs and retained idle
facings. `review/keyboard-eight-live-walks.png` shows actual screenshot crops at
native capture pixels, default100% brown sailor/96px padded CSS height. Each key
or diagonal chord was held two seconds from centre; back-left stops near the
left pillar. This verifies eight short manual walks, not a complete demo loop,
game integration, real-device speed or aesthetic approval.

The first run exposed diagonal key release changing45° to0°. Both previews now
use `settleHeading` in movement-math.js: fresh walks face immediately; a changed
heading during a continuing walk must persist40ms. Position responds immediately.
Brief partial chord release does not overwrite the facing before idle. This is
a small turn delay, not a physics/delta-time change. `check-facing-settle.mjs`
checks release sequences, sustained turns and wrap; check-movement.mjs retains
the40 direction/collision cases. Earlier records/screenshots remain under
keyboard-eight-walk-records.json and keyboard-walk-*.png; settled captures use
keyboard-settled-walk-*.png. Fixed-camera diagonal45° stop was also observed.

Body width now offers the workshop's80–100% brown Maria trials in both courtyard
pages. Release the slider to rebuild the32/64 SVG-derived textures; wait for Ready
before comparing or capturing. The source default remains100%. Teal keeps100%
and disables this study. Character bodyScaleX narrows body geometry without changing
the head, sprite bounds or vertical foot anchor. Capture caption/download name
record body width, so a90% trial is distinguishable from a100% comparison.

Current actual browser evidence: review/courtyard-body-width-comparison.png/JSON
compare fixed96 front100/90 captures; review/courtyard-width90-eight-captures.png
shows eight individually selected scene textures at common native-pixel crops.
Browser physical pixels can exceed CSS size. Live-demo sampling separately saw
four foot phases and0/45 headings; it does not prove a complete eight-heading
demo path. The later manual held-key checks above provide separate eight-heading
evidence. A337.5-degree texture and fixed32px scene were inspected separately.

Click the courtyard and hold WASD/arrows to move; Shift runs. The on-screen
direction pad supports held pointer input. “Walk all eight directions” runs a
repeatable octagonal path; stop it before manual review. Return to centre resets
position and facing. Select brown/teal Maria and an expression. Sprite height
changes orthographic scale (32–160 CSS pixels for the common full texture bounds).
Camera orbit changes the view around the courtyard; movement stays screen-relative.
Follow Maria recentres the camera. Motion bounce is optional and initially off.
Paper steps is initially on: a four-frame rest/lift/rest/other-lift cycle moves
only the feet under the hem. Turn it off to compare the original resting views.
This is an inferred flat-paper movement experiment, not a finished walking rig.
Eight directions is the default; sixteen-angle mode demonstrates intermediate
renderer views. The original drawing and all eight SVGs remain beside/below it.

`movement.js` uses the same `src/chibi8.js` as the workshop. Character/expression
changes create 32 or 64 cached CanvasTextures from freshly rendered SVGs (four
step phases for each of 8 or 16 directions). There is
no AI image, fetched sprite sheet or separate character drawing implementation.
Texture generation reads each returned SVG viewBox and rasterizes at twice its
renderer-unit dimensions. World scale follows width/height divided by100. The
`data-foot-y` attribute sets the ground anchor (fallback234 for older renderers):
sailor212, white blouse217.8, default scarf/teal234. Sailor bodyOffset14 exposes
more collar/sleeves beneath the circle; its former tucked-under anchor was198.
Shorter outfit bodies retain
the same head geometry and uniform ink/border widths. This browser texture
cache is a rendering step, not an alternative editable source or shipped asset.

Integration: pass optional `walkPhase` (cycle fraction) alongside character
parameters to `chibi8SVG(character, degrees / 45)`. Zero or omitted phase keeps
the resting drawing exactly. The current cycle lifts foot0/foot1 alternately by
at most five renderer units multiplied by outfit bodyScale; it moves the colour
and white underlay together. Sailor foot0 is authored anatomical right and foot1
left. Other outfits retain their existing authored array order. No opposite view
is mirrored. Returned viewBox and nominal foot anchor remain stable throughout
the cycle. Read bounds from SVG: the shared Round O head changes their height.

The sprite is an unlit camera-facing Three.js SpriteMaterial, preserving flat
colours while the floor and pillars use scene lights. Alpha testing/depth writing
allow pillar overlap. Its small floor shadow is a simple circular contact cue,
not a physical character shadow. There is no game-lighting integration. Camera
pitch, arena, speed, collision radius and geometry are provisional feel settings.
These are eight static facings moving around a floor, not a completed animated
walk cycle. Bounce does not animate limbs.

`movement-math.js` maps screen input to world x/z using camera azimuth, normalises
diagonals, quantises relative facing and constrains arena/pillar movement.
`node .\prototypes\donbass-art\check-movement.mjs` checks all eight screen
directions at five camera angles, equal diagonal speed, wrap, idle and collision
examples. This is not a game integration or exhaustive collision/animation test.

Three.js **0.186.1** was downloaded from the official npm registry into a new
`vendor/three/` folder. Only package build/three.module.js, build/three.core.js,
LICENSE and package.json were extracted. The original package archive is retained.
No existing archive or project dependency/lockfile was modified. Three's MIT
license remains beside its files. The scene loads these local modules; runtime
uses no CDN. Official references: [SpriteMaterial](https://threejs.org/docs/pages/SpriteMaterial.html),
[CanvasTexture](https://threejs.org/docs/pages/CanvasTexture.html),
[OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html).

Keep this courtyard/UI/dependency/reference material outside live-game packages.
The renderer and scene adapter still require owner review before a separately
authorised integration. No live game/backend/portfolio/configuration was changed.

The courtyard now has a Pose selector using the renderer's relaxed/crossed/speaking/alarmed pose values. Alarmed is a brown-only Teaser acting draft with a tilted head and spread bare arms. Expression remains independent; pair it with Shocked for the reference comparison. See PRIMITIVE-GEOMETRY.md for bounds, returned foot anchors and evidence. This does not add walking limb animation or change movement math.

Scene capture: Capture scene PNG renders the WebGL scene immediately and displays a labelled snapshot below the stage, with a Save this PNG link. The snapshot includes the floor and props; it excludes toolbar/reference controls. It stays a snapshot when settings change; capture again for the new state. No persistent drawing-buffer option is enabled. Review/courtyard-blouse-alarmed-32.png, -96.png and -160.png are actual browser scene pixels, not AI images or shipping assets. All three were displayed and scrutinized. The 32px view loses expression detail; the 96/160px views make the white border and alarmed silhouette clearer. Eight demo facings and changing positions were observed with blouse/shocked/alarmed; this is static-facing movement, not an animated walk cycle.

Size evidence correction: the main courtyard height slider changes the orthographic camera range, leaving the sprite world height fixed. The earlier 32/96/160 PNGs are scene-scale/camera comparisons, not a fixed-environment size test. Their measured visible bounds are 24×28, 71×81 and 117×136 pixels respectively; settings refer to padded texture height. Background subtraction includes antialias edges. In the disposable research/movement-fixed-camera.html review, camera scale stays at the 96px baseline and only sprite world size changes. New courtyard-fixed-camera-blouse-32/96/160.png captures are 937×446 with visible bounds 24×27, 71×81 and 117×136px. Pixels outside the declared character rectangle match exactly across all three. See review/courtyard-size-measurements.json and research/measure-courtyard-sizes.cjs for hashes, camera/world scales, measurement method and limitations. Original captures remain intact. The disposable page also offers original zoom mode/background capture for measurement; it is excluded from live-game integration. No geometry or likeness was adjusted to pass these checks.


### Current eight-way movement review (2026-10-08)

Actual browser main courtyard used current renderer SHA256 8e8da6334dba7fe8116baaf7c0c4292c68a6a95b1707460138a14e28d54de90a, brown sailor/neutral/relaxed, eight facings, Paper steps on, bounce off, camera orbit0, scene zoom96. Held all eight pad buttons for500ms. Browser AX observed expected0/45/90/135/180/225/270/315 facings after release. Separate current DOM observations record positive x/z displacement for every input and idle/walkFrame0 after release: review/movement-eight-pad-positions.json. One-off evidence analysis passed eight facing/moved/released-resting assertions (exit0). Cardinal/diagonal distances varied with timing and collision; up-right0.800 is near the right pillar versus roughly1.3 elsewhere. This is not a timed speed or exhaustive collision proof. Full AX observations are retained in movement-eight-pad-observations.json.

Live demo was observed front0/walking, back-right135/walking, back-left225/idle when stopped, and a later front0/moving true/walkFrame1 with position0,0.729. Source confirms cached four-phase foot groups, but a24-sample asynchronous browser observation timed out twice (Runtime.evaluate/Page.getFrameTree); no successful complete live phase/cycle record was saved. Therefore do not claim all four animated phases or every demo facing captured in this pass. Eight independent deliberate movement inputs were verified instead. Native click+Space accidentally toggled demo twice; subsequent single click and AX proved it stopped. One stale button action failed before execution and was retargeted from fresh AX. No restart of the existing server/browser was needed.

The existing Capture scene PNG UI provided an unobstructed actual937x446 browser scene image. Saved review/movement-current-sailor-scene96.png by reading the displayed captureImage data URL, displayed and scrutinized. Page screenshot movement-eight-pad-browser.png partially cuts the actor at the old page scroll position; it shows the retained front-left facing in sidebar, not clean full scene proof. Native PageUp changed scroll framing only slightly. A guessed helper filename paper-steps-review.cjs was absent/read failed1; inventory identifies actual paper-walk-review.cjs. No source edit resulted. Main finally resetcentre/front0/idle,96/sailor/neutral/relaxed; current scene snapshot shown. Workshop remains current shocked blouse/alarmed left270 against Teaser; fixed remains shocked blouse/alarmed left270/32. All3 agent-created tabs marked deliverable; unrelated user tabs untouched. No fresh console logs this pass.

My judgment:96px scene retains the round paper silhouette and white border; subtle foot lift is still a draft, not full walking anatomy or aesthetic approval. Asked optional owner preference: subtle feet, mostly still cutout, or more visible limbs; pending. Current geometry/exports were not revised solely to pass movement checks. No AI asset, live-game/backend/portfolio/config changes, integration, publishing or deployment. Next useful work: owner-directed motion feel, or improve inspection of individual walk phases without changing the chosen face/head style.


### Frozen paper-step workshop inspection (2026-10-08)

Paper step selector in index.html/app.js exposes existing walkPhase0/.25/.5/.75: Resting, First foot raised, Feet together / half cycle, Second foot raised. It applies to hero/reference modal/eight principal/sixteen intermediate/native-size views using the same editable renderer. Active only for primitive brown/teal Maria; archived/projected and baseline characters do not receive phase. Default0. This is inspection of the existing simple foot lift, not new animation or owner-approved gait. Angle rotation remains independent.

Backups research/before-step-inspector-app.js and before-step-inspector-index.html preserved. Current renderer SHA256 remains8e8da6334dba7fe8116baaf7c0c4292c68a6a95b1707460138a14e28d54de90a; no renderer/geometry modification. Syntax app.js exit0. Browser recorded all four selector phases:32 principal drawings,16 intermediate drawings per phase,six exact12/32/48/64/96/124 CSS heights,stable viewBox,paired white-underlay/colour foot groups0 at.25 and1 at.75 translated-3 for sailor,none at0/.5. Evidence review/workshop-frozen-step-observations.json; one-off analysis exit0. Archived selector disabled/zero walk groups; teal enabled with paired-5 groups at.75. Previous projected guard checked in source, not separately exercised in browser. No unnecessary renderer/full-game rebuild/test sweep.

research/render-frozen-steps.cjs generated64 full views plus8 enlarged frontal foot details across sailor/blouse; both PNGs displayed and scrutinized: review/frozen-steps-sailor.png, frozen-steps-whiteBlouse.png. Enlarged details explicitly labelled not gameplay scale. My judgment: alternating feet/border stay connected and stationary body consistent; subtle at full figure scale, more visible blouse shoes. This does not verify all live courtyard phases or full walking anatomy. Owner motion-feel question remains pending. Actual browser screenshot review/workshop-frozen-step-browser.png shows selected second-foot phase/reference/controls, with body lower edge outside viewport; PNG boards provide complete figure inspection.

Final workshop restored brown/sailor/neutral/relaxed/front0/circle100%/Resting beside NewCanvas3 construction crop. Main courtyard preserved96/front/idle, fixed left270/32/shocked blouse/alarmed. All3 existing agent-created tabs marked deliverable, localserver reused; no other tabs/chat/source changed. Guides CURRENT-STUDY/MOVEMENT updated; append-only root history preserved. Original references/archives/live game/backend/portfolio/configuration untouched, no AI asset, integration, publishing or deployment. Next useful step is owner's movement preference or profile/body refinement from the new inspectable phases, not treating technical checks as aesthetic approval.

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
# Foot inspection — 2026-10-08

The retained Sailor foot-order correction was inspected with all eight facings × four frozen paper steps at the default 96px padded sprite height. Actual scenes and records are in `review/foot-order-courtyard-*`; `check-foot-order-courtyard.cjs` verifies unchanged environment outside the feet and exact visible source SVG correspondence. Separately, all eight pad controls held for 600ms moved in the expected direction and settled idle with the correct facing. These are browser checks, not a recorded full gait, calibrated speed or real-device result. Current figure proportions and resemblance remain subject to the owner's judgment.


## Actual16-facing courtyard review — 2026-10-08

review/cover-orbit-browser-board.png contains32 actual fixed-camera browser PNGs,16 camera-relative facings at each32/64px padded texture height.96×120 scene crops are enlarged2× with nearest pixels; Maria is stationary/resting, camera orbit changes the scenery. The camera slider supports−180…180 in15° steps, so valid orbit values were selected to quantize to each22.5° sprite direction. An initial22.5° slider fill failed; inspected DOM limits and used supported increments. No guessed hidden camera control or renderer script was executed in the browser.

Run node research/check-cover-orbit.cjs: exit0,32 actual937×446 PNGs/32 exact visible DOM facing SVGs after empty-tag/clip-ID normalization,16 unique facings at each size; expected relative direction, centre position/resting phase/size verified. Current sourceSHA05f09035dc1689dc9a0a0ad9cd7322ef288a751e4accd8f71f2305b7f4dd0349. This proves visible facing-preview correspondence, not canvas texture pixel equality, continuous motion, walking phases/input speed/device coverage or likeness. Contact PNG and actual workshop/reference screenshot displayed. At64px partial cheek was visually readable;32px face detail remains hard to judge. No geometry change adopted.

Workshop now selects this real-capture board with clear labels/provenance. App syntax0 and browser warning/error logs empty. Fixed courtyard restored to centred/live/front, orbit0,64px,16-facing mode; all three tabs retained/server reused. No integration/deployment. Source/current saved geometry from previous pass remains authoritative.

## Courtyard background contrast — 2026-10-08

Main and fixed-camera courtyards now offer Original courtyard(default), Light paper and Dark night. Shared courtyard-background.js edits scene background/floor material/grid uniform only. Character SpriteMaterial/textures/geometry and existing lights/props/shadow remain fixed. Original palette stays default. Capture captions and filenames include selected background. Fixed camera remains sprite-only scaling; main size still zooms scene. Before HTML/JS copies preserved. Initial PowerShell string substitution expanded dollar syntax in an inserted handler; corrected explicitly to the existing by-ID helper before browser execution.

review/courtyard-contrast-board.png contains32 actual fixed-camera PNGs: eight idle sailor facings at64/32px padded sprite heights on two contrasting floors.96x120 crops enlarged2x nearest for inspection. Actually displayed/scrutinized; assistant judgment white border reads strongly on dark floor, small garment details difficult at32px on both. No geometry change. Run node research/check-courtyard-contrast.cjs:32 source-matching visible facing SVGs, correct directions/size/background/stable centre/idle frame0, identical SVG per paired background, actual scene background pixels differ.937x446 scene captures verified. This does not prove canvas sprite pixel equality, complete motion, input speed, other outfits/poses or likeness.

Shared/main/fixed/app syntax0. Actual main dark palette/capture caption/background filename/Ready8 status verified; whole-page PNG displayed. Workshop board selected/note checked; workshop/main/fixed warning/error logs empty. Four tabs retained/server reused. Main left96px/front/night; fixed restored64px/front/night. Source renderer remainsf6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c. No game integration/AI output/publishing/deployment. No backend tests needed or run.
## Outfit-stable fixed camera and white-blouse contrast — 2026-10-08

Actual source review found fixed-camera framing still depended on current texture bounds, so changing clothing/character changed the world frame. Corrected research/movement-fixed-camera.js: baseline padded height from canonical neutral sailor0; fixed mode uses that single camera frame and adjusts uniform sprite ratio by baseline/current padded height. Requested padded32/64 remains exact without stretching; existing sprite foot-centre computation stays. SceneZoom path retains per-current-bounds framing. Before JS preserved. Main courtyard and renderer unchanged. RendererSHAf6fab2f78aa52f5ee7f408d9a099206300f2177e6ab7dc2b8db7eaf84ecc372c.

review/blouse-contrast-board.png:32 real fixed-camera PNGs, eight idle white-blouse directions at64/32 on paper/night.96x120 crops enlarged2x nearest; displayed/scrutinized. Assistant judgment sleeves clearer at64, white torso details remain difficult at32, especially light floor. No character geometry adopted. Run node research/check-blouse-contrast.cjs:32 source-exact facingSVGs/correct direction/size/background/centre/idleframe0; constant observed cameraViewHeight15.193408125 and calculated padded64/32; background pixels differ. Run node research/check-outfit-framing.cjs:32 paired sailor/blouse scene PNGs exact outside96x120 character region, stronger actual scenery framing evidence. This does not prove sprite pixel equality, all poses, motion or likeness.

Actual Teal64/32 observations also report same cameraViewHeight and exact calculated padded64/32; representative character check only. Restored Brown/WhiteBlouse/front64/night; current capture caption/Ready8 verified, whole-page PNG displayed. Workshop board selected/note verified; workshop/fixed warning/error logs empty. Four tabs retained/server reused. Fixed/app syntax0. No new main input/device/backend check or deployment. Historical statements that fixed camera already stayed constant across outfits were inaccurate; latest correction is authoritative.
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
## Actual rotated-camera walks — 2026-10-09, 00:31 EDT

review/orbit-walk-records.json/32 scene PNGs record400ms held pad inputs, all8 directions at four camera orientations.90/-90 tested64px visible envelopes;0/180 tested32px. Not a fully crossed size/orbit test. Saved shallow blouse, neutral/relaxed/live steps; captures after release at phase0. check-orbit-walks.cjs verifies displacement direction/facing/retained diagonal/idle/source SVG/calculatedsize/worldframe. No exact speed/all live phases/collision/device claim.32 native200x190 scene crops in orbit-walks.png displayed. Source geometry/movement unchanged5590. Workshop comparison selectable; fixed restored centred64/front/orbit0. No deployment.
