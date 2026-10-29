# Floating Aerie — castle architect and local 8v8 skirmish

Local preview: http://127.0.0.1:8795/floating-castle/index.html . Original sketch remains at ../sketch-interpretation/index.html. The prior one-castle/two-island Aerie source and ZIP are preserved in parent history/aerie-before-ring/.

## Local 8v8 skirmish and castle architect

Open **8v8 Battle**, or index.html?battle=1, then Start. One human and seven allied bots fight eight enemies in one local simulation. WASD/arrows move and steer, left click aims/fires, 1/2/3 select Star lance/Comet fan/Orbit burst, Q/E rotate the camera, right drag orbits, and Space launches from a pod. Touch has movement and hold-to-fire with nearest visible enemy aim. The existing chibi, 45-degree orthographic camera, pixel50, textures and lighting remain. The tactical map lets you inspect each bot's current role, reason and route.

Health is 100, respawn is 4s with a 1.2s spawn shield. A controlled uninterrupted hit sequence takes about 2.6–3.0s from first hit to knockout; actual fights vary with range, aim, cover and dodging. Fan pellets share one damage allowance per volley per target. Actual triangle geometry blocks swept shots. Enemy player damage also removes 35% of that amount from the victim team's castle shield, then core. Castles begin with 2000 shield and 4000 core health. The shield-breaking hit is fully absorbed: shield reaches 0% while core remains 100%; subsequent hits reach core.

Standing on supported ground inside a tower's 14m capture radius claims it in 6s (modest assistance from teammates); enemies contest, and enemy ownership must first be neutralized. Owned uncontested towers charge for 12s, then launch a strike with 1.4s travel: 90 damage for each distant outer silo, 360 for the central Crown (15m capture radius). Contest pauses charging; neutralization resets it. The strike checkbox is a local testing option. These are charged attacks, not continuous passive damage.

Core zero starts a 30s evacuation. New tower strikes stop, pending strikes clear, respawns stop, and bots seek checked routes to safe arena ground. Human fire and existing projectiles still work. The warning footprint is calculated from the current castle collision bounds, excluding detached harbors. At expiry, anyone within that castle's horizontal blast circle is knocked out. Living actors outside every blast circle and above -60m receive a 100-point **local survival bonus**. No online reward or account statistic changes. If the six-minute match times out before a collapse, remaining shield+core decides the result without an explosion.

Bots use finite sight, delayed reactions, imperfect leading aim, reachable-objective scoring, teammate distribution, defensive holding, scouting, low-health retreat and supported projectile dodges. Their walking and pod routes use the same 120Hz movement solver as the human. A sampled map of floors/stairs/pads is explored at match start; route edges, connectors and pod arcs are physically checked. A blocked route is invalidated and replanned. Applied castle changes end the match and require rebuilding navigation. Pause and the battle menu freeze match time. This is a bounded prototype, not a claim of human-level tactics or universal arbitrary-layout navigation.

In Build castle, **Castle architect** compares six candidates from three fortress families, prioritizes Balanced/Defense/Beauty, samples 64 perimeter positions and defense lines of sight, and physically checks routes before proposing an editable draft. It changes neither the live map nor storage until Apply; Undo and Cancel remain available. Defense coverage and beauty are design estimates, not PvP balance scores. The capability catalogue marks physical cover and automatic/manual cannon, heavy battery and beacon defenses as usable in local matches. Online unlocks remain planned.

Conditional fitting now joins perpendicular wall ends, opens rampart parapets at neighboring stairs/gates and faces earthbanks toward adjacent masonry. Preview and applied geometry share the exact derived fitting, while stored tile definitions stay unchanged. The workshop explains adjustments. Full geometry tests, physical template traversal, architect checks, combat rule tests and native browser reports live in the unbundled parent test/ and review/ directories; reports distinguish deterministic fixtures from native input.

Banderov's current Room relay is limited to two sockets and does not provide authoritative sixteen-player combat. This preview therefore uses a local sixteen-actor match; it makes no network connection, changes no backend and does not claim real online 8v8. Production relay security, bindings and public/private play remain untouched.

## Current owner direction

The owner requested gentler pod controls, a populated ring arena and two elevated castles. The latest pass adds spinning charging orbs with ring particles, larger secured castle orbs, gates facing the arena, broken bridge ports, large/small flying ships and turret guns. Alternate 1404: Crusaders, the owner's manuscript, is the primary design reference; Anno 1404 was explicitly permitted as a secondary influence. This candidate stays isolated from the standalone/3D integration scenes, original assets and production.

The workshop expands land with player level, permits different-height wings on one plot, automatically carves stairs through overhead floors, gives high-level castles substantial masonry, and explores aesthetic rewards. Build castle opens a paused live3D workshop. New test drafts start at level100 with fortress stone and the terraced Sanctuary; saved older designs keep their existing cell positions on a level20 plot. The optional simplified grid shares the live preview. Click to place, drag to orbit, scroll/pinch to zoom, or use camera/Fit buttons. The selected layer determines placement; Rotation sets the next placed piece's direction. Apply to map updates geometry/collision, saves locally and returns the player to that castle entrance. Restore reverses that home's construction and returns its harbor to the original position.

Provisional land progression uses ten bands: levels1–10 have10×10 plots,11–20 have12×12, then two more plots per side each band up to28×28 at91–100. At8m per plot the maximum footprint is224m wide. All ten8m layers and all pieces/material choices remain unlocked for this test; online progression is not connected. Existing coordinates stay fixed while land grows sideways and backward, leaving the front entrance/pod pad in place. The side harbor shifts outward with the foundation; ships retain their dock gap and animation. The overview fits the enlarged castles. Shrinking a plot containing outside pieces is refused with guidance; it never silently removes them. Clear the draft or move outer pieces before shrinking. Undo includes plot/material changes. Up to720 pieces per home can be tested.

Fortress stone is the default test finish. Follow level previews timber at1–10, rough stone11–30, brick31–60 and fortress masonry61–100; each finish can also be selected explicitly. Materials reuse authored nearest-filtered texture/shader assets with distinct color/course scales. Masonry walls are3.2m deep with matching battlements and6m gate openings; timber walls are thinner. The classic floor part has1.2m-thick upper stone slabs and broad vaulted masonry supports; the new Stone terrace part instead builds a solid retaining mass. Neighboring blocks share perimeter support walls, and stair/gate bays remain clear. Starter courtyard, high citadel and twin keeps fit the chosen plot, with the latter demonstrating separate wings at different heights.

Auto fit derives stair clearances before building any geometry. A stair creates a rotated7.6m-wide,5m-deep opening in the floor tile immediately above, changing both the rendered slab and collider. Placement order does not matter and the stored floor piece remains intact; removing the stairs rebuilds its full slab. The upper landing is the adjacent cell beyond the stair crest and still needs a floor. This is a defined slab-clearance rule, not a general CAD Boolean system: arbitrary roofs, walls, towers, cores and unsupported multi-layer arrangements are not automatically redesigned or guaranteed walkable.

The draft and applied map share the same geometry factory. The preview is an isolated half-resolution renderer with a45-degree orthographic camera. Rebuilds dispose owned geometry and retain shared materials/crown resources. Closing preserves unapplied draft edits for this visit without changing the map/save. Applied layouts use version2 data in the existing crusaders-aerie-castles-v1 browser storage key, with independent per-home options and layouts. Version1 arrays migrate to level20/fortress without moving cells; storage changes on Apply/Restore only. Invalid saves restore originals; unavailable storage reports a visit-only result. No remote/account data is written.

Castle Character is a local heuristic design score, not an absolute aesthetic judgment. Five bounded categories evaluate coherent wings, planted courts, related heights/stair connections, welcoming approaches and a framed landmark. Multiple separate or asymmetric wings can qualify. Cannon spam, isolated garden floods and duplicate inputs do not provide direct bonus points. The score gives a local cosmetic rank (Sketch, Study, Composed, Signature or Showcase), also displayed while on custom castle ground. The proposed0–15% cosmetic-renown reward is shown for design discussion only; no online currency, rewards, combat power, defense strength or real rank/statistics are modified. Detailed progression and reward balancing remain owner design decisions.

The arena is a real annulus, outer radius108m and inner radius47m, atY0. Four7m-wide cardinal stairs now descend to a radius16m core island atY−12, leaving the other central gaps open. Visible treads sit over continuous solid ramps; the central core is the fifth, strongest capture objective. Twenty-four small houses line the outer band, with a broad circular lane, four glowing towers at(±57,±57), garden pockets near the inner rim, and four cardinal pod pads. The four orbs are capture objectives during the local skirmish described below. Houses and tower bodies obstruct walking/flight; small trim, foliage and ornament remain decorative. Additional edge shrubs, moss, flowers and hanging vines accompany eight waterfalls whose alpha fades to zero at the lower edge,112 drifting motes and96 spray particles. Water and particle updates use simulation time and pause with play.

Both castle foundations remain55m above the arena. Their origins are(-205,55,22)/(205,55,-22), rotated+90/-90 degrees so the entrance gates directly face the ring. Pod pads are now(-131,55.77,0)/(131,55.77,0), with floating-point roundoff. Rendered geometry, colliders and both route arrays use the same transforms. The terraces, spires, windows, banners, fountain, rocks and waterfalls remain; the keep's roof becomes an octagonal plinth supporting its large charge. Dusk uses violet roofs. The front/back owner billboard and all other character pins remain unchanged.

Six faceted orbs rotate inside tilted Saturn-like rings. Four arena charges have radius2.7m; both castle hearts have radius8.4m, anchored by four heavy cradle arms and a fixed metal band.304 small instanced particles orbit the six rings. Core rotation, orbital motion, engine smoke, cogs and combat turret aiming all use simulation time and stop during Pause. The four arena towers now charge discrete strikes during a skirmish; castle hearts are shield/core targets. The lower central arena core is the Crown capture objective.

Each castle has a timber-and-stone skyport with a crane, storehouse, cargo, mooring posts and a real six-metre missing bridge span. A48-oar sail galley and cog-driven larger vessel are paired with smaller courier sloops; four ships total. Primary hulls/decks/cabins, dock floors and castle turret bases collide. Ropes, masts, railings, gears, small guns and broken loose planks are decorative. Twelve turret mounts total include four larger castle defenses and eight ship guns. Ships are moored visual actors with slight bobbing, not controllable vehicles. A dock fall returns to the castle currently recorded as home.

The manuscript descriptions sampled as read-only body text include CHAPTER4 paragraph60 (floating ships/chariots and island artillery), CHAPTER6 paragraph61 (48 oars and coordinated charging),137 (long sail-and-cog battleships with smoke below),299 (mechanical flight assistance),302/306 (ship battery and blue cannonballs). Paragraph numbers are zero-based extraction positions, not page citations. The cannon battery styling and fleet borrow those cues; the giant orb cradles and skyport layout are this game's new interpretation. No canon claim, manuscript rewrite, original-asset replacement or imported Anno assets. Source hashes and extracted paragraphs are in the unbundled review/alternate-reference-extract.json. The preserved pre-port candidate is history/aerie-before-harbor.

Three ramp crests now trim the overhanging horizontal walkway and add short forward turning landings. A small seam overlap supports climbing and descending without opening the nearby walls. This fixes a reproduced submillimetre sideways-offset snag and descending seam, not a general relaxation of collision.

## Castle atlas, route inspector and defense drill

The owner clarified the architecture with six Shogun2 screenshots: broad, irregular, offset walled courtyards at a few different elevations, turning routes through gates and stairs, and a dominant upper keep. This supersedes our overly literal nested cake/pyramid interpretation of the earlier Minas Tirith / Helm’s Deep comparison. The atlas uses solid retaining masses, usable open baileys and distinct outer/inner defense layouts, preserving Crusaders stone, blue roofs and charging orbs. Supplied images are preserved under history/shogun-layout-references for observation only; they are not runtime assets or part of the portable package. Existing applied saves and classic starters remain available. `?build=1&template=sanctuary` opens an undoable level100 draft for direct inspection; it does not overwrite the map or saved castle.

Open the workshop's **Templates** button, or append `?build=1&templates=1` to the local URL. The library contains three editable families for each of ten level bands, covering every level1–100. Band-specific names, plot-wide compositions and increasing layers make30 plans: Rampart prioritizes the outer wall walk and batteries but has a more exposed interior; Sanctuary concentrates defense around an inner heart and sheltered courts with weaker outer approaches; Skyharbor favors distributed docks and galleries with less edge cover. These strengths describe the arrangement, not measured online combat balance. Each template uses the matching level plot, starts in the selected material finish, and can be edited. Loading replaces the draft only; Undo restores prior pieces and options. Existing classic starters and saved layouts remain supported.

Four additional construction types are available independently: Stone terrace (a solid masonry column reaching the selected layer), Rampart walk (a walkable battlement with a low rear parapet), Harbor deck (a timber-planked deck with mooring fittings), and Signal beacon (an animated practice emitter). The atlas uses contiguous retaining masses beneath broad courtyards, connected by gate routes and stairways. One editable terrace record represents the visible top and its solid body; decoration can retain that body with the optional solid flag. Replacing a terrace with a garden, cannon or other piece keeps its masonry, while Erase removes that piece and body. Explicit lower floors, landings and stairs open their story through a solid column; the immediate upper-floor stair aperture still applies. Classic vaulted floor parts remain available separately. The ordinary ten-layer/720-part validation still applies. Ports remain on the existing fixed castle foundation rather than adding free-form islands.

The newer curved parts still occupy one8m square grid cell. **Round bastion** is a radius4m stone column with48 facets; its visible top, side collision and empty square corners agree. **Curved wall** is a thick quarter-circle wall (outer radius4m, inner1m, height7.4m) on a circular base; Rotate turns its closed quadrant. **Earth & stone bank** is a closed rough wedge up to3.7m high, with the high back facing local−Z before rotation. Its raised outer toe blocks ordinary walking. It is scenery/support, not an alternate stair, and templates leave gate/stair/quay approaches clear. The atlas places these pieces around selected chamfered corners and unused perimeter cells while preserving the approved broad bailey layout.

The validated optional `footprint:'round'` and `solid:true` fields preserve a circular base when it is replaced with a garden, cannon or other decoration. An explicit Stone terrace resets the base to square; an Earth & stone bank resets it to a standalone wedge. Undo and local saving retain this distinction. Round slabs are clipped against the same stair aperture, so they do not hide a square floor or support. Displayed triangles are the colliders in both preview and applied map; these are faceted mesh circles, not analytic rigid-body shapes. Classic saved layouts without these fields remain compatible. `castle-curves.js` owns the shared closed surfaces and footprint rules.

**Check walkable routes** creates an isolated copy of the current collision geometry. The inspector samples standing surfaces on a conservative2m lattice plus cell centres, rejects buried surfaces, searches paths from the pod apron, then simulates each found route outward and back through the actual120Hz walking code. It checks support/headroom and reports disconnected floors, missing landings or blocking pieces with a suggested repair. Clicking a diagnostic focuses its plot/layer. Successful paths are drawn in the preview. Structural hints shown before a check are untested guidance. Editing cancels stale checks and clears the old report; neither the check nor its pathfinding changes the live actor, saved layout or player pieces. A failed conservative search is not proof no conceivable path exists. At changes between supporting meshes, additional4cm floor-continuity samples keep a route from clipping an empty circular corner; ordinary clearance probes and the final actual-physics walk still apply. Exact template objectives and test scopes are retained in the review reports. This is automated simulated traversal, not native human play or a guarantee for every arbitrary castle.

After applying a custom castle, expand **Castle defenses** below the launch button and start **Defense drill**. Three practice drones per custom castle approach weapon positions. Twin cannons recharge in2.4s, heavy batteries4.8s and beacons6s, with respective175/225/250m acquisition ranges. Targets must be within the weapon's facing sector and visible through real solid geometry; moving bolts also stop at blockers. Hits produce a flash and particle burst, followed by2.2s target respawn. Shots, hits and recharging counts are shown. Practice is opt-in and causes no player damage, resource costs, rank change or network action; this is not a full invading-bot combat game. Signal-beacon motes animate outside the drill. Pause freezes the shared simulation clock, Stop clears practice effects, and applying/restoring construction refreshes weapon references.

Defense effects use bounded pools:48 bolts,192 burst particles, three drones per home and up to32 ambient beacons, with at most four acquisition attempts per update. Their bounds are resource limits rather than an FPS/device guarantee. All geometry and effects are original procedural work using the existing texture/light pipeline; no external game assets or copied FOB systems are included.

## Pod and camera

WASD/arrows or the analog pad move and steer. Q/E or drag rotates the camera; wheel zooms. Overview frames the whole map; movement switches to following. Camera elevation remains45° in true orthographic projection. Pixelation defaults to50 (half render dimensions). Follow-camera obstruction fading includes ship sails as well as solid structures; sails keep their separate decorative collision status. Original materials return when they stop blocking the view or when Overview is selected.

The flight marker finds the nearest clear position around the actual HUD panels, including Settings, and points toward the projected destination when moved aside. Short landscape screens use a compact HUD with a separate central hint area. Location text reads the surface supporting the player, identifying each skyport and ship deck; recovery clears that location back to the home castle. These are presentation cues, not changes to flight or collision rules.

Select a destination and Launch Pod/Space from a glowing pad. The initial impulse supplies an unsteered ballistic arc, with gravity14m/s². Nominal duration is7.2s, extended for long trips to limit launch horizontal speed to45m/s. There is no guided correction after launch.

Any directional input immediately starts manual steering, but velocity now eases toward a28m/s target instead of instantly switching to43m/s. Default response8/s and acceleration ceiling110m/s² soften reversals. After you have steered, releasing controls applies horizontal braking at3/s (about78% speed reduction over0.5s). Vertical gravity continues unchanged. Before the first steering input, the original launch velocity remains so an untouched arc still reaches its destination. This is deliberate and explained in the UI; there is no vertical override or guided mode.

Settings includes steering speed16–43, response3–14 and release braking0–100 (mapped0–4/s), alongside the lighting/pixel/zoom controls. The owner must judge the feel; passing motion checks is not human acceptance. Pause/blur/hidden clear inputs and pause. Resume needs a fresh press. A held input is cleared on recovery, including remaining fixed steps in that display frame.

Falling below−85m or leaving the bounds returns to the last castle you landed/walked on; the arena never becomes home. Return button performs the same recovery. Support/obstructions use fixed120Hz mesh rays and a .48m actor radius. This is a local prototype, not a full rigid-body engine or network authority.

## Visuals and source

world.js owns ring, houses, paired castle transforms, routes and pads. aerie-castle.js builds the keep/rock/apron; castle.js contains the sketch construction and corrected walkways. charge-orb.js owns animated cores, rings, cradles and particles; sky-harbor.js owns docks, ships, guns and their idle motion. arena-garden.js owns the lower core/stairs and garden/water animations. castle-rules.js owns plot/material profiles and stair-clearance definitions; castle-beauty.js evaluates local composition cues; castle-templates.js generates the thirty atlas plans; castle-navigation.js samples and walks actual collision geometry; castle-defense.js runs the local practice drill and bounded effects; castle-construction.js validates/builds/previews/restores custom geometry; castle-preview.js owns the isolated live3D view and pointer placement; castle-builder.js and builder.css own the workshop/drafts/local saving. castle-affordances.js derives fitting and capability/perimeter analysis; castle-architect.js proposes physically checked castles. battle-navigation.js maps the current world; battle-bots.js owns local decisions and movement; battle-combat.js owns damage, capture, charging and evacuation; battle.js/battle.css present the match. flight.js owns movement. main.js connects controls, camera and UI. Ten seeded material textures, including sailcloth, are drawn256px then actually downsampled to64×64, nearest-filtered without mipmaps. Authored diffuse/additive vertex-palette lighting, dithered256px sky and adjustable ordered-dither/5-bit world pass retain the console-inspired look. The UI stays sharp. Daylight/evening/blue-hour presets remain. This is an authored SA1/PS1/Dreamcast-inspired approximation, not original game assets or exact hardware rendering.

Build from prototype root: python build-aerie.py. It syntax-checks JS, stages source and bundled Three/license, and verifies the ZIP. Only portable index navigation intentionally differs (original sketch link becomes packaged help); package includes a loopback-only Python server for8805. No additional dependencies or external assets.

Current atlas checks are castle-template-geometry.mjs (thirty distinct plans, plot/part/layer validation and actual objective support), castle-solid-terraces.mjs (real filled-body stairs in four rotations/both insertion orders, restoration and decoration body preservation), castle-navigation.mjs (all thirty authored plans plus three maximum-level reload/derived-objective checks with actual fixed-step walking), and castle-navigation-failures.mjs (blocked entrances, stair landings, overhead slabs, buried targets, real passages and cancellation). castle-defense.mjs checks bounded effects, true line of sight, emitter presence across all thirty plans and representative actual-geometry shooting. castle-atlas-ui.cjs uses native source/package controls for catalog/loading/Undo, body-preserving decoration, positive/negative route reports, Apply, defense Pause/Stop/Restore and direct-preview save isolation. castle-atlas-native-walk.cjs separately walks two maximum-level crown routes with normal browser frames and native inputs. castle-terraces-visual.cjs captures nine representative layouts; castle-bailey-detail.cjs uses an explicitly focused editor camera for a gatehouse close-up, not traversal. The new castle-curve-model.mjs validates closed surfaces and shape metadata; castle-curves.mjs independently walks radial boundaries, circular stairs, rotated wall arcs and bank/gate fixtures using the actual triangles. castle-curves-ui.cjs checks native shape editing, explicit resets, Undo, Apply and reload at desktop/portrait sizes. castle-curves-visual.cjs records declared focused editor-camera close-ups. Runtime hashes and exact outcomes are retained in review reports; pre-terrace and pre-battery results are historical evidence, not current acceptance.

Current progression checks are castle-design.cjs (source/package native level/plot/material changes, independent v2 saves, explicit v1 migration, shrink preservation and expanded framing), castle-beauty.mjs (pure composition/spam/invariance fixtures), castle-progression.mjs (ten plot bands, material/support geometry, harbor relocation, and fixed-step ascent/descent through all four stair orientations in both placement orders), and castle-auto-fit.cjs (native floor/stair placement, cut geometry, erase/Undo, draft isolation, Apply and reload in source/package). castle-native-walk.cjs checks the actual level100 courtyard route with normal-RAF native movement. Earlier workshop checks include castle-live-editor.cjs (native3D placement, live/simple synchronization, independent drafts, orbit/zoom, fitting, render lifecycle and map/save isolation at1280/390), castle-live-geometry.mjs (preview purity, clone ownership/disposal,3.2m walls and preserved original ramp junctions), castle-builder.cjs (native editing, local save/reload, independent restore, layer10 placement and explicit invalid/cap fixtures), castle-construction.mjs (synthetic original-scene preservation, validation/disposal and fixed-step stair fixtures), arena-garden.cjs (direct world-render and12 placed stair fixtures), and arena-native-walk.cjs (native west stair round trip and animation pause in source/package). harbor-hud.cjs checks56 native flight samples across four viewport sizes, including Settings obstruction and arrow direction. skyship-native-landing.cjs and harbor-dock-walk.cjs verify the actual supporting ship/skyport location labels as well as landings/recovery; sail-occlusion.cjs separately checks fade/restoration using declared camera fixtures. Reports/screenshots live in parent review/. Older UI suites assumed a fixed12×12 plot,240-piece limit and v1 saves; their historical pass is not a current progression acceptance result.

ring-castle-route.cjs checks the original castles through their full native ascent/descent routes; castle-native-walk.cjs separately checks the applied courtyard. Earlier ring-acceptance.cjs contains an open-centre expectation intentionally superseded by the requested lower core; world.routes still describes original artwork paths, not custom-builder navigation. Do not treat older successful runs or arbitrary new layouts as current path acceptance. harbor-review.cjs and the construction-detail image in workshop-review.cjs use explicit view fixtures, not native traversal. Physical-phone performance, human handling preference, universal camera occlusion and every possible custom stair layout remain unverified. Latest exact results and package size are recorded in root LLM.md.


## Playable fleet and defenses (2026-10-10)

Start an 8v8 match, walk along the stone boarding pier in front of your castle,
and press **F** (or Enter/Exit) near a friendly hull or gun. **G** cycles crew
seats, swapping with a bot if necessary. WASD steers a piloted ship relative to
the camera; **R/C** or Rise/Lower changes altitude. Left click fires the pilot
or gunner battery. Passengers may use their personal gun. F exits into ordinary
falling/pod physics, so disembark above land.

Each team has one 350-HP scout and one 900-HP crew ship with pilot, two gunner
and two passenger seats. Dawn's scout is initially left available for the human.
Destroyed hulls eject occupants and stop blocking actors/projectiles; replacement
ships return to the boarding pier after 22 simulation seconds. Replacements stop
during evacuation. Empty delivered ships return through a high cruise route.
Health bars show hull health; the seat panel shows your current station and HP.

Bots walk checked paths to the pier before boarding. Crews climb, cross and
descend to an outer island; troop seats disembark onto its real ground and favor
the nearby capture point. Pilots choose objectives from ownership, distance and
other friendly transports. Foot troops also contest the central Crown. This is
a bounded transport state machine with role preferences, not a learned tactical
agent; complex arbitrary aerial obstacles may still stop a route.

Existing harbor and placed cannon/heavy/beacon defenses now acquire visible
enemy actors and hulls, shoot real blocked projectiles, respect cooldowns and
allow manual entry. Fixed defenses have 240 HP and a 25-second repair delay.
Placed weapon ranges/cooldowns match their capability data (175/225/250m and
2.4/4.8/6s); ship batteries use 220m range and 0.85s cooldown. Friendly hulls block
fire without taking damage. Actor hits retain the existing shield/core rule.
Mounted occupants cannot capture a silo until they disembark.

The new islands have 36m-radius landing surfaces and dedicated pod pads. Ships
are not mandatory: validated pod journeys remain another travel option.
The Crown deals four times an individual outer strike, concentrating pressure
on the main battleground while outer objectives reward transport and splitting up.
All of this runs locally; no backend, account, online reward or deployment changes.


## Tactical combat pass

Four stone causeways now join the remote silo islands to the ring. Pods and ships
remain available. Navigation samples winding castle stairs diagonally and checks
those connections with the player's walking physics. One guard per team climbs
home; raiders attempt checked enemy terraces. Startup prepares these routes.
For edited castles, up to four actual upper approaches are checked; failed routes
fall back to silo duties rather than pretending a blocked route is usable.

Point at an enemy, ship or giant enemy orb to select its actual height. A gold
trajectory shows the predicted path; red means intervening geometry blocks it.
Moving targets receive a velocity lead. Recovery time and height appear above the
weapons. Predictions cover personal weapons and occupied batteries; they are an
aiming aid, not guaranteed hits against enemies that change direction.

1–3 select the original projectile patterns (0.22/0.34/0.60s recovery).
4 is a focus longbow: hold fire for 1.15s, release early to cancel; 1.4s recovery.
5 is an alchemist firepot: an arcing explosive, 10m blast, 2.2s recovery.
Blasts use distance falloff and solid cover, and do not hurt teammates. Ships,
defenses and castle orbs take direct projectile damage; area structure damage is
not included. Direct enemy-orb hits damage shields first, then core.

Charging longbows and firepots show bot aim traces. Original synthesized sound
cues start on interaction; SFX toggles mute. Hits, captures and a short kill feed
provide feedback, with KILLED name +100 for your kills. Scores stay local.
This remains a prototype of explicit role/visibility/path decisions, not a learned
AI or networked 16-player match. Physical-phone and subjective audio balance are
not verified.


## Per-match castle setup and startup

Before each battle, choose Use my saved castle or Let my team build one.
The saved option uses the last Dawn design applied in the workshop; without one,
it uses original Dawn. The AI option builds a temporary friendly fortress. Dusk
always receives a fresh AI plan, including on rematches. Select AI castle level
10–100 independently of your saved castle. Plans rotate among the three fortress
families and vary defense/garden choices; this fast template planner is separate
from the workshop's deeper six-candidate architect search.

Match layouts are never written to workshop storage. Explore map or opening the
workshop restores both applied personal layouts. Cancelled/failed setup also
restores them. Apply to map in the workshop remains how to save your own design.

Setup shows its current stage and elapsed time. The covered 3D scene stops
redrawing while navigation is prepared. Upper-route warm-up has a one-second
budget per candidate (four per castle); a timed-out search is not cached as an
unreachable route, and ordinary bot planning can continue later. Versioned module
imports prevent stale browser files from breaking the new setup interface.


## Shadow identity and reconstruction effects

Enemies use the existing chibi silhouette with dark ink, a pink edge and a
pink downward triangle. Allies retain their original colors and a cyan diamond.
An enemy entering the camera view transitions into shadow over 0.65s with broken
scan strips and glitch fragments, then stays dark with a few drifting fragments.
The HUD labels allies and shadows. Identity is relative to the local player's
team, rather than permanently attached to Dawn or Dusk.

A knockout leaves a position-locked, block-dissolving ghost for 0.85s. The actual
respawn event creates a 1.3s beam and expanding floor ring at the return position.
These effects follow match time, pause with the game, and clear on restart/exit.
They are presentation only: no changed hitbox, damage, invulnerability or respawn
rules. Original sprite files/maps are preserved. Effects use a fixed384-shard pool
and16 reusable ghost/beam records; world depth still occludes the effects.

## Auras, ownership and visible assembly

All living actors carry a camera-facing aura: allies glow cyan; enemies have
dark violet vapor alongside the existing glitch silhouette and pink triangle.
Effects use simulation time and ordinary depth tests. Owner chibi art is intact.
Dusk castles remain dark in exploration and battle regardless of chosen parts.
All five silo structures fade toward dark enemy ownership or luminous allied
ownership over approximately two seconds; recapture reverses the transition.
Shared textures, lighting controls and neutral surroundings remain independent.

Kill bonuses appear at the bottom centre for three simulation seconds. Ordinary
hit and capture popups cannot replace a current kill bonus.

Match AI still chooses seeded fortress families with defense/beauty variations;
it is a rule-based planner, not a learned builder. Its actual castle pieces now
assemble visibly for seven seconds, foundation through ascending tiers, followed
by architectural details and the secured heart. Select **Let my team build one**
to see both teams assemble; **Use my saved castle** preserves Dawn and assembles
only Dusk. Collision/navigation preparation follows completed assembly.
Cancellation restores the personal applied castles and exact piece transforms.
No AI plan overwrites workshop saves. Large levels still need setup time.


Electric castle defenses (2026-10-10): A fitted electric envelope covers each castle. Enemies touching it, including ship hulls and occupants, are instantly knocked out; friendly units pass safely. Ordinary projectiles are absorbed without shield damage. Captured silos alone penetrate the shield. Shield/core maximums are now 8,000/16,000 (+300%, four times previous values).
Silos arm for 60 seconds, accelerating their rings and particles continuously to 16x idle speed, then remain armed and strike every 12 seconds. At 50% loss of owned capture control they latch a three-second discharge. Full capture plus completed discharge starts a fresh minute. Contested presence pauses charging until the cutoff. Core loss disables all team battery guns, including ship batteries and manual stations; personal weapons remain available during the existing 30-second evacuation.
Shield impact arcs, contact lightning, collapse bursts, charge/discharge and battery-off audio are synthesized locally. Audio requires an initial interaction. Health increases extend battle pacing; the six-minute match limit and strike damage are unchanged. AI avoids raiding powered enemy castles and transports avoid their envelopes; local automatic hull avoidance is bounded, not comprehensive navigation for arbitrary builds. Shields use fitted ellipsoids and ships use swept hull bounding boxes.
Verification: test/electric-shields.mjs checks contact, projectile ordering/immunity, arming, interruption, power reset and level-10/100 coverage. test/electric-simulation.mjs checks actual default-world transport, landings, captures and armed strikes over 150 simulation seconds. It does not certify upper-castle route coverage. review/electric-study.html provides an explicitly controlled browser fixture for shock, shield break, core loss and battery lockout. No production deployment or online multiplayer acceptance.

Silo readability / match variation (2026-10-10): The main clock counts elapsed simulation play time upward and retains total duration at the end. No six-minute timeout; a core defeat and 30s evacuation decide completion. The separate evacuation warning still counts down for escape urgency. World-anchored T1 Northwest/T2 Northeast/T3 Southeast/T4 Southwest/Crown Central names follow each orb with ownership tags; capture notices and HUD use those same identifiers.
Allegiance now includes local island ground, rocks and plants authored outside the silo structure group. Enemy ownership adds a dark surface veil and 48 pooled flickering glitch fragments per silo, including Crown; all fade smoothly on recapture. Match preparation uses fresh cryptographic seeds, mixed family/goal choices and battery-type variation, avoids last family per AI team and matching AI family across teams. Saved player castles remain untouched. This varies authored fortress plans, not learned architectural synthesis.

Bot sizes / fleet / meltdown (2026-10-10): Setup offers1v1,2v2,4v4,8v8,16v16,32v32,64v64; one Dawn seat is the human. Active actor lists, combat, identity and roster reflect selected size. Route searches have four concurrent slots and bounded800ms/6000node work; perception checks nearest eight candidates. Largest modes are local stress prototypes without a frame-rate guarantee.
Fully armed silos remain at high spin and fire every12s; HUD now shows cumulative strikes and next pulse countdown, a cycling pulse meter and firing flash instead of a frozen100% label.
Connected visible Harbor deck tiles define ports (separate clusters on equal height). Three or more connected tiles choose crew ships; one/two choose scouts. Actual approach points, home positions/orientation, boarding paths and22s replacements follow those ports. Four reserved models per ship size per castle; default authored harbor retains two legacy moorings. Small1v1/2v2 squads walk/pod instead of assigning their sole bot to a permanently occupied pilot seat.
Custom foundation triangle winding corrected outward;15 detached floating crags per castle scale to its active collision footprint. Original author art/materials kept.
Evacuation now120s: no respawns; void fall recovery counts as a knockout rather than a free return to castle; dying core launches yellow ballistic bolts to random supported low-ground navigation tiles, with7m warning rings. A landing kills either team's grounded actors within7m and4m elevation; air is safe from this ground blast. Last30s shake strengthens and castle sinks120m with moving collision. Final large explosion hides castle/removes its colliders; resets restore exact transforms/solids. Existing shield immunity/battery blackout/survival bonus remain. Bolts are capped64, rate~3/s increasing~6/s in last30. Both destroyed cores can emit.
Verification: test/fleet-meltdown.mjs actual seven populations, four-deck-port assignment/reserve model replacement, crags, repeated armed strikes and full120s lethal bolt/descent/explosion/reset lifecycle; review/meltdown-study.html is an explicitly controlled core/time-advance browser fixture. No online multi-device or largest-mode performance acceptance.


### Defense, equipment and deployment pass (2026-10-10)

Castle incursions trigger nearby AI battery operators and reachable interception goals. Mounted defenders use actual batteries, line of sight, cooldowns and core power; blocked routes can still prevent entry. Most bots spawn at the first castle landing, preserving checked pod approaches; some respawn at friendly silos. Player-selectable upper terraces are actual navigation surfaces, but universal terrace-to-entrance path coverage remains unresolved.

Weapons 1–5 now have finite independent magazines, slower shot recovery and automatic reload when empty. T or Reload starts an early reload; switching preserves each magazine and does not bypass shot recovery. Weapon6 is a Revival scepter: hold fire on a downed ally within14m with clear sight for1.4s to revive in place at65HP (+50). This only works during the normal battle, before their ordinary4s respawn; evacuation still has no respawns/revives. One medic bot per8-person team can use it. Friendly downed positions show a pale cross; actual revival channels display a connecting light beam. AI battery operators dismount when evacuation begins. Fixed/ship batteries also reload.

M opens the green phosphor radar/deployment map. Select one of up to four supported castle points, or either landing/approach point of a captured uncontested silo. Hostiles within12m exclude a point; lost selection falls back to the first available friendly point. Selection queues the next respawn, never teleports a living player. By default it is the first castle landing. Combat continues while the map is open; local movement and firing stop.

Four winged flying chariots (two per team) use R to board nearby, F to exit, WASD steering and R/C rise/lower while mounted. Their88m/s flight is faster than scouts58m/s and crew ships38m/s. They have260 hull HP, shield contact kills them, personal weapons work aboard, and replacements return after20s during normal battle. Scouts can choose them for solo objectives; they obey swept collision and supported disembark/falling rules. Core loss leaves chariot flight available for evacuation.

Shield visuals and contact use the same8-power rounded keep envelope,2m clearance, and a small corner fit; harbors and build decks are outside it. This replaces inflated spherical fitting. White screen flashes accompany explosions/large impacts and fade in roughly0.4s; near-discharge silo cores and tight orbit rings gain additive white masks. No game art or sound was borrowed.

Broken-core bolts can target supported elevated tiles of their own keep, general supported ground, or the opposing castle core. Four percent of bolts select the opposing castle; the rest bombard its own terraces or supported ground. Enemy-castle hits penetrate shields for twice the Crown silo's damage (normally720), with a shield-breaking hit fully absorbed and the next hit reaching the core. A second core failure makes both castles doomed during the same two-minute escape window. This prototype policy is weighted randomness, not terrain impact luck simulating shield aim. Both castles can descend and disappear.

Local controlled mechanism coverage: test/defense-deployment.mjs; explicit visual VFX controls: review/deployment-study.html. Large-mode performance, arbitrary upper-castle paths and cross-network play are not certified.


Protector cores (local prototype, 2026-10-10): the main core is always available and required in an applied custom castle. Optional protectors unlock at20/40/60/80/100, with a sixth bonus at100. Each has600HP and a direct beam to the crown. The workshop checks real triangle geometry, including curved wall arcs, colours a blocked beam red and identifies the obstruction. Blocked networks remain editable drafts; Apply rejects them without replacing the existing castle. Level reduction never silently deletes excess protectors. Preview placement does not alter saves.

All surviving protectors must be destroyed by players/bots before ordinary weapon hits (including damage linked to player hits) can damage the main core. Silos and unstable meltdown castle strikes bypass protectors after the external shield is down; shield-breaking strikes are still fully absorbed. Enemy protectors participate in projected aiming, projectile collision, feedback and raider targeting. HUD shows the surviving guard count. Beams pulse and rings rotate during matches; destroyed or stopped-match beams disappear.

The local architect is a bounded deterministic grammar/search, not a remote or learned model. Seeds now change bailey widths/depths/corner cuts, the middle stair lane and the upper keep approach, in addition to family, planting and weapons. Protector placement seeks actual clear beam corridors and separated sectors. Workshop proposals rank six candidates and walk up to three. Match construction searches up to18 seeds, rejects blocked/incomplete networks and physically walks every derived ward/stair/protector approach out and back before applying a design. Rejections retain obstacle evidence in match diagnostics. This can add setup time for large castles. Approved fortress families remain the structural vocabulary; arbitrary layouts and bot combat performance are not universally certified. Online rank/unlocks remain unconnected.

Verification: test/protector-cores.mjs uses actual curved-wall beam triangles, milestone limits, required core, nine seeded accepted structures, physical route checks and real projectile/core/silo damage. Updated older fixtures now include the required main core and expect already-active automatic defenses. Native workshop also demonstrated a curved-wall obstruction, then Undo restored all six clear beams. No workshop proposal was saved over the owner's castle.


Core-first timestamp builder (2026-10-10): the workshop and every new match record Date.now(), derive a reproducible seed, then choose legal main/protector tile positions and heights BEFORE generating architecture. castle-anchor-plan.js fixes those pinpoints, solves stair corridors from the open entrance, grows solid masonry wards and fits defenses/planting/banks around routes and direct beam corridors. Candidate pinpoints never move during a solve; impossible arrangements are rejected and a new seeded arrangement is tried. Physical walking and real triangle beam tests are still required before accepting. The template library remains available separately. Workshop search compares six geometric proposals with bounded retries; match search bounds48 arrangements. These are deterministic local algorithms, not a learned AI or universal path guarantee.

Regeneration removes prior runtime beam links immediately on match stop, before planning/build animation, and resets only the new network afterward. Static beam creation replaces its own previous links. Current regression proof: test/anchor-first.mjs and review/anchor-first-test.json, plus live repeated workshop generations in beam-regeneration-proof.png. Workshop proposals remain unapplied until Apply; they do not overwrite saved castles.


Explicit castle footprint and occupied courts (2026-10-11): the custom construction no longer supplies a full-plot walking slab. Empty tiles have no walking floor; placed parts supply their real tile slab, solid terraces still create their masonry body, and the fixed landing bridge remains. The cosmetic lower rock hull is below the floor and nonsolid. AI explicitly fills a connected lower court within its plot, fits curtain tiles to that court, and retains beam-constrained stair-linked upper wards. The template library now authors explicit entrance apron tiles and trades spare banks when needed to retain the720-piece budget.

New editable Castle house and Arrival court parts. Integrated houses plus court trees contribute to the existing20-point planting/composition category, without multiplying credit through detached decor. AI chooses1-4 outward edge quay clusters (two or three deck tiles), reserves boarding courts, and checks four clear tiles facing out. castle-footprint.js reports detached wall groups, detached ports and blocked channels; route hints expose these reports, AI rejects them, and physical inspection walks every deck/arrival tile as well as upper floors/protectors. Ships use the port's authored outward direction and ignore invalid docks. Old custom docks may need rotating or joining to a court. No-deck original castle fallback remains.

Arrival tiles are randomized from reserved routes with separation and are physically walked before accepting. The map exposes supported planned courts; some bots use them on deployment/respawn, with the first landing still the default human point. Workshop geometric/physical preflight retries are bounded; no arbitrary-layout guarantee. Proofs: test/castle-footprint.mjs and review/castle-footprint-test.json, test/anchor-first.mjs, castle-architect, castle-beauty, defense-deployment, fleet-meltdown and template-geometry suites. All changes local; no online-rank or backend changes.
