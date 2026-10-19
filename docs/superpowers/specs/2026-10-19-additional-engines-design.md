# Additional engines: staged implementation

User direction: implement Anvil, Ekspert, Sokole Oko and Companion in steps/branches, reuse suitable GitHub code if useful, call no third-party hosted service API. Existing course UI, five locales, role isolation, publish/unpublish, withdrawal, scoped records and Znawca behavior remain. Direct lacks requirements and stays reserved. User has delegated implementation choices and requested results, so execution proceeds under that authorization.

## Architecture and stages

Use branch `codex/additional-engines`, with independently tested commits. Extend the existing server-owned runtime through an explicit registry; keep Znawca's paths and grading unchanged. Content enters through the existing ZIP upload. A new `course.json` manifest selects the engine and source file, avoiding accidental reinterpretation of existing Znawca workbooks. Authors get working source templates and fixture packages, not only an internal JSON interface.

1. Common registry, private/public question separation, structured answers encoded in the existing answer string, unified activity and replay views.
2. Anvil: all nine documented interactions, explicit type workbook format with an opt-in legacy migration parser. Matrix subquestions and persistent-set prompts are separate question items with shared context; cloze and matching use binary whole-question scores and detailed slot feedback. Preserve media and optional narration.
3. Ekspert: single/multi-axis quizzes and course-scoped learning atlas. Each axis has a binary dimension; total is mean of selected axes. Reference material is not exposed by the live test endpoint. Comparison/decision trees remain outside documented Phase 1.
4. Sokole Oko: private monochrome pixel masks, knowledge single-click and observation incremental click interaction. A hit reveals only its region, duplicate hits do not increase score, first miss terminates observation without revealing remaining regions. Server decides hit/tolerance. Explicit next preserves platform feedback flow. Keyboard and scaled-image coordinates supported.
5. Companion: ordered script, checkpoints, reference audio/text, microphone recording and local CPU acoustic analysis. No cloud recognition/TTS. Acoustic similarity, timing and intonation diagnostics must not be represented as calibrated phoneme accuracy. Formal pronunciation examination remains unavailable until a language-specific model and validated corpus establish real phoneme scoring; show this limit explicitly. Never fabricate a passing pronunciation grade.

## Interfaces

Engine modules in `core/engines/` provide `compile_source(root, manifest, asset) -> payload` and `score(question, answer: str) -> feedback`. Source problems raise ValueError with author-facing file/row location. `asset(relative)` validates and imports public media, returning `{kind,path}`; private masks use safe_file and never enter public storage. Payload contains stable `items[{id,name,values}]` and `questions[{objectId,kind,prompt,interaction,solution}]`. `interaction` contains only safe UI data; `solution` is server-only. Root registry adds randomized question IDs and uses a strict public allowlist.

Feedback retains score/fullyCorrect/matched/missed/extra/correctAnswers, and may add dimensions `{id,label,score}`, submittedLabels, overlays. Sokole may return `pending:true`; the server persists private per-question interaction state, emits interactionUpdated and stores an idempotent submission response, but does not resolve the item or alter mastery until completion. Snapshot interactionFeedback is separate from terminal feedback.

React engine question props: `{question:{kind,prompt,interaction}, answer:string, onChange(value), disabled:boolean, locale:string, onCommit?(value), feedback?}`. Shared host owns submission, retries, progress, finish/skip and replay. Domain components own presentation only. Engine snapshot field selects the renderer; missing engine defaults Znawca for old records.

## Safety and validation

Reject malformed schemas, unknown kinds, out-of-root assets, unsupported active media, nonfinite coordinates, oversized inputs and all client scores. SVG must be sanitized before serving. Public assets use content hashes. Private answers/masks/source filenames never enter live questions. Drafts, preview records and formal records retain existing permissions. Tests cover actual source import and round trips through enrollment/start/answer/finish/history/difficulty, not only isolated algorithms.

Keep recordings ephemeral during analysis; retain diagnostics and a request digest for idempotency rather than raw audio in answer history. Bound recording duration and CPU use to protect the shared 2-vCPU server. Deploy only AUGENBLICK containers after regression and fresh review; preserve rollback backup and all other project code/configuration.
