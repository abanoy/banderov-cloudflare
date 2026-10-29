"""Transparent bounded diagnostics, not semantic contours or artist preference."""
import numpy as np

def dilate(mask,radius):
    if not isinstance(mask,np.ndarray) or mask.ndim!=2 or mask.dtype!=bool or type(radius) is not int or not 0<=radius<=4:raise ValueError('Boolean2Dmask and integer0..4Chebyshev tolerance required')
    h,w=mask.shape;out=np.zeros_like(mask)
    for dy in range(-radius,radius+1):
        for dx in range(-radius,radius+1):
            ya,yb=max(0,dy),min(h,h+dy);xa,xb=max(0,dx),min(w,w+dx)
            if ya<yb and xa<xb:out[ya:yb,xa:xb]|=mask[ya-dy:yb-dy,xa-dx:xb-dx]
    return out

def measure(predicted,reference,*,dark=96,tolerance=2):
    a,b=predicted,reference
    if any(not isinstance(v,np.ndarray) or v.dtype!=np.uint8 or v.ndim!=3 or v.shape[2]!=4 or any(not 1<=n<=4096 for n in v.shape[:2]) for v in [a,b]) or a.shape!=b.shape:raise ValueError('Matching RGBA8arrays up to4096square required')
    if type(dark) is not int or not 1<=dark<=255:raise ValueError('Dark RGB threshold1..255required')
    pa=a[:,:,3]>=128;pb=b[:,:,3]>=128;da=pa&(a[:,:,:3].max(axis=2)<dark);db=pb&(b[:,:,:3].max(axis=2)<dark);na,nb=int(da.sum()),int(db.sum());near_b=dilate(db,tolerance);near_a=dilate(da,tolerance);matched_a=int((da&near_b).sum());matched_b=int((db&near_a).sum());precision=matched_a/na if na else (1. if not nb else 0.);recall=matched_b/nb if nb else (1. if not na else 0.);f1=2*precision*recall/(precision+recall) if precision+recall else 0.;union=int((pa|pb).sum());dark_union=int((da|db).sum());error=0
    # White-composited RGB uses independent integer arithmetic in16-row bands.
    for y in range(0,a.shape[0],16):
        aa=a[y:y+16].astype(np.uint32);bb=b[y:y+16].astype(np.uint32);wa=(aa[:,:,:3]*aa[:,:,3:4]+255*(255-aa[:,:,3:4])+127)//255;wb=(bb[:,:,:3]*bb[:,:,3:4]+255*(255-bb[:,:,3:4])+127)//255;error+=int(np.abs(wa.astype(np.int16)-wb.astype(np.int16)).sum())
    return dict(alpha_iou=int((pa&pb).sum())/union if union else 1.,white_rgb_mae=error/(a.shape[0]*a.shape[1]*3),dark_iou=int((da&db).sum())/dark_union if dark_union else 1.,dark_precision=precision,dark_recall=recall,dark_f1=f1,predicted_dark_pixels=na,reference_dark_pixels=nb,matched_predicted_dark_pixels=matched_a,matched_reference_dark_pixels=matched_b,dark_threshold=dark,alpha_threshold=128,chebyshev_tolerance_pixels=tolerance,scope='Dark-pixel/color proxies only; not anatomy, perceived quality, intentional line identification or artist acceptance')
