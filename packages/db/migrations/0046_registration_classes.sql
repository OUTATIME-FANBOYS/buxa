-- Phase 3: registration by class (owner decision, docs/phases/03-registration.md, "Decided: families register for classes").
-- A registration names classes (rows of `sessions`, the app's Class) and each class is for one child (a person with the camper
-- role). A class row holds the place the family took at submission (a seat hold, or a waitlist enrolment) and the enrolment it
-- became at confirmation. Payment is recorded per class; nothing is charged online yet (payments are phase 9).
--
-- Same rules as 0023: org_id on every row, forced row-level security with one policy, composite foreign keys, and no hard
-- delete for the request role. Expand only: nothing existing is changed.

CREATE TABLE registration_classes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  registration_id  uuid NOT NULL,
  class_id         uuid NOT NULL,
  person_id        uuid NOT NULL,
  -- The hold taken for a place that was free at submission. Released as 'completed' when the registration is confirmed.
  hold_id          uuid,
  -- The enrolment: the waitlist entry taken when the class was full, or the enrolment created at confirmation.
  enrolment_id     uuid,
  -- Payment is recorded by staff by hand for now. 'unpaid' is the default and nothing is charged here.
  payment_status   text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  payment_note     text CHECK (payment_note IS NULL OR length(btrim(payment_note)) BETWEEN 1 AND 500),
  paid_at          timestamptz,
  paid_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (registration_id, class_id, person_id),
  FOREIGN KEY (org_id, registration_id) REFERENCES registrations (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, class_id) REFERENCES sessions (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, person_id) REFERENCES people (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, hold_id) REFERENCES seat_holds (org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, enrolment_id) REFERENCES enrolments (org_id, id) ON DELETE CASCADE,
  CHECK (hold_id IS NOT NULL OR enrolment_id IS NOT NULL),
  CHECK ((payment_status = 'paid') = (paid_at IS NOT NULL))
);
CREATE INDEX registration_classes_org_class_idx ON registration_classes (org_id, class_id);
CREATE INDEX registration_classes_registration_idx ON registration_classes (org_id, registration_id);

ALTER TABLE registration_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_classes FORCE ROW LEVEL SECURITY;
CREATE POLICY registration_classes_tenant ON registration_classes FOR ALL TO buxa_app
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- Least privilege: rows are inserted and linked, never deleted by request code. Only the holds, the enrolment and the payment
-- columns change after the row is written.
GRANT SELECT, INSERT ON registration_classes TO buxa_app;
GRANT UPDATE (hold_id, enrolment_id, payment_status, payment_note, paid_at, paid_by) ON registration_classes TO buxa_app;
