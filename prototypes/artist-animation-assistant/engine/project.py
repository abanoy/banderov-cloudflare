"""Original project scaffolding from the owner's master spec, not a learned model.

RGBA integer grids are a deliberately small integration representation. Production
raster/vector adapters and color conversions are not implemented by this module.
"""
from copy import deepcopy
from hashlib import sha256
import json
from engine.io.project_archive import PixelPlane
from engine.packed_model import json_default


def fingerprint(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                             allow_nan=False,default=json_default).encode()).hexdigest()


def validate(project):
    if project["schema_version"] not in {"0.1","0.2"}:
        raise ValueError("Unsupported schema; migration required")
    width, height = project["canvas"]["width"], project["canvas"]["height"]
    if any(type(n) is not int or not 1 <= n <= 4096 for n in (width, height)):
        raise ValueError("Invalid canvas dimensions")
    if project["canvas"]["color_profile"] != "sRGB" or project["canvas"]["alpha_mode"] != "straight":
        raise ValueError("Only straight-alpha sRGB fixtures supported")
    duration = project["shot"]["duration_frames"]
    if type(duration) is not int or duration < 1:
        raise ValueError("Invalid duration")
    if any(type(n) is not int or n <= 0 for n in project["shot"]["fps"].values()):
        raise ValueError("Invalid rational frame rate")
    for drawing in project["drawings"].values():
        pixels = drawing["pixels"]
        if project['schema_version']=='0.2':
            if not isinstance(pixels,PixelPlane) or (pixels.width,pixels.height)!=(width,height):raise ValueError('Packed schema requires canvas-sized immutable RGBA8 assets')
            continue
        if isinstance(pixels,PixelPlane) or len(pixels) != width * height or any(
            len(p) != 4 or any(type(c) is not int or not 0 <= c <= 255 for c in p)
            for p in pixels
        ):
            raise ValueError("Expected canvas-sized RGBA8 pixel grid")
    if project['schema_version']=='0.2':
        for original in project['originals'].values():
            if not isinstance(original.get('pixels'),PixelPlane) or (original['pixels'].width,original['pixels'].height)!=(width,height):raise ValueError('Packed originals require exact immutable assets')
    occupied = set()
    for exposure in project["exposures"]:
        start, length = exposure["start"], exposure["length"]
        if exposure["drawing_id"] not in project["drawings"] or exposure["layer_id"] not in project["layers"]:
            raise ValueError("Unresolved drawing/layer")
        if any(type(n) is not int for n in (start, length)) or start < 0 or length < 1 or start + length > duration:
            raise ValueError("Exposure outside shot")
        for slot in range(start, start + length):
            key = (exposure["layer_id"], slot)
            if key in occupied:
                raise ValueError("Overlapping exposures in same layer")
            occupied.add(key)
    if fingerprint(project["originals"]) != project["originals_sha256"]:
        raise ValueError("Original snapshot changed")
    return project


def create(pixels, width, height, duration=1):
    source = {"pixels": deepcopy(pixels), "origin": "artist", "approved": True, "locked": True}
    originals = {"source": deepcopy(source)}
    return validate({
        "schema_version": "0.2" if isinstance(pixels,PixelPlane) else "0.1", "project_id": "synthetic-fixture", "revision": 0,
        "canvas": {"width": width, "height": height, "color_profile": "sRGB", "alpha_mode": "straight"},
        "shot": {"id": "shot", "fps": {"numerator": 24, "denominator": 1}, "duration_frames": duration},
        "layers": {"ink": {"name": "Original ink"}},
        "drawings": {"source": deepcopy(source)}, "originals": originals,
        "originals_sha256": fingerprint(originals),
        "exposures": [{"drawing_id": "source", "layer_id": "ink", "start": 0, "length": duration}],
        "proposals": {}, "history": [],
    })


def propose_translation(project, proposal_id, drawing_id, dx, dy):
    """Constrained geometry baseline: integer translation, no inferred motion."""
    validate(project)
    if proposal_id in project["proposals"]:
        raise ValueError("Proposal IDs cannot be reused, including rejected IDs")
    if type(dx) is not int or type(dy) is not int:
        raise ValueError("Translation must use integer pixels")
    width, height = project["canvas"]["width"], project["canvas"]["height"]
    original = project["drawings"][drawing_id]["pixels"]
    if isinstance(original,PixelPlane):
        from engine.packed_model import translate
        pixels,clipped=translate(original,dx,dy)
    else:
        pixels = [[0, 0, 0, 0] for _ in original]
        clipped = 0
        for y in range(height):
            for x in range(width):
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    pixels[ny * width + nx] = original[y * width + x][:]
                elif original[y * width + x][3]:
                    clipped += 1
    from engine.packed_model import translated_constraints
    protection=translated_constraints(project['drawings'][drawing_id],width,height,dx,dy)
    result = deepcopy(project)
    result["proposals"][proposal_id] = {
        "base_revision": project["revision"], "input_id": drawing_id,
        "input_sha256": fingerprint(project["drawings"][drawing_id]),
        "method": "integer-translation-integration-baseline", "version": "0.1.0",
        "settings": {"dx": dx, "dy": dy}, "pixels": pixels,
        "status": "pending", "warnings": [f"{clipped} nontransparent pixels clipped"] if clipped else [],
        "source_ids": ["REF-PYTHON"], "component_ids": ["COMP-PYTHON-3-13-1"],
    }
    result['proposals'][proposal_id].update(protection)
    if protection.get('constraint_clip_count'):result['proposals'][proposal_id]['warnings'].append(str(protection['constraint_clip_count'])+' protected artist pixels would be clipped; cannot accept')
    if isinstance(original,PixelPlane):
        result['proposals'][proposal_id]['source_ids']+=['REF-NUMPY-2-4-1','REF-NUMPY-BUFFER']
        result['proposals'][proposal_id]['component_ids']+=['COMP-NUMPY-2-4-1']
    return result


def accept(project, proposal_id, drawing_id, replace_id=None):
    validate(project)
    proposal = project["proposals"][proposal_id]
    if proposal["status"] != "pending":
        raise ValueError("Proposal is no longer pending")
    if proposal["base_revision"] != project["revision"] or proposal["input_sha256"] != fingerprint(project["drawings"][proposal["input_id"]]):
        raise ValueError("Stale proposal; regenerate against current revision")
    if proposal.get('constraint_clip_count',0):raise ValueError('Cannot accept translation that would clip protected artist corrections')
    if drawing_id in project["drawings"]:
        raise ValueError("New drawing requires a unique ID")
    if replace_id is not None:
        target = project["drawings"][replace_id]
        if target["locked"] or target["approved"]:
            raise ValueError("Cannot replace locked or approved drawing")
    result = deepcopy(project)
    result["drawings"][drawing_id] = {"pixels": deepcopy(proposal["pixels"]), "origin": "proposal", "approved": True, "locked": False}
    for key in ['protected_mask','protection_encoding','protected_pixels']:
        if key in proposal:result['drawings'][drawing_id][key]=deepcopy(proposal[key])
    if 'protected_mask' in proposal or proposal.get('protected_pixels'):
        result['drawings'][drawing_id].update(locked=True,parent_drawing=proposal['input_id'])
    result["proposals"][proposal_id]["status"] = "accepted"
    result["revision"] += 1
    result["history"].append({"action": "accept", "proposal_id": proposal_id, "drawing_id": drawing_id})
    if replace_id:
        for exposure in result["exposures"]:
            if exposure["drawing_id"] == replace_id:
                exposure["drawing_id"] = drawing_id
    return validate(result)


def correct_and_lock(project, drawing_id, new_id, pixels):
    """An explicit artist edit creates a revision; approved old pixels survive."""
    if new_id in project["drawings"]:
        raise ValueError("Correction requires a new drawing ID")
    result = deepcopy(project)
    unreviewed=project['drawings'][drawing_id].get('approved') is False
    result["drawings"][new_id] = {"pixels": deepcopy(pixels), "origin": 'unreviewed_motion_candidate' if unreviewed else 'artist_correction', "approved": not unreviewed, "locked": True}
    for e in result["exposures"]:
        if e["drawing_id"] == drawing_id:
            e["drawing_id"] = new_id
    result["revision"] += 1
    for p in result["proposals"].values():
        if p["status"] == "pending":
            p["status"] = "stale"  # conservative revision-wide policy for v0.1
    result["history"].append({"action": "correct_and_lock", "before": drawing_id, "after": new_id})
    return validate(result)


def reject(project, proposal_id):
    result = deepcopy(project)
    if result["proposals"][proposal_id]["status"] != "pending":
        raise ValueError("Only pending proposals may be rejected")
    result["proposals"][proposal_id]["status"] = "rejected"
    result["history"].append({"action": "reject", "proposal_id": proposal_id})
    return validate(result)  # duration and exposures untouched
