"""Original controlled reference-influence ablations; not an artist benchmark."""
from pathlib import Path
import argparse,copy,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui
from hosts.standalone.reference_fixtures import fixture,with_reference,request,COLORS,BOXES
from engine.references import propose,accept,edit_reference
from engine.layers import render
from engine.io.png_codec import encode_png

def run(output):
    verify_ui(ROOT);credits=build(check=True);output.mkdir(parents=True,exist_ok=False);rows=[]
    base=fixture();front=with_reference(base);multi=with_reference(front,'back','back',64)
    wrong=edit_reference(front,'front',view='back');disabled=edit_reference(front,'front',enabled=False)
    swapped=copy.deepcopy(front);swapped['references']['front']['parts']['cap']['bbox']=BOXES['coat'][:];swapped['references']['front']['parts']['cap']['swatch']=[28,33]
    swapped['references']['front']['parts']['coat']['bbox']=BOXES['cap'][:];swapped['references']['front']['parts']['coat']['swatch']=[28,10]
    # Swap geometric boxes but keep the intended colors via a separate, valid
    # reference fixture: this is an authored erroneous part annotation, not
    # upstream artwork. Actual swatches necessarily reflect the chosen pixels.
    back_colors=dict(COLORS,cap=[240,210,60,255],coat=[145,60,180,255])
    variants=[('absent',base,'front',False,False,COLORS),('palette_only_artist_labels',front,'front',True,True,COLORS),('single_front',front,'front',True,False,COLORS),('multiple_front',multi,'front',True,False,COLORS),('single_front_for_back',front,'any',True,False,back_colors),('multiple_selected_back',multi,'back',True,False,back_colors),('wrong_view_label',wrong,'back',True,False,back_colors),('disabled',disabled,'front',True,False,COLORS),('conditioning_off',front,'front',False,False,COLORS),('wrong_annotations',swapped,'front',True,False,COLORS),('artist_corrected_identity',swapped,'front',True,True,COLORS),('artist_corrected_anchors',front,'front',True,True,COLORS)]
    for name,project,view,use,override,expected in variants:
        trial=output/name;trial.mkdir();correct=identity=0;items=[];current=project
        for pid in BOXES:
            settings=request(pid,view,pid if override else None,use);r=propose(current,settings);chosen=r['selected'];rgba=chosen['rgba'] if chosen else current['palettes'][current['fill_regions'][pid]['palette_id']]['rgba']
            correct+=int(rgba==expected[pid]);identity+=int(chosen is not None and chosen['part_id']==pid)
            items.append(dict(region_id=pid,expected_rgba=expected[pid],selected=chosen,color_correct=rgba==expected[pid],identity_correct=chosen is not None and chosen['part_id']==pid,warnings=r['warnings'],assisted_identity=override))
            if chosen:current=accept(current,r,'trial-'+pid)
        (trial/'projection.png').write_bytes(encode_png(64,64,render(current,0)))
        row=dict(variant=name,regions=3,color_correct=correct,identity_correct=identity,artist_identity_hints=3 if override else 0,items=items);rows.append(row)
    for name in ['credits.json','CREDITS.md','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    result=dict(status='completed',rows=rows,trials=len(rows),region_decisions=len(rows)*3,credits_snapshot_sha256=credits['snapshot_sha256'],scope='Authored abstract three-part character; region segmentation fixed/accepted. Color and identity matching evaluated separately. No model/study reproduction, held-out artwork, artist effort/time or general semantic/view/occlusion claim. Palette-only uses explicit artist identities; geometric matching does not parse labels from image.')
    (output/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({r['variant']:dict(color=r['color_correct'],identity=r['identity_correct']) for r in rows}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);args=parser.parse_args();run(args.output.resolve())
