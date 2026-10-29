# Crusaders - Castle Trials

Isolated local prototype using Alexander Banderov's original art and authored Crusaders geometry. Run `npm run dev` here, open http://127.0.0.1:8802/. No install/network account required. Server binds only loopback. Existing parent/Wave/backend/public assets and save namespaces remain separate.

## Resource battleground

Eight equally spaced floating home plots sit at40m, above one connected lower battlefield. Mosswood, amber dunes, frostland and cinder hills meet across rolling, physically walkable terrain. Twelve level camp clearings lie at different elevations (-2 to7m). Broad slopes connect them; biome borders have no invisible walls. Vegetation/rocks are visual scenery around the rim. Terrain's exact drawn triangles are partitioned into64 collision regions for ray-query bounds; no hidden replacement walking plane.

Space / Jump off leaves your home dock for the first camp. WASD/arrows move; hold E / Claim-Link six seconds to capture, release then hold two seconds to establish the visible beam. Each linked uncontested camp sends2stone/1timber per second automatically, including while building. Rival capture removes your link; reclaim and reconnect. Contests pause income. R launches from any camp back home; B opens blueprint only after a supported home landing. One human plus seven local rivals, max8, offline. Rivals claim/link/expand/steal without field combat or building their own castles.

## Paid castle and new armory

Start empty12x12/three layers with40stone25timber. Click3D or precise grid, choose rotation/layer. Erase/replace refunds current piece cost; undo debits refunds. Save/load remain only crusaders-castle-trials:v1; browser saves contain design/resources/mode/duration, not live camps. Existing saved pieces keep their IDs but use the new models. Prices/refunds use the current cost table. Original editable history/backups are retained.

| Part | Stone | Timber | Trial behavior |
| --- | ---: | ---: | --- |
| Repeating bow (`cannon`) |7|6|24damage,0.9s cadence,30m clear sight |
| Heavy cannon |12|5|60damage,3.8s cadence,42m clear sight |
| Armed watchtower |12|7|45damage,4.8s cadence,42m; requires roof access |
| Trebuchet |10|14|85damage,6s cadence,10-60m; actual gravity arc,6m blast |
| Three-ring core |16|8|300HP main objective |

New weapons reuse the owner's approved parent sketch models: a repeating bow, cannon carriage, counterweight trebuchet and armed watchtower. Tower roof is8m above its layer; adjoining stair/upper-floor openings follow placed neighbours. A piece occupying the roof layer suppresses the integrated gun. New main core uses the parent's faceted cradle/three independently opposing rings/vortex, scaled to radius1.5 to preserve the compact paid plot and existing required core approach. Main core slab/pedestal remain explicit, paid and collidable. Vortex stops on defeat, low-health warning flashes. Small articulated weapon details are visual; real bounded plinth/shaft/deck meshes govern walking/collision.

Automatic Trial weapons acquire visible living raiders, aim their named mount, respect solid geometry and cooldowns, and animate only actual shots. Trebuchet stones fly through real segment/triangle collision tests and explode on impact; blast damage needs unobstructed sight. No friendly castle damage, field combat, operator staffing or manual mounted firing in this mode. Costs/ranges/damage are provisional local balance. Combat cooldowns live outside the paid layout and are not exported.

## Validity and modes

Check Castle requires exactly one main core, supported arrival and physical out/back walking to core, gates, all upper-floor/stair/arrival objectives and each weapon operator approach (armed tower roof included). Walls must attach to real paid floors. Existing physics/void/fall recovery retained. Minimal valid court: arrival4,6; floors5,6 and7,6; core6,6. No automatic foundation/core/repair. Invalid exact deadline fails while preserving design/resources. Default20min round, labelled2min playtest; Retry keeps stock/layout, resets camp claims and timer.

Showcase uses85% local bounded composition heuristics/15% valid routes; no learned AI/objective beauty claim. Trial sends one fixed party of3actual collision-walking raiders. WASD moves, Space clear-sight melee within5m. Core0 loses; all raiders defeated wins;120s survival limit. This is separate from Wave Defense progression.

## Design export and Wave boundary

Export design captures all pieces unchanged into version1 crusaders-layout with level20/fortress/options/source. No resources/timer/camps transfer; under200000UTF8bytes. Unknown pieces/invalid geometry refuse without dropping/converting. Trials now accepts trebuchet and heavyCannon. Its copied Wave checker retains older geometry/schema: trebuchet is explicitly reported unsupported with cell/layer while the complete design still downloads. Shared cannon/tower/core IDs do not transfer new appearance or combat. Wave must independently integrate the new armory; its current parser may reject the new file. No Wave files changed here.

For shared older pieces the copied checker uses actual Wave construction/default physical objectives/footprint and four exterior cardinal gate-to-MAIN routes. Warnings never change Trials validity/scoring, and exports still retain all paid pieces. Current Wave preflights before Apply; rejected imports preserve the applied design. A passing snapshot is not browser siege/original-world placement/cannon combat/multiplayer acceptance.

## Tests, provenance and limits

`npm test` covers accounting/refunds/undo, exact deadline and negative route fixtures, real castle walking, camp capture/loss/relink and actual ballistic dock/camp returns, normal/query refresh, immutable export and Wave valid/invalid/irregular preflight, plus new armory costs/operator routes/tower four rotations/real weapon damage/LOS/three walking raiders and eight terrain round trips. `python package.py` creates the standalone relative module ZIP and runtime hashes. No external dependency/CDN. Original parent source-snapshot.json stays historical; review/armory-biomes-provenance.json records this import and local adaptations. Only models/sketch-defense/charge-orb imported; no parent experimental repairs or multiplayer backend.

No physical-device/audio/network/FPS or broad balance certification. Conservative arbitrary upper-floor layouts can be rejected. Raiders do not collide with each other. Full articulated weapon collision, arbitrary moving-target accuracy, all camp-to-camp paths and every saved design are not certified. Tests and browser evidence are scoped in review reports. Nothing deployed or published.
