"""Research-only explicit feature constraints on backward fields (EXP0042).

REF-RBF-TOPOLOGY / REF-WENDLAND-ORIGIN: compact Wendland C2 basis.
Discrete collocation fits bilinearly sampled grid fields, not a continuous
diffeomorphism. REF-NUMPY-SOLVE/COND/GRADIENT. No automatic acceptance API.
"""
from copy import deepcopy
import math
import numpy as np
from engine.field_transport import _field_at


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate(canvas, controls):
    if not isinstance(canvas, (tuple, list)) or len(canvas) != 2 or any(type(n) is not int or not 2 <= n <= 4096 for n in canvas):
        raise ValueError('Canvas needs two integer dimensions2..4096')
    if not isinstance(controls, dict) or set(controls) != {'radius', 'max_delta', 'anchors'}:
        raise ValueError('Declare radius, max_delta and anchors')
    if not _number(controls['radius']) or not 4 <= controls['radius'] <= 1024 or not _number(controls['max_delta']) or not 0 <= controls['max_delta'] <= 256:
        raise ValueError('Radius4..1024 and maximum native displacement0..256 required')
    anchors = controls['anchors']
    if not isinstance(anchors, list) or not 1 <= len(anchors) <= 32:
        raise ValueError('Use1..32 explicit feature anchors')
    identities, targets = set(), set()
    for a in anchors:
        if not isinstance(a, dict) or set(a) != {'id', 'source', 'guide', 'target', 'visibility'}:
            raise ValueError('Declare id, source, guide, target, visibility for each feature')
        name = a['id']
        if not isinstance(name, str) or not 1 <= len(name) <= 48 or not name.isascii() or not name.replace('_', '').replace('-', '').isalnum() or name in identities:
            raise ValueError('Use unique short ASCII feature identities')
        identities.add(name)
        for key in ('source', 'guide', 'target'):
            p = a[key]
            if p is None and key != 'target':
                continue
            if not isinstance(p, list) or len(p) != 2 or any(not _number(v) or not 0 <= v <= canvas[i]-1 for i, v in enumerate(p)):
                raise ValueError('Feature coordinates must be finite native pixel centers inside canvas')
        if a['source'] is None and a['guide'] is None:
            raise ValueError('At least one explicitly known key feature required')
        if a['visibility'] not in ('model', 'source', 'guide') or (a['source'] is None and a['visibility'] != 'guide') or (a['guide'] is None and a['visibility'] != 'source'):
            raise ValueError('Missing correspondence requires an explicit choice of its known key')
        if tuple(a['target']) in targets:
            raise ValueError('Target features must be distinct')
        targets.add(tuple(a['target']))
    return deepcopy(controls)


def kernel(distance, radius):
    r = np.asarray(distance, dtype=np.float64)/radius
    return np.maximum(0., 1.-r)**4*(4.*r+1.)


def _corners(point, canvas, grid):
    w, h = canvas; gw, gh = grid
    x = float(np.clip((point[0]+.5)*gw/w-.5, 0, gw-1))
    y = float(np.clip((point[1]+.5)*gh/h-.5, 0, gh-1))
    ix, iy = math.floor(x), math.floor(y); a, b = x-ix, y-iy
    return [(iy, ix, (1-a)*(1-b)), (iy, min(ix+1, gw-1), a*(1-b)),
            (min(iy+1, gh-1), ix, (1-a)*b), (min(iy+1, gh-1), min(ix+1, gw-1), a*b)]


def _folds(flow):
    dx_y, dx_x = np.gradient(flow[0].astype(np.float64))
    dy_y, dy_x = np.gradient(flow[1].astype(np.float64))
    return (1+dx_x)*(1+dy_y)-dx_y*dy_x <= 0


def adapt(fields, canvas, controls, checkpoint=None):
    """Return copied research fields and diagnostics. Unsafe new folds are flagged.

    Caller must refuse installation when unsafe_reasons is nonempty. There is no
    approval or project mutation here. Visibility is an explicit key choice, never
    inferred confidence. Same fields must be used for the entire selected stack.
    """
    c = validate(canvas, controls); checkpoint = checkpoint or (lambda: None)
    if not isinstance(fields, dict) or not all(k in fields for k in ('flow0', 'flow1', 'weight')):
        raise ValueError('Two backward flows and shared weight required')
    f0, f1, m = (fields[k] for k in ('flow0', 'flow1', 'weight'))
    if not isinstance(m, np.ndarray) or m.ndim != 2:
        raise ValueError('Invalid weight grid')
    gh, gw = m.shape
    if min(gw, gh) < 2 or max(gw, gh) > 1024 or gw*gh > 786432 or any(not isinstance(f, np.ndarray) or f.dtype != np.float32 or not np.isfinite(f).all() for f in (f0, f1, m)) or f0.shape != (2, gh, gw) or f1.shape != f0.shape or m.min() < 0 or m.max() > 1 or max(np.max(np.abs(f0)), np.max(np.abs(f1))) > 2*max(gw, gh):
        raise ValueError('Invalid bounded float32 backward fields')
    w, h = canvas; scale = np.array([w/gw, h/gh]); radius = c['radius']
    out = {k: v.copy() for k, v in zip(('flow0', 'flow1', 'weight'), (f0, f1, m))}
    diagnostics = dict(anchors=[], maps={}, unsafe_reasons=[], continuous_topology_guarantee=False,
                       support_native_interpolation_halo=2*math.hypot(w/gw, h/gh),
                       reference_or_semantic_prediction=False)
    for key, side, original in [('flow0', 'source', f0), ('flow1', 'guide', f1)]:
        checkpoint(); selected = [a for a in c['anchors'] if a[side] is not None]
        before = _folds(original); condition = None; maximum = 0.
        if selected:
            centers = np.array([a['target'] for a in selected], np.float64)
            matrix = np.zeros((len(selected), len(selected)), np.float64)
            residual = []
            for i, a in enumerate(selected):
                for gy, gx, weight in _corners(a['target'], canvas, (gw, gh)):
                    native = np.array([(gx+.5)*w/gw-.5, (gy+.5)*h/gh-.5])
                    matrix[i] += weight*kernel(np.linalg.norm(centers-native, axis=1), radius)
                t = a['target']; current = _field_at(original, np.array(t[0]), np.array(t[1]), w, h)*scale
                residual.append(np.array(a[side])-t-current)
            condition = float(np.linalg.cond(matrix))
            if not math.isfinite(condition) or condition > 1e8:
                raise ValueError('Feature targets cannot be resolved safely on this working grid')
            coefficients = np.linalg.solve(matrix, np.array(residual))
            for y in range(0, gh, 16):
                checkpoint(); yy, xx = np.mgrid[y:min(y+16, gh), :gw]
                delta = np.zeros(xx.shape+(2,), np.float64)
                for center, coefficient in zip(centers, coefficients):
                    distance = np.hypot((xx+.5)*w/gw-.5-center[0], (yy+.5)*h/gh-.5-center[1])
                    delta += kernel(distance, radius)[..., None]*coefficient
                maximum = max(maximum, float(np.linalg.norm(delta, axis=2).max()))
                if maximum > c['max_delta']+1e-5:
                    raise ValueError('Feature displacement exceeds declared native budget')
                out[key][:, y:y+len(xx)] += (delta/scale).transpose(2, 0, 1).astype(np.float32)
            if not np.isfinite(out[key]).all() or np.max(np.abs(out[key])) > 2*max(gw, gh):
                raise ValueError('Adapted flow exceeds transport bounds')
            for a in selected:
                t = a['target']; mapped = np.array(t)+_field_at(out[key], np.array(t[0]), np.array(t[1]), w, h)*scale
                error = float(np.linalg.norm(mapped-a[side]))
                if error > .05:
                    raise ValueError('Working grid cannot fit declared feature within0.05native pixels')
                diagnostics['anchors'].append(dict(id=a['id'], side=side, error_native=error))
        after = _folds(out[key]); new = int(np.count_nonzero(after & ~before))
        diagnostics['maps'][key] = dict(condition=condition, maximum_delta_native=maximum,
                                        preexisting_nonpositive_jacobian=int(before.sum()), new_nonpositive_jacobian=new)
        if new:
            diagnostics['unsafe_reasons'].append(key+': new sampled nonpositive backward-map Jacobian')
    pins = {}
    for a in c['anchors']:
        if a['visibility'] == 'model':
            continue
        desired = 1. if a['visibility'] == 'source' else 0.
        for gy, gx, weight in _corners(a['target'], canvas, (gw, gh)):
            if weight <= 0:
                continue
            if (gy, gx) in pins and pins[gy, gx] != desired:
                raise ValueError('Opposite visibility hints overlap an unresolved grid cell')
            pins[gy, gx] = desired
    for y in range(0, gh, 16):
        checkpoint(); yy, xx = np.mgrid[y:min(y+16, gh), :gw]
        numerator = np.zeros(xx.shape); total = np.zeros(xx.shape)
        for a in c['anchors']:
            if a['visibility'] == 'model':
                continue
            t = a['target']; bump = kernel(np.hypot((xx+.5)*w/gw-.5-t[0], (yy+.5)*h/gh-.5-t[1]), radius)
            total += bump; numerator += bump*(a['visibility'] == 'source')
        strength = np.minimum(total, 1.)
        target = np.divide(numerator, total, out=np.zeros_like(total), where=total > 0)
        out['weight'][y:y+len(xx)] = (1-strength)*m[y:y+len(xx)]+strength*target
    for (gy, gx), value in pins.items():
        out['weight'][gy, gx] = value
    for a in c['anchors']:
        if a['visibility'] != 'model':
            t = a['target']; value = float(_field_at(out['weight'], np.array(t[0]), np.array(t[1]), w, h))
            if abs(value-(a['visibility'] == 'source')) > 1e-4:
                raise ValueError('Visibility hint residual exceeds bound')
    out['metadata'] = dict(deepcopy(fields.get('metadata', {})), research_feature_constraints=c,
                           feature_diagnostics=deepcopy(diagnostics), raw_model_rgb_matches=False)
    out['metadata']['source_ids'] = sorted(set(out['metadata'].get('source_ids', [])) | {
        'REF-RBF-TOPOLOGY', 'REF-WENDLAND-ORIGIN', 'REF-NUMPY-SOLVE',
        'REF-NUMPY-COND', 'REF-NUMPY-GRADIENT'})
    # Raw model RGB is intentionally absent: it no longer reconstructs these fields.
    return out, diagnostics
