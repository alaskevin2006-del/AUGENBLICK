# Additional Engines Implementation Plan

> For agentic workers: execute task-by-task with test-first implementation and independent final review.

**Goal:** Implement four additional course engines without hosted third-party APIs, preserving existing course behavior.
**Architecture:** Registered server compilers and graders, shared authenticated runtime and course records, specialized question renderers. Separate commits on codex/additional-engines.
**Tech Stack:** Django, PostgreSQL, React/TypeScript, openpyxl, local image/audio libraries.
**Spec:** `docs/superpowers/specs/2026-10-19-additional-engines-design.md`

## Global constraints

- Preserve Znawca scoring, existing accounts/courses, five locales, draft preview and course-scoped records.
- No third-party hosted service API. No changes to desktop ZNAWCA, Yixue or LumaRead.
- Private answers and masks stay server-side; no fabricated phoneme scores.

## Review focus

- Complex answers must not leak from public questions, assets or history to other users.
- Partial visual clicks and network retries must not duplicate mastery or consume multiple attempts.
- Malformed source data and active SVG must fail with useful author diagnostics.
- Recording cancellation, permissions and oversized input must release media devices and bounded server resources.
- Non-Znawca replay and difficult practice must retain course identity and appropriate controls.

### Task 1: Common platform integration

Files: backend core/engines/{registry,common}.py, engine_importer.py, views/runtime/selection/dev_views; frontend engines/EngineActivity.tsx and shared types/setup/replay.
Consumes existing permissions and runtime; produces the interfaces specified by the design.
- [x] Write failing tests for registry dispatch, private redaction, manifest import/asset security and session roundtrip.
- [x] Implement interface adapters and retain Znawca fallback.
- [x] Run backend suite and frontend build/tests; commit common integration.

### Task 2: Anvil

Files: core/engines/anvil.py, tests_anvil.py, frontend engines/AnvilQuestion.tsx, src/anvil documentation/templates.
Consumes compile/score/component contract from Task 1.
- [x] Write and run failing tests for all nine types, correct/incorrect answers, malformed answers and import fixtures.
- [x] Implement explicit workbook and JSON compilation, legacy migration, grouped media, cloze/matching/persistent set.
- [x] Verify tests, source ZIP roundtrip, keyboard UI and read-only replay; commit.

### Task 3: Ekspert and Sokole Oko

Files: core/engines/{ekspert,sokole}.py, corresponding tests, frontend question components, source templates.
- [x] Write and run failing axis partial-score, mask hit/miss/overlap/duplicate/private-leak and import tests.
- [x] Implement compilers/scorers, course-scoped atlas, incremental point state and accessible question UI.
- [x] Verify live session and history roundtrips for both engines; commit.

### Task 4: Companion

Files: core/engines/companion.py, local audio analyzer, tests, frontend CompanionQuestion.tsx, source templates.
- [x] Write failing script/checkpoint/recording validation and deterministic acoustic diagnostics tests.
- [x] Implement ordered script playback, bounded recording, ephemeral local analysis and explicit uncalibrated status; block formal voice examination.
- [x] Verify permission denial/cancel cleanup, silence/mismatch, source ZIP and learning/history; commit.

### Task 5: Release

- [x] Full backend/PostgreSQL and frontend tests/build; independent review; fix material findings with regression tests.
- [x] Generate author templates and public acceptance fixtures; verify all completed engines and existing Znawca.
- [x] Back up and deploy AUGENBLICK only, verify public functionality, remove disposable fixtures.
- [x] Push code and document exact supported scope, remaining voice calibration requirement and rollback version.
