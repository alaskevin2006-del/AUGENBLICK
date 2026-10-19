# ADR-0010: Server runtime and isolated pilot

- Status: accepted for the Znawca pilot, not full-platform acceptance
- Date: 2026-10-19
- Authorization: autonomous implementation, parallel worktrees, GitHub publication, deployment beside Yixue. Desktop ZNAWCA is reference only.

Backend owns question generation, answers, mastery, attempts and events. All session reads/writes are user-scoped. Unowned historical sessions remain inaccessible. Old client score events are rejected. Public questions omit answers; published asset names hide source names and coordinates.

Interrupted L/T activities restart from the beginning per platform requirement 5.4. Completed T is not retakeable; explicit final submission consumes the attempt. Three-cycle learning escape follows ADR-0009. Desktop resume behavior does not override these requirements. Idempotent answer submission UUIDs and question-specific next requests protect retries.

Content identity hashes workbook and asset names and bytes. Source databases, uploads, credentials and agent state are excluded from Git.

Deployment uses the independent augenblick Compose project, database, volumes and network. HTTPS uses IP port 18443; HTTP binds loopback 18080 only. Yixue code, routes and containers remain unchanged. Its existing managed IP certificate tree is mounted read-only; a separate AUGENBLICK timer reloads the renewed certificate.

## Explicit pilot limits

This release is the deployable Znawca activity slice. Three-tier course scripts, cross-engine orchestration, REVIEW ledger, Course Studio draft/publish workflow, COS/CDN media, other engines and unresolved business decisions remain later milestones. A dedicated local media volume is used for the pilot and does not supersede ADR-0008's object-storage requirement. No real payment integration or full-platform acceptance is claimed.

Runtime endpoints and acceptance checks: `docs/superpowers/plans/2026-10-19-isolated-web-release.md`. Concrete execution evidence belongs in the release report.
