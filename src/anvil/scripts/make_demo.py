"""Create a self-contained, original nine-type author template ZIP."""
import json
import math
from pathlib import Path
import struct
import sys
import tempfile
import wave
import zipfile
import zlib
from openpyxl import Workbook


def png(path, rgb):
    def chunk(name, body):
        return struct.pack('!I',len(body))+name+body+struct.pack('!I',zlib.crc32(name+body)&0xffffffff)
    pixels=b''.join(b'\x00'+bytes(rgb)*120 for _ in range(80))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',120,80,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b''))


def create(output):
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp)
        (root/'course.json').write_text(json.dumps({'engine':'anvil','title':'Anvil 九种题型示例','languageCode':'zh','source':'course.xlsx','legacy':False},ensure_ascii=False,indent=2),encoding='utf-8')
        png(root/'red.png',(190,40,40));png(root/'blue.png',(40,80,190));png(root/'green.png',(40,140,70))
        with wave.open(str(root/'tone.wav'),'wb') as audio:
            audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(16000)
            audio.writeframes(b''.join(struct.pack('<h',int(4000*math.sin(i*2*math.pi*440/16000))) for i in range(8000)))
        book=Workbook();sheet=book.active;sheet.title='Anvil'
        rows=[
            ['difficulty','type','stimulus','prompt','option1','option2','option3'],
            [1,1,'red.png','','红色','蓝色','绿色'],
            [1,2,'red.png','','是','否'],
            [None,None,None,'这是红色吗？','是'],
            [None,None,None,'这是蓝色吗？','否'],
            [1,3,'blue.png','这是什么颜色？','蓝色','红色','绿色'],
            [None,None,None,'这是暖色吗？','否','是'],
            [1,4,'叶子通常是[绿色;蓝色;红色]。'],
            [1,5,'天空是[蓝色;绿色]，英文为[~blue;green]。'],
            [1,6,'*','匹配中文和英文','红色 * red','蓝色 * blue','绿色 * green'],
            [1,7,'哪一张是绿色？','','green.png','red.png','blue.png'],
            [1,8,'*','','红色 * red.png','蓝色 * blue.png','绿色 * green.png'],
            [1,9,'tone.wav','播放声音后，选择蓝色。','blue.png','green.png','red.png'],
        ]
        for row in rows:sheet.append(row)
        sheet.freeze_panes='A2'
        for column in 'ABCDEFG':sheet.column_dimensions[column].width=26
        book.save(root/'course.xlsx')
        output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(root.iterdir()):archive.write(path,path.name)
    return output


if __name__=='__main__':
    print(create(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'templates'/'anvil-demo.zip'))
