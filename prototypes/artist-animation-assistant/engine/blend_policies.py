"""Independent explicit backward-weight ablations; not semantic confidence.

Consulted AnimeInterp/AnimeInbet/softmax-splatting papers motivate separating
geometry and mixing. This is not an implementation of those methods.
"""
import numpy as np

POLICIES=('sharpen4','hard','source0','source1')

def validate_policy(policy):
    if policy is not None and (not isinstance(policy,str) or policy not in POLICIES):raise ValueError('Choose default or an explicit registered blend ablation')
    return policy

def apply_weight(weight,policy):
    validate_policy(policy)
    if not isinstance(weight,np.ndarray) or weight.dtype!=np.float32 or weight.ndim!=2 or any(not 1<=n<=64 for n in weight.shape) or not np.isfinite(weight).all() or weight.min()<0 or weight.max()>1:raise ValueError('Blend weight needs a finite float32tile<=64square in0..1')
    if policy is None:return weight
    if policy=='sharpen4':
        a=weight**4;b=(1-weight)**4;return a/(a+b)
    if policy=='hard':return (weight>=.5).astype(np.float32)
    if policy=='source0':return np.ones_like(weight)
    return np.zeros_like(weight)
