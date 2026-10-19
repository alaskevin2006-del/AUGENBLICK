import copy
import importlib
import random
import uuid
from rest_framework.exceptions import ValidationError

MODULES = {'anvil':'anvil','ekspert':'ekspert','sokole-oko':'sokole','companion':'companion'}
SUPPORTED = frozenset({'znawca', *MODULES})


def get_engine(name):
    if name not in MODULES: raise ValueError('Unsupported engine.')
    return importlib.import_module(f'core.engines.{MODULES[name]}')


def build_questions(payload, seed):
    engine=payload.get('engine','znawca')
    if engine=='znawca':
        from ..runtime import build_questions as build_znawca
        return build_znawca(payload,seed)
    if engine not in MODULES: raise ValidationError('Unsupported engine.')
    questions=copy.deepcopy(payload.get('questions',[]))
    for index,q in enumerate(questions):
        q.update(id=str(uuid.uuid4()),engine=engine,direction='')
        if engine=='anvil':
            rng=random.Random(seed+index)
            def shuffle(value):
                if isinstance(value,dict):
                    for key,child in value.items():
                        if key=='options' and isinstance(child,list):rng.shuffle(child)
                        if key=='columns' and isinstance(child,list):
                            for column in child:rng.shuffle(column)
                        shuffle(child)
                elif isinstance(value,list):
                    for child in value:shuffle(child)
            shuffle(q['interaction'])
    return questions


def evaluate(question, answer, payload):
    engine=payload.get('engine','znawca')
    if engine=='znawca':
        from ..scoring import evaluate as evaluate_znawca
        return evaluate_znawca(answer,question['acceptedAnswers'],subscript_compatible=bool(payload.get('answerRules',{}).get('subscriptCompatible',False)))
    try: return get_engine(engine).score(question,answer)
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        raise ValidationError('Invalid answer for this activity.') from exc
