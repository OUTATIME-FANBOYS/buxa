# Staff board: tasks and projects per camp

Status: **spec for review.** The board is built in the browser (`apps/shared/src/kanban`, the Work pages under `/camp`). Moving it to Postgres has not started: there is no tasks table yet. Roadmap row: "ops, staff board (existing kanban): move onto the new backend, scoped per org; existing tests ported or replaced."
Depends on: phase 1 (one app, camp shell). Runs alongside phases 2 to 6, not in sequence.

## Words we use

- **Board**: a set of columns for one project (for example, "Summer 2027 Registration").
- **Task**: a unit of staff work with an owner, due date, priority and optional subtasks and comments.
- **Project**: a group of boards and tasks for one part of the camp (registration, facilities and safety, staff hiring).
- **Agent**: an automated assistant that proposes changes to tasks. Its proposals need approval; it never changes data alone.

## Decisions

1. **Tasks move to the database**, scoped per camp with row-level security, the same pattern as phase 1. The browser-only store is retired once the migration is done.
2. **Existing behaviour is kept**: columns, drag and drop, filters, subtasks, comments, activity, the timeline and calendar views.
3. **Agents propose, people approve.** Agent proposals are recorded with the approving person and kept in the audit log.
4. **No real personal data in tasks** until the privacy review is complete. Tasks must not hold children's names or medical notes (guidance shown in the task form).

## Acceptance criteria

- Tasks, boards and projects are stored in the database per camp and visible only to that camp's members.
- Every existing board view works on the database data, with the same keyboard and drag behaviour.
- Attachments are stored in object storage (not in the database), size-limited, and checked for type.
- Agent proposals need an approval, and the approval is recorded.

## Exit tests (must pass in CI before the phase is done)

- Tenant isolation: one camp cannot read another camp's tasks (database and API tests).
- Permissions: a viewer cannot create or move a task; staff can; only admins can delete a project.
- Port: the existing kanban tests are ported or replaced, and each removed test is listed in the PR with its replacement.
- Agent: a proposal cannot change a task until an approval is recorded.

## Not in this phase

Notifications by email, external integrations (Slack, Google Calendar), time tracking.

## Open for review

- Whether tasks can be linked to a session or a camper (useful, but adds a privacy question).
- Whether the agent feature stays in the product at all for camps.
