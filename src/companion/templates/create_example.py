"""Create an authoring ZIP with synthesized tones, not a pronunciation course.

Run using the repository Python environment with openpyxl installed.
"""
import io
import json
import math
import struct
import wave
import zipfile
from pathlib import Path
from openpyxl import Workbook


def create(destination):
    book = Workbook()
    book.active.append(['Notes', 'Checkpoint', 'Pause', 'Native text', 'Native audio', 'Target text', 'Target audio', 'Voice input', 'Male 1 text', 'Male 1 audio', 'Female 1 text', 'Female 1 audio', 'Male 2 text', 'Male 2 audio', 'Female 2 text', 'Female 2 audio', 'Display'])
    book.active.append(['Replace tones with spoken recordings before using for teaching.', 1, 0, '', '', '', '', '', 'Reference tone', 'J0001.wav', '', '', '', '', '', '', '[bold]Audio demonstration[/bold]'])
    book.active.append(['Microphone demonstration only.', 2, .3, '', '', '', '', 'Y', 'Reference tone', 'J0001.wav', '', '', '', '', '', '', 'Microphone practice'])
    sheet = io.BytesIO(); book.save(sheet)
    audio = io.BytesIO()
    with wave.open(audio, 'wb') as wav:
        wav.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        wav.writeframes(b''.join(struct.pack('<h', int(5000 * math.sin(2 * math.pi * 180 * i / 16000))) for i in range(16000)))
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('course.json', json.dumps({'engine': 'companion', 'title': 'Companion audio demonstration', 'languageCode': 'en', 'source': 'script.xlsx'}))
        archive.writestr('script.xlsx', sheet.getvalue())
        archive.writestr('J0001.wav', audio.getvalue())


if __name__ == '__main__':
    import sys
    destination = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('companion-example.zip')
    create(destination)
    print(destination)
