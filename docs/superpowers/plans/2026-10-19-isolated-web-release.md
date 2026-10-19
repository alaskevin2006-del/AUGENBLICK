# AUGENBLICK isolated Web release

User authorization: implement autonomously with parallel worktrees, publish code to alaskevin2006-del/AUGENBLICK, deploy beside Yixue without URL conflicts. Desktop ZNAWCA is reference only; platform requirements and accepted ADRs govern behavior.

## Deliverable and boundary

First deployable Znawca vertical slice with authenticated user isolation, server-owned questions/scoring/session state, immutable content hashes, and an isolated deployment. Other engines remain explicitly unavailable until their contracts and representative courses are verified. No claim of full platform completion.

Requirement anchors: requirements/AUGENBLICK.md sections 2, 4, 5; baseline/platform.md; baseline/znawca.md; ADR-0005 and ADR-0009. Interrupted L/T activities restart from beginning; completed testing activities cannot be retaken. No browser-only authoritative state. Source desktop application remains untouched.

## Shared runtime interface

POST /api/sessions/ {courseVersionId, mode, itemCount?} creates or restarts an unfinished activity for current user. Completed T returns 409. GET /api/sessions/{id}/ returns an owned runtime snapshot. POST /api/sessions/{id}/answer/ {submissionId: UUID, questionId, answer: string} records an idempotent answer and returns snapshot plus feedback (including current-question needsAnother). POST /api/sessions/{id}/next/ {questionId, submissionId} advances after that exact feedback, safely ignoring stale replays. POST /api/sessions/{id}/finish/ explicitly submits a fully answered T activity (or completes mastered L); POST /skip/ permits learning only after three cycles. Server owns all generated questions, accepted answers, scores, learning queue, attempts and event history. Legacy client-scored event endpoint rejects authoritative events.

Snapshot: {sessionId, courseVersionId, mode, status, totalScore, question: null|{id,objectId,kind,direction,prompt,field?,media?,options?}, feedback: null|{score,fullyCorrect,matched,missed,extra,correctAnswers}, progress:{total,completed,remaining}, canFinish, canSkip, review:[]}. Never expose accepted answers before resolution. Question structure follows existing presentation components, but acceptedAnswers are not sent. Answer uses option.value or typed text. Completed review contains submitted answer and feedback.

## Parallel ownership

1. Backend runtime worker: core/models.py, migrations, core/views.py, core/urls.py, new runtime/scoring modules and runtime tests. Read requirements; first add failing tests for cross-user denial, forged scores, idempotency, restart/no-retake, mastery and atomic submission. Implement then run Django tests.
2. Web worker: frontend and znawca adapter/UI only. Replace browser authority with runtime API; preserve five languages and media. Disable mock fallback outside explicit development. Handle pending/error/retry and double clicks, show one result view. Build and test runtime wiring.
3. Deployment worker: deploy/ only. Compose project augenblick, independent volumes/network, bind 127.0.0.1:18080, no 80/443 conflict, production config, health checks, rollback and reverse proxy instructions. Do not mutate remote server.
4. Root: content hash regression/fix, settings/auth hardening, repository publication, integration and server deployment. Exclude databases, uploads, secrets and agent state from Git. Remote existing Yixue is inspected read-only first; domain selection stays pending until user answers.

## Integration and acceptance

Create source baseline commit then managed worktrees. Merge reviewed commits without overwriting existing work. Use fresh temporary DB/media for automated tests. Run backend tests, frontend build, real browser two-user isolation and L/T workflow. Recheck API wire shape between workers. Upload exact tested revision. Confirm Yixue health/version before and after deployment; add only independent AUGENBLICK routing, validate proxy config before reload, preserve rollback. If domain/access is missing, complete internal deployment and report precise missing input without claiming public availability.

## Review focus

Concurrent duplicate submissions, answer leakage, nonowner access, client-forged event scores, changed media with same filename, interrupted testing versus submitted testing, missing assets, network failures, production mock fallback, and existing-site health.
