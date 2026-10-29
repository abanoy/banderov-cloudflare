import struct,unittest
from engine.io.asl_metadata import parse

STYLE='00000000-1111-2222-3333-444444444444'
def text(value):return struct.pack('>L',len(value))+value.encode('utf-16-be')
def key(value):return struct.pack('>L',len(value))+value.encode('ascii')
def descriptor(items,kind='null'):return text('')+key(kind)+struct.pack('>L',len(items))+b''.join(key(k)+v for k,v in items)
def boolean(value):return b'bool'+bytes([value])
def asl(style_id=STYLE,padding=True):
    identity=descriptor([('Idnt',b'TEXT'+text(style_id)),('Nm  ',b'TEXT'+text('Original style'))]);fx=descriptor([('masterFXSwitch',boolean(1)),('DrSh',b'Objc'+descriptor([('enab',boolean(1)),('Opct',b'UntF#Prc'+struct.pack('>d',50.))],'DrSh'))],'Lefx');body=struct.pack('>L',16)+identity+struct.pack('>L',16)+descriptor([('Lefx',b'Objc'+fx)],'Styl');body+=bytes((-len(body))%4) if padding else b''
    return b'\0\2' + b'8BSL\0\3'+struct.pack('>LL',0,1)+struct.pack('>L',len(body))+body

class ASLMetadataTests(unittest.TestCase):
    def test_exact_style_id_and_typed_effect_flags_no_renderer_claim(self):
        for padding in [True,False]:
            result=parse(asl(padding=padding));self.assertEqual(result['style_count'],1);style=result['styles'][0];self.assertEqual(style['identification']['items']['Idnt']['value'],STYLE);fx=style['style']['items']['Lefx']['value']['items'];self.assertIs(fx['masterFXSwitch']['value'],True);self.assertEqual(fx['DrSh']['value']['items']['Opct']['value'],dict(unit='#Prc',value=50.))
    def test_truncation_unknown_types_nonfinite_boolean_and_trailing_refuse(self):
        raw=asl()
        for bad in [raw[:4],raw[:-1],raw+b'bad',raw.replace(b'bool\1',b'bool\2',1),raw.replace(b'TEXT',b'xxxx',1),raw.replace(struct.pack('>d',50.),struct.pack('>d',float('nan')),1)]:
            with self.assertRaises(ValueError):parse(bad)
    def test_invalid_section_size_is_not_silently_skipped(self):
        raw=bytearray(asl());raw[16:20]=struct.pack('>L',100000)
        with self.assertRaisesRegex(ValueError,'exceeds'):parse(bytes(raw))

if __name__=='__main__':unittest.main()
