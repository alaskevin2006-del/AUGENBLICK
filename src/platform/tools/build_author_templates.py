"""Build downloadable examples and matching container-test fixtures together."""
from pathlib import Path
import io
import zipfile

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / 'src/platform/src/frontend/public/templates'
FIXTURES = ROOT / 'src/platform/src/backend/core/fixtures'
NOTE = ('Upload this ZIP as a draft course. Samples are original test content, not a professional teaching corpus. '
        'Companion uses synthetic tones for technical validation, not pronunciation teaching.\n'
        'See repository engine documentation for authoring instructions.\n')


def main():
    for engine in ['anvil', 'ekspert', 'sokole-oko', 'companion']:
        source = ROOT / 'src' / engine / 'templates'
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
            if engine in ('anvil', 'companion'):
                name = 'anvil-demo.zip' if engine == 'anvil' else 'companion-example.zip'
                with zipfile.ZipFile(source / name) as original:
                    for entry in original.infolist():
                        output.writestr(entry.filename, original.read(entry))
            else:
                for file in sorted((source / 'shapes').iterdir()):
                    if file.is_file():
                        output.write(file, file.name)
            # Sokole .txt files are question sources; documentation must use .md.
            output.writestr('PLATFORM-README.md', NOTE)
        for target in [PUBLIC, FIXTURES]:
            target.mkdir(parents=True, exist_ok=True)
            (target / f'{engine}.zip').write_bytes(archive.getvalue())


if __name__ == '__main__':
    main()
