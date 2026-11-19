-- Phase 3: the teacher camp role (docs/phases/03-registration.md). Adding a value to an enum is not a drop.
-- Its own file: a value added in a transaction cannot be used in that same transaction, so 0024 (which uses it) runs after this commits.
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'teacher';
