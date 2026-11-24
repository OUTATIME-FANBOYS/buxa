-- Seat hold length per camp (phase 4).
--
-- hold_minutes: how long a seat hold lasts for this camp. Null means the default, SEAT_HOLD_MINUTES (15, in
-- packages/domain/src/classes/holds.ts). The check keeps a stored value between 5 and 60 minutes, whatever the app sends.
-- A hold keeps the expiry it was given when it was placed, so changing this column never moves a hold that already exists.
--
-- The column is on orgs, so the row-level policies of 0001 and 0036 apply: only an admin or the owner may change it. The
-- request role may update only the columns it is granted (0021), so the grant names this column.
--
-- Expand only: nothing is dropped.

ALTER TABLE orgs ADD COLUMN hold_minutes integer NULL
  CONSTRAINT orgs_hold_minutes_check CHECK (hold_minutes IS NULL OR hold_minutes BETWEEN 5 AND 60);

GRANT UPDATE (hold_minutes) ON orgs TO buxa_app;
