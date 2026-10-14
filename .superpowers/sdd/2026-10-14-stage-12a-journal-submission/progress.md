# SDD ledger — plan: docs/superpowers/plans/2026-10-14-stage-12a-journal-submission.md

Pre-flight: 
- Task 3 (state machine) consumes ManuscriptStatus from Task 2 — aligns.
- Task 4 (registration) consumes EMAIL_VERIFY token type from Task 2 — aligns.
- Task 5 (submission service) consumes JournalCounter + INCOMPLETE status from Task 2 — aligns.
- Task 6 (workflow) consumes ManuscriptEvent type from Task 2 — aligns.
- Task 7 (upload routes) consumes status gating INCOMPLETE/RETURNED_TO_AUTHOR from Tasks 2+6 — aligns.
- Task 10 (dashboard) consumes workflow transitions from Task 6 — aligns.
- Task 11 (screening) consumes all services from Tasks 3-6 — aligns.
