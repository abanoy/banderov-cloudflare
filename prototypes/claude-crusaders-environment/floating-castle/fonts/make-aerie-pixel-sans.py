"""Build 'Aerie Pixel Sans' 400/700 (the bundled UI body font) from Pixelify Sans (SIL OFL 1.1, no Reserved Font Name).
Not loaded by the game and not packaged by build-aerie.py. Usage (needs fontTools + brotli):
  python3 make-aerie-pixel-sans.py <@fontsource/pixelify-sans 5.3.0 files/pixelify-sans-latin-400-normal.woff2> <...-latin-700-normal.woff2> <outdir>
Changes, in font units (upm 1000, one font pixel ~90 units), after the art director's patch-pixelify.py:
 * Bold keeps the 700 master's x coordinates but takes the 400 master's y coordinates, so stems get
   heavier while counters and apertures keep their 400 height (Pixelify 700 closes them to ~0.35 px).
 * C: hooks shortened to one pixel row (the rows of E's arms) -> 3-row opening (was 1 row; read as O).
 * G: upper hook shortened the same way; the spur keeps it distinct from C.
 * c, e: lower hook removed -> 2-row opening (c read as o, e as a closed theta).
 * B, E: straight square left stem like D/P/R/F; B's middle bar joins the stem (B read as 8/G, E as C).
 * Z: full top and bottom bars joined by a one-pixel stepped diagonal, drawn like the font's own z (was the
   2-shaped Pixelify Z: 'Zoom' read as '2oom').
 * The 'liga' (fi, fl, ff, ffi, ffl: Pixelify draws fi/fl like an 'A') and 'frac' features are removed, so no CSS
   `font:` shorthand or canvas text can turn them back on; prune() then drops their lookups, the other unreferenced
   lookups and the glyphs no character reaches (fi, fl, f_f, f_f_i, f_f_l and the precomposed eighths/thirds). The
   cmap, outlines, advances, kern/mark/mkmk, name table and OS/2 code-page/unicode ranges are left as they were.
 * Renamed 'Aerie Pixel Sans' (Modified Version; OFL section 3 courtesy rename). Timestamps are kept from the source."""
import sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.ttLib.tables import ttProgram
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
src400,src700,out=sys.argv[1:4]
def sety(f,g,xmin,old,new):
    c=f['glyf'][g].coordinates;n=0
    for i,(x,y) in enumerate(c):
        if x>=xmin and y==old:c[i]=(x,new);n+=1
    assert n,(g,old)
def setglyph(f,name,contours):
    g=f['glyf'][name];pts=[];ends=[]
    for c in contours:pts+=c;ends.append(len(pts)-1)
    g.coordinates=GlyphCoordinates(pts);g.endPtsOfContours=ends;g.numberOfContours=len(contours);g.flags=bytearray([1]*len(pts))
    p=ttProgram.Program();p.fromBytecode(b'');g.program=p
def zed(f,L,R):
    setglyph(f,'Z',[[(L[0],-12),(L[0],179),(L[1],179),(L[1],270),(L[2],270),(L[2],359),(L[3],359),(L[3],440),(L[4],440),(L[4],530),(L[0],530),(L[0],631),
                     (R[4],631),(R[4],440),(R[3],440),(R[3],350),(R[2],350),(R[2],260),(R[1],260),(R[1],169),(R[0],169),(R[0],88),(R[4],88),(R[4],-12)]])
def patch(f,stem,inner,right,rin,bar):
    wx={423:433,414:453}[rin]
    sety(f,'C',rin,350,440);sety(f,'C',rin,270,179);sety(f,'G',rin,350,440);sety(f,'c',rin,179,88);sety(f,'e',rin,180,88)
    setglyph(f,'E',[[(stem,-12),(stem,631),(wx,631),(wx,540),(right,540),(right,440),(rin,440),(rin,530),(inner,530),(inner,359),(bar,359),(bar,260),(inner,260),(inner,88),(rin,88),(rin,179),(right,179),(right,78),(wx,78),(wx,-12)]])
    setglyph(f,'B',[[(stem,-12),(stem,631),(wx,631),(wx,540),(right,540),(right,350),(wx,350),(wx,270),(right,270),(right,78),(wx,78),(wx,-12)],
                    [(inner,88),(rin,88),(rin,260),(inner,260)],[(inner,359),(rin,359),(rin,530),(inner,530)]])
def nested(lookup):
    for s in lookup.SubTable:
        for rs in (getattr(s,'ChainSubClassSet',None) or getattr(s,'ChainSubRuleSet',None) or []):
            for r in (getattr(rs,'ChainSubClassRule',None) or getattr(rs,'ChainSubRule',None) or []) if rs else []:
                for rec in r.SubstLookupRecord:yield rec.LookupListIndex
        for rec in getattr(s,'SubstLookupRecord',None) or []:yield rec.LookupListIndex
def drop_features(f,tags=('liga','frac')):
    g=f['GSUB'].table;recs=g.FeatureList.FeatureRecord
    gone={l for r in recs if r.FeatureTag in tags for l in r.Feature.LookupListIndex}
    keep=[i for i,r in enumerate(recs) if r.FeatureTag not in tags];remap={o:n for n,o in enumerate(keep)}
    g.FeatureList.FeatureRecord=[recs[i] for i in keep];g.FeatureList.FeatureCount=len(keep)
    for sr in g.ScriptList.ScriptRecord:
        for ls in [sr.Script.DefaultLangSys]+[r.LangSys for r in sr.Script.LangSysRecord]:
            if ls is None:continue
            ls.FeatureIndex=[remap[i] for i in ls.FeatureIndex if i in remap];ls.FeatureCount=len(ls.FeatureIndex)
            if ls.ReqFeatureIndex!=0xFFFF:ls.ReqFeatureIndex=remap.get(ls.ReqFeatureIndex,0xFFFF)
    used={l for r in g.FeatureList.FeatureRecord for l in r.Feature.LookupListIndex}
    used|={n for i in list(used) for n in nested(g.LookupList.Lookup[i])}
    assert not used&gone,(used&gone)
    assert not {r.FeatureTag for r in g.FeatureList.FeatureRecord}&set(tags)
def prune(f):
    o=subset.Options();o.layout_features=['*'];o.name_IDs=['*'];o.name_languages=['*'];o.name_legacy=True
    o.notdef_outline=True;o.glyph_names=True;o.hinting=True;o.legacy_kern=True;o.layout_closure=True
    o.recalc_timestamp=False;o.recalc_bounds=False;o.prune_unicode_ranges=False;o.prune_codepage_ranges=False
    s=subset.Subsetter(o);s.populate(unicodes=f.getBestCmap().keys());s.subset(f)
    g=f['GSUB'].table;assert {r.FeatureTag for r in g.FeatureList.FeatureRecord}<={'ccmp','locl'}
    assert not any(l.LookupType==4 for l in g.LookupList.Lookup),'ligature lookup left'
    assert not {'fi','fl','f_f','f_f_i','f_f_l'}&set(f.getGlyphOrder())
def rename(f,sub,ps):
    for r in f['name'].names:
        if r.nameID in(1,16):r.string='Aerie Pixel Sans'
        elif r.nameID==2:r.string=sub
        elif r.nameID==3:r.string='1.000;AERIE;'+ps
        elif r.nameID==4:r.string='Aerie Pixel Sans'+('' if sub=='Regular' else ' '+sub)
        elif r.nameID==6:r.string=ps
reg=TTFont(src400,recalcTimestamp=False);patch(reg,60,161,525,423,343);zed(reg,(60,151,241,333,423),(161,251,343,433,525));drop_features(reg);rename(reg,'Regular','AeriePixelSans-Regular');prune(reg)
reg.flavor='woff2';reg.save(out+'/aerie-pixel-sans-400.woff2')
bold=TTFont(src700,recalcTimestamp=False);ref=TTFont(src400)
for n in bold.getGlyphOrder():
    b,r=bold['glyf'][n],ref['glyf'][n]
    if b.isComposite():
        for cb,cr in zip(b.components,r.components):cb.y=cr.y
    elif b.numberOfContours>0:
        assert list(b.endPtsOfContours)==list(r.endPtsOfContours),n
        b.coordinates=GlyphCoordinates([(xb,yr) for (xb,_),(_,yr) in zip(b.coordinates,r.coordinates)])
patch(bold,61,188,542,414,365);zed(bold,(61,149,237,326,414),(188,276,365,453,542));drop_features(bold);rename(bold,'Bold','AeriePixelSans-Bold');prune(bold)
bold.flavor='woff2';bold.save(out+'/aerie-pixel-sans-700.woff2');print('ok')
