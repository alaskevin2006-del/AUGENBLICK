"""Explicit manifest dispatch, leaving existing Znawca workbooks untouched."""
import hashlib
import json
import shutil
from pathlib import Path
from django.conf import settings
from django.db import transaction
from .models import CourseVersion
from .importer import CourseImportError, MEDIA_EXTENSIONS
from .engines.common import safe_file, validate_svg
from .engines.registry import get_engine


def import_engine_dir(root):
    root=Path(root)
    try:
        manifest_path=safe_file(root,'course.json')
        if manifest_path.stat().st_size>4*1024*1024: raise ValueError('course.json exceeds 4 MiB.')
        manifest=json.loads(manifest_path.read_text(encoding='utf-8-sig'))
        if not isinstance(manifest,dict):raise ValueError('course.json must be an object.')
        engine=manifest.get('engine'); compiler=get_engine(engine)
        title=manifest.get('title'); lang=manifest.get('languageCode','en')
        if not isinstance(title,str) or not title.strip() or len(title)>255: raise ValueError('course.json requires a title (1–255 characters).')
        if not isinstance(lang,str) or not 1<=len(lang)<=8:raise ValueError('Invalid languageCode.')
        digest=hashlib.sha256()
        for path in sorted(root.rglob('*')):
            if path.is_file():
                path=safe_file(root,path.relative_to(root).as_posix())
                digest.update(path.relative_to(root).as_posix().encode());digest.update(b'\0')
                with path.open('rb') as stream:
                    for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
                digest.update(b'\0')
        content_hash=digest.hexdigest(); version=f'{engine}@{content_hash}'
        existing=CourseVersion.objects.filter(pk=version).first()
        if existing:return {'imported':[_summary(existing,True)],'warnings':[]}
        assets={}
        def asset(name):
            path=safe_file(root,name); suffix=path.suffix.lower()
            kind={**MEDIA_EXTENSIONS,'.svg':'image','.ogg':'audio','.webm':'video'}.get(suffix)
            if not kind:raise ValueError(f'Unsupported public media: {name}')
            data=path.read_bytes()
            if suffix=='.svg':validate_svg(data)
            filename=hashlib.sha256(data).hexdigest()+suffix
            assets[filename]=path
            return {'kind':kind,'path':f'/media/{version}/{filename}'}
        payload=compiler.compile_source(root,manifest,asset)
        if not isinstance(payload,dict) or not payload.get('items') or not payload.get('questions'):raise ValueError('Course has no usable questions.')
        if len(payload['questions'])>20000:raise ValueError('Course exceeds 20000 questions.')
        ids=[item['id'] for item in payload['items']]
        if len(set(ids))!=len(ids):raise ValueError('Duplicate item IDs.')
        for q in payload['questions']:
            if q.get('objectId') not in ids or not isinstance(q.get('interaction'),dict) or not isinstance(q.get('solution'),dict):raise ValueError('Invalid compiled question.')
        warnings=payload.pop('warnings',[])
        payload.update(engine=engine,schemaVersion='0.7',courseVersionId=version,title=title,languageCode=lang)
        with transaction.atomic():
            course,created=CourseVersion.objects.get_or_create(course_version_id=version,defaults=dict(title=title,engine=engine,language_code=lang,item_count=len(ids),content_hash=content_hash,payload=payload))
            if created:
                target=Path(settings.MEDIA_ROOT)/version;target.mkdir(parents=True,exist_ok=True)
                for filename,path in assets.items():shutil.copy2(path,target/filename)
        return {'imported':[_summary(course,not created)],'warnings':warnings}
    except CourseImportError:raise
    except (ValueError,TypeError,KeyError,OSError) as exc:
        raise CourseImportError('课程导入失败',str(exc)) from exc


def _summary(course,reused):
    return {'courseVersionId':course.pk,'title':course.title,'languageCode':course.language_code,'itemCount':course.item_count,'reused':reused}
