# Blue-haired character reference construction

The owner changed direction on 2026-10-10 and requested the closest practical 3D construction of the supplied blue-haired character sheet. This is a new isolated model. Earlier chibi source, alternatives, packages and environment copies are preserved.

## Open and use

Double-click **Azure-study.html** in a modern desktop browser. It is self-contained and works offline: no server, CDN or installation is required. Drag to orbit, scroll to zoom, choose front/profile/back/detail views, toggle the reference pose or turntable, and download the current pose as a GLB. The reference link opens the original supplied sheet for comparison.

- `azure-reference-pose.glb`: head tilt and bent arm based on the large reference view.
- `azure-rest.glb`: relaxed symmetrical pose for front/profile/back inspection.
- `model-sheet.png`: actual WebGL renders, including face, knit and boot details.
- `Azure-editable-source.zip`: editable procedural source and the shared Three.js library/license. Run `node server.cjs` from the extracted root and visit `http://127.0.0.1:8794/blue-reference/` if editing the modules.

## Construction

Named volumetric surfaces build the face, almond eye whites, turquoise/red irises, swept layered fringe, pink ponytail tie, long S-curved ponytail, shoulder-baring ribbed sweater, articulated hands, dark stockings, open leather boot shafts, tongues, eyelets, crossed laces, bows, seams, welt stitches and soles. The original reference pixels are not used as a surface texture. Knit and leather microtexture are generated locally; the supplied reference image is preserved unchanged.

The study uses 575 named meshes and 761,416 triangles. It prioritizes inspectable construction and visual detail; it is a static study, not a production game rig or an optimized game character. Source poses are reconstructed independently; GLBs contain static named surfaces, vertex colors and PBR materials. The source's bump textures become embedded normal maps in GLB, so material appearance is an approximation across renderers. World transforms are baked into exported vertices to preserve nonuniformly scaled and rotated boot details without invalid sheared node matrices. Native height is about six authored units; physical height is not specified by the sheet.

This is an authored reconstruction, not an exact recovery of the original model. Facial likeness, hair flow and fabric/leather finish remain visibly less refined than the supplied rendered reference. No exact 1:1 fidelity, owner approval, skinning, animation, physics, phone performance or game integration is claimed.

## Verification

`capture.cjs` captures six actual views in installed headless Edge. `verify.cjs` uses native pose, view, turntable, wireframe and download controls; reads both GLB containers and buffer ranges; imports both files through the official Three.js r128 GLTFLoader; compares every imported world-space vertex with the constructed source; checks triangle counts and a 390px viewport. Current results are in `verification.json`. The initial export check detected loader ordering differences and then a real shear/decomposition error in the boots; stable part IDs and baked transforms corrected those before delivery.

`sheet.cjs` renders the comparison sheet. `build-portable.py` creates the offline HTML, source ZIP and SHA-256 manifest. `portable-check.cjs` verifies the offline file with all HTTP requests blocked, opens the embedded reference, changes pose and view, and downloads a GLB. These checks are Windows desktop browser evidence, not testing in Blender, Godot, physical phones or every GLB viewer.

Three.js r128 and its MIT license are reused from the parent study. The QA-only loader was fetched from https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/jsm/loaders/GLTFLoader.js ; `GLTFLoader.r128.js` preserves the fetched source and `GLTFLoader.local.js` changes only its library import path. No dependency upgrade or production deployment occurred.
