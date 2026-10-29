"""Independent bounded style metadata inspection; REF-ADOBE-DESCRIPTORS,
REF-KRITA-ASL-READER. No upstream code, pattern decoder or renderer copied.
"""
import struct,math
SOURCES=['REF-ADOBE-DESCRIPTORS','REF-KRITA-ASL-READER']

class Reader:
    def __init__(self,data):
        if len(data)>16*1024**2:raise ValueError('ASL metadata exceeds16MiB')
        self.data=data;self.pos=0;self.nodes=0
    def take(self,n):
        if not 0<=n<=len(self.data)-self.pos:raise ValueError('Truncated ASL metadata')
        out=self.data[self.pos:self.pos+n];self.pos+=n;return out
    def number(self,kind):return struct.unpack('>'+kind,self.take(struct.calcsize('>'+kind)))[0]
    def count(self,maximum=4096):
        n=self.number('L')
        if n>maximum:raise ValueError('ASL count limit')
        return n
    def text(self):return self.take(self.count(32768)*2).decode('utf-16-be').rstrip('\0')
    def identity(self):
        n=self.count(1024);return self.take(n or 4).decode('latin1')
    def descriptor(self,depth=0):
        if depth>32:raise ValueError('ASL nesting limit')
        name=self.text();kind=self.identity();n=self.count();items={}
        for _ in range(n):
            key=self.identity()
            if key in items:raise ValueError('Duplicate ASL descriptor key')
            items[key]=self.value(depth+1)
        return dict(name=name,class_id=kind,items=items)
    def value(self,depth):
        self.nodes+=1
        if self.nodes>65536 or depth>32:raise ValueError('ASL node/nesting limit')
        kind=self.take(4).decode('latin1')
        if kind in ['Objc','GlbO']:return dict(type=kind,value=self.descriptor(depth+1))
        if kind=='VlLs':return dict(type=kind,value=[self.value(depth+1) for _ in range(self.count())])
        if kind=='TEXT':value=self.text()
        elif kind=='bool':
            value=self.number('B')
            if value not in [0,1]:raise ValueError('ASL boolean outside0/1')
            value=bool(value)
        elif kind=='long':value=self.number('l')
        elif kind=='enum':value=dict(enum=self.identity(),value=self.identity())
        elif kind in ['doub','UntF']:
            unit=self.take(4).decode('latin1') if kind=='UntF' else None;value=self.number('d')
            if not math.isfinite(value):raise ValueError('Nonfinite ASL number')
            if unit is not None:value=dict(unit=unit,value=value)
        else:raise ValueError('Unsupported ASL value type '+repr(kind))
        return dict(type=kind,value=value)

def parse(data):
    reader=Reader(data)
    if reader.number('H')!=2 or reader.take(4)!=b'8BSL' or reader.number('H')!=3:raise ValueError('Unsupported ASL header')
    patterns=reader.count(16*1024**2);pattern_data=reader.take(patterns);styles=[]
    for _ in range(reader.count(1024)):
        size=reader.count(16*1024**2);end=reader.pos+size
        if end>len(data):raise ValueError('ASL style section exceeds bytes')
        if reader.number('L')!=16:raise ValueError('Unsupported ASL identification version')
        identification=reader.descriptor()
        if reader.number('L')!=16:raise ValueError('Unsupported ASL style version')
        style=reader.descriptor()
        padding=end-reader.pos
        if not 0<=padding<=3 or reader.take(padding)!=bytes(padding):raise ValueError('ASL style section length/padding mismatch')
        styles.append(dict(identification=identification,style=style))
    if reader.pos!=len(data):raise ValueError('Trailing ASL metadata')
    return dict(style_count=len(styles),patterns_bytes=len(pattern_data),styles=styles,decoded_nodes=reader.nodes)

