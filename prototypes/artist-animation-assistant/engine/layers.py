"""Original restricted normal-group renderer using REF-COMPOSITING source-over."""
from fractions import Fraction
import math


def validate_layers(project):
    layers = project['layers']
    if not 1 <= len(layers) <= 32:
        raise ValueError('Expected 1..32 raster/group layers')
    paints = []
    for identity, layer in layers.items():
        if set(layer) - {'name','visible','locked','nodetype','parent_id','order','opacity','isolation','native_attributes'}:
            raise ValueError('Unsupported layer property; do not silently discard it')
        if layer.get('nodetype', 'paintlayer') not in {'paintlayer', 'grouplayer'}:
            raise ValueError('Unsupported layer kind')
        if layer.get('isolation','isolate') not in {'isolate','auto'} or (layer.get('nodetype','paintlayer')=='paintlayer' and 'isolation' in layer):
            raise ValueError('Invalid layer group isolation')
        opacity=layer.get('opacity',255)
        if type(layer.get('visible', True)) is not bool or type(layer.get('locked', False)) is not bool or type(opacity) not in {int,float} or not math.isfinite(opacity) or not 0 <= opacity <= 255:
            raise ValueError('Invalid layer flags/opacity')
        if type(layer.get('order', 0)) is not int:
            raise ValueError('Invalid layer stacking order')
        parent, visited = layer.get('parent_id'), {identity}
        while parent is not None:
            if parent not in layers or parent in visited or len(visited) > 12 or layers[parent].get('nodetype') != 'grouplayer':
                raise ValueError('Invalid/cyclic layer parentage')
            visited.add(parent)
            parent = layers[parent].get('parent_id')
        if layer.get('nodetype', 'paintlayer') == 'paintlayer':
            paints.append(identity)
            if sum(e['length'] for e in project['exposures'] if e['layer_id'] == identity) != project['shot']['duration_frames']:
                raise ValueError('This host requires full exposure coverage on each raster layer')
        elif any(e['layer_id'] == identity for e in project['exposures']):
            raise ValueError('Groups cannot have raster exposures')
    if not paints:
        raise ValueError('Expected at least one raster layer')
    return paints


def visible(project, identity):
    while identity is not None:
        if not project['layers'][identity].get('visible', True):
            return False
        identity = project['layers'][identity].get('parent_id')
    return True


def source_over(bottom, top, opacity=255):
    if len(bottom)!=len(top):
        raise ValueError('Composited rasters must have equal bounds')
    factor=Fraction(str(opacity))
    numerator,denominator=factor.numerator,factor.denominator
    result = []
    for backdrop, source in zip(bottom, top):
        sa = source[3] * numerator
        # Alpha denominator65025 avoids an intermediate8bit opacity rounding.
        remaining = 65025 * denominator - sa
        a = sa * 255 + backdrop[3] * remaining
        if not a:
            result.append([0, 0, 0, 0])
        else:
            rgb = [(source[c] * sa * 255 + backdrop[c] * backdrop[3] * remaining + a // 2) // a for c in range(3)]
            result.append(rgb + [(a + (65025*denominator)//2) // (65025*denominator)])
    return result


def render(project, slot, overrides=None):
    validate_layers(project)
    count = project['canvas']['width'] * project['canvas']['height']
    ranks={identity:index for index,identity in enumerate(project['layers'])}
    def children(parent,backdrop=None,inherited=Fraction(1)):
        result = [[0, 0, 0, 0] for _ in range(count)] if backdrop is None else backdrop
        siblings = [(i, layer) for i, layer in project['layers'].items() if layer.get('parent_id') == parent]
        for identity, layer in sorted(siblings, key=lambda pair:(pair[1].get('order',0),ranks[pair[0]]), reverse=True):
            if not layer.get('visible', True):
                continue
            if layer.get('nodetype', 'paintlayer') == 'grouplayer':
                if layer.get('isolation','isolate')=='auto':
                    result=children(identity,result,inherited*Fraction(str(layer.get('opacity',255)))/255)
                    continue
                pixels = children(identity)
            else:
                exposure = next(e for e in project['exposures'] if e['layer_id'] == identity and e['start'] <= slot < e['start'] + e['length'])
                pixels = (overrides or {}).get(identity, project['drawings'][exposure['drawing_id']]['pixels'])
            result = source_over(result, pixels, Fraction(str(layer.get('opacity',255)))*inherited)
        return result
    return children(None)
