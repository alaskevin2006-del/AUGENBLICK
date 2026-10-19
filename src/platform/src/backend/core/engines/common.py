"""Restricted author assets. Private solutions never use the public asset helper."""
from pathlib import Path, PurePosixPath, PureWindowsPath
from xml.etree import ElementTree


def safe_file(root, name):
    if not isinstance(name, str) or not name or len(name) > 1024:
        raise ValueError('Asset path must be a relative file name.')
    portable = name.replace('\\', '/')
    if ':' in portable or PureWindowsPath(portable).drive or PurePosixPath(portable).is_absolute() or '..' in PurePosixPath(portable).parts:
        raise ValueError('Asset path must stay inside the course ZIP.')
    root = Path(root).resolve(); path = (root / portable).resolve()
    if root not in path.parents or not path.is_file():
        raise ValueError(f'Asset does not exist inside course: {name}')
    if path.stat().st_size > 128 * 1024 * 1024:
        raise ValueError(f'Asset exceeds 128 MiB: {name}')
    return path


def validate_svg(data):
    if len(data) > 2*1024*1024 or b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('SVG must be a small self-contained drawing.')
    try: root = ElementTree.fromstring(data)
    except ElementTree.ParseError as exc: raise ValueError('Invalid SVG.') from exc
    allowed = {'svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','title','desc','use'}
    for node in root.iter():
        if node.tag.split('}')[-1] not in allowed: raise ValueError('SVG contains unsupported active content.')
        for key,value in node.attrib.items():
            key = key.split('}')[-1].lower(); lower=value.lower().replace(' ','')
            if key.startswith('on') or key=='style' or (key=='href' and not value.startswith('#')) or 'javascript:' in lower or ('url(' in lower and not lower.startswith('url(#')):
                raise ValueError('SVG contains external or active content.')
