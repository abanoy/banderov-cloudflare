Crusaders - four owner-sketch siege models

Preview: http://127.0.0.1:8795/sketch-armory/index.html
Use the existing local environment server. No installation or publishing.

Owner confirmed fourth model is an armed watchtower. The study separates its
cannon into another reusable battery alongside trebuchet and repeating bow.
Owner additionally permits details/textures while preserving general shape.
Original PNG copied byte-exact as reference/owner-sketch.png, SHA256:
cd14a805346971d993ea09f9be0e229444c4b530398a63d7ea89d2315330a026

models.js exports buildArmory(kind,materials): cannon,trebuchet,bow,watchtower.
Coordinates metres, +Y up, +Z forward. Returned root,update,dispose enable
separate scene reuse. Shared caller materials are not disposed by a model.
Mechanism update accepts seconds, yaw, pitch and firing boolean. Turrets swivel
and elevate/recoil; trebuchet arm/counterweight/sling share a pivot; repeating
bow demonstrates a bolt-feed cycle. These are visual demonstrations; no damage,
capture, ballistic simulation, multiplayer or walkable collision integration.
The tower solids metadata is preliminary, not certified game collision.

Viewer preserves authored environment stone/wood/cloth texture generators,
palette pair relief, warm light/cool shade, depth shadows and dither; existing
owner chibi billboard loader used unchanged. True45degree Ortho/pixel50.
Four-model overview, individual close-ups, Q/E/button orbit, aim/elevation,
animation toggle and deterministic mechanism stepping. Original reference and
static OBJ/MTL downloads included. Mesh export has base colours, no baked texture
atlas/rig. Model source is authoritative for procedural textures and mechanisms.

Regenerate exports: node sketch-armory/export-models.mjs from environment root.
Exporter checks finite transformed vertices and valid triangle bounds, writes
four OBJ, sharedMTL and counts/bounds report. Current triangle counts2428cannon,
920trebuchet,636bow,3260watchtower. Exact general-shape/likeness judgment remains
owner review. No main-game/builder/pinned-art/backend/public modification.
